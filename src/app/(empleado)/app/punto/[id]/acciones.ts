"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validarMetadatosFoto } from "@/lib/foto-metadatos";
import { accion } from "@/lib/accion";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { enSegundoPlano, notificarAdministradores } from "@/lib/push/notificar";

const BUCKET_FOTOS = "fotos-puntos";
const MAX_BYTES_FOTO = 512 * 1024; // mismo límite que el bucket
const TIPOS_FOTO: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg" };

/**
 * Sube una foto del punto a Supabase Storage y registra la fila en fotos_punto.
 *
 * La foto puede venir de la cámara o de la galería, y la ubicación es opcional. Qué ubicación
 * se guarda y de dónde sale lo decide validarMetadatosFoto (no se fía de lo que manda el cliente):
 * sin coordenadas válidas y coherentes con el origen, la foto se guarda sin ubicación.
 */
export const subirFotoPunto = accion(async (formData: FormData) => {
  const supabase = await createClient();
  // Sesión válida y cuenta activa (una cuenta desactivada no sube nada aunque su token siga vivo).
  const user = await obtenerUsuarioActual();
  if (!user) throw new Error("Sesión no válida.");

  const archivo = formData.get("archivo") as File;
  const puntoId = Number(formData.get("puntoId"));
  const asignacionId = Number(formData.get("asignacionId")) || null;
  const tipo =
    (["antes", "instalacion", "despues", "incidencia"] as const).find(
      (t) => t === formData.get("tipo"),
    ) ?? "instalacion";

  if (!archivo || !puntoId) throw new Error("Faltan datos de la foto.");

  const meta = validarMetadatosFoto({
    origenFoto: formData.get("origenFoto"),
    origenUbicacion: formData.get("origenUbicacion"),
    latitud: formData.get("latitud"),
    longitud: formData.get("longitud"),
    tomadaEn: formData.get("tomadaEn"),
  });

  // La app comprime antes de subir; aquí se rechaza cualquier cosa que no lo esté.
  if (archivo.size > MAX_BYTES_FOTO) throw new Error("La foto es demasiado grande.");
  const extension = TIPOS_FOTO[archivo.type];
  if (!extension) throw new Error("Formato de foto no permitido.");

  // Sufijo aleatorio: al subir varias fotos seguidas desde la galería no se pisan los nombres.
  const ruta = `punto_${puntoId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_FOTOS)
    .upload(ruta, archivo, { contentType: archivo.type });
  if (errorSubida) throw new Error(errorSubida.message);

  const { error: errorInsert } = await supabase.from("fotos_punto").insert({
    punto_id: puntoId,
    asignacion_id: asignacionId,
    usuario_id: user.id,
    tipo,
    url_foto: ruta,
    latitud: meta.latitud,
    longitud: meta.longitud,
    origen_foto: meta.origenFoto,
    origen_ubicacion: meta.origenUbicacion,
    // Fotos de galería: la fecha en que se hicieron, si el archivo la trae; si no, la de subida.
    ...(meta.tomadaEn ? { tomada_en: meta.tomadaEn } : {}),
  });
  if (errorInsert) {
    // No dejar un archivo huérfano en el bucket si la fila no se pudo crear.
    await supabase.storage.from(BUCKET_FOTOS).remove([ruta]);
    throw new Error(errorInsert.message);
  }

  // Primera foto = el trabajo ha empezado.
  if (asignacionId) {
    await supabase.from("asignaciones_punto").update({ estado: "en_curso" }).eq("id", asignacionId).eq("estado", "pendiente");
  }

  // Notificación ligera a la administración (solo bandeja/campana, sin push) cuando un miembro sube una foto.
  if (user.rol !== "admin") {
    enSegundoPlano(() => avisarFotoAdministracion(puntoId, user.id, user.nombre, user.apellidos));
  }

  revalidatePath(`/app/punto/${puntoId}`);
  revalidatePath("/app/agenda");
  // La ficha de la campaña y el panel del admin muestran el estado de los puntos.
  revalidatePath("/admin/campanas", "layout");
  revalidatePath("/admin/panel");
});

/**
 * Borra una foto (fila + archivo). Solo la puede borrar quien la subió o un
 * admin: lo garantizan las políticas RLS de fotos_punto y de storage.objects,
 * no esta función. Si la fila no se borra (no es suya), no se toca el archivo.
 */
export const eliminarFotoPunto = accion(async (fotoId: number, puntoId: number) => {
  if (!(await obtenerUsuarioActual())) throw new Error("Sesión no válida.");
  const supabase = await createClient();

  const { data: borradas, error } = await supabase
    .from("fotos_punto")
    .delete()
    .eq("id", fotoId)
    .select("url_foto");
  if (error) throw new Error(error.message);
  const borrada = borradas?.[0];
  if (!borrada) throw new Error("No puedes eliminar esta foto.");

  const { error: errorArchivo } = await supabase.storage
    .from(BUCKET_FOTOS)
    .remove([borrada.url_foto]);
  if (errorArchivo) throw new Error(errorArchivo.message);

  revalidatePath(`/app/punto/${puntoId}`);
});

/** Estados en los que estaban el punto y la asignación antes de marcar como instalado. */
export type EstadosAnteriores = { punto: string; asignacion: string };

const ESTADOS_PUNTO_REABRIR = ["pendiente", "incidencia"];
const ETIQUETA_ESTADO = { instalado: "instalado", retirado: "retirado" } as const;

async function obtenerContextoPunto(puntoId: number) {
  const supabase = await createClient();
  const [{ data: punto }, usuario] = await Promise.all([
    supabase.from("puntos_campana").select("nombre, campana_id, campanas(nombre)").eq("id", puntoId).maybeSingle(),
    obtenerUsuarioActual(),
  ]);
  if (!punto) return null;
  const campana = Array.isArray(punto.campanas) ? punto.campanas[0] : punto.campanas;
  return { punto, campanaNombre: campana?.nombre ?? null, usuario };
}

/** Notificación ligera (solo bandeja, sin push) cuando un miembro añade una foto a un punto. */
async function avisarFotoAdministracion(
  puntoId: number,
  usuarioId: string,
  nombre: string,
  apellidos: string | null,
) {
  const ctx = await obtenerContextoPunto(puntoId);
  if (!ctx) return;
  const quien = [nombre, apellidos].filter(Boolean).join(" ") || "Un miembro";
  await notificarAdministradores(
    {
      tipo: "foto_punto",
      titulo: `Nueva foto en ${ctx.punto.nombre}`,
      cuerpo: `${quien}${ctx.campanaNombre ? ` · ${ctx.campanaNombre}` : ""}`,
      url: `/admin/campanas/${ctx.punto.campana_id}`,
      tag: `foto-punto-${puntoId}`,
    },
    { excluir: usuarioId, soloBandeja: true },
  );
}

/** Avisa a la administración de que un miembro ha cerrado un punto (retirado) o lo ha reabierto como no instalado. */
async function avisarCierreAdministracion(puntoId: number, estado: keyof typeof ETIQUETA_ESTADO) {
  const ctx = await obtenerContextoPunto(puntoId);
  if (!ctx) return;
  const quien = [ctx.usuario?.nombre, ctx.usuario?.apellidos].filter(Boolean).join(" ") || "Un miembro";
  await notificarAdministradores(
    {
      tipo: `punto_${estado}`,
      titulo: `Punto ${ETIQUETA_ESTADO[estado]}: ${ctx.punto.nombre}`,
      cuerpo: `${quien}${ctx.campanaNombre ? ` (${ctx.campanaNombre})` : ""}`,
      url: `/admin/campanas/${ctx.punto.campana_id}`,
      tag: `cierre-${puntoId}`,
    },
    { excluir: ctx.usuario?.id },
  );
}

/** Avisa de inmediato a la administración si un punto ya notificado vuelve a marcarse como no instalado. */
async function avisarReaperturaAdministracion(puntoId: number, nombre: string, apellidos: string | null, usuarioId: string) {
  const ctx = await obtenerContextoPunto(puntoId);
  if (!ctx) return;
  const quien = [nombre, apellidos].filter(Boolean).join(" ") || "Un miembro";
  await notificarAdministradores(
    {
      tipo: "punto_reabierto",
      titulo: `Punto marcado como no instalado: ${ctx.punto.nombre}`,
      cuerpo: `${quien}${ctx.campanaNombre ? ` (${ctx.campanaNombre})` : ""}`,
      url: `/admin/campanas/${ctx.punto.campana_id}`,
      tag: `reapertura-${puntoId}`,
    },
    { excluir: usuarioId },
  );
}

const ESTADOS_ASIGNACION_REABRIR = ["pendiente", "en_curso"];

/**
 * Marca el punto como instalado. Devuelve los estados anteriores para poder deshacerlo
 * (el botón "Deshacer" de unos segundos usa exactamente esos).
 * La notificación a administración se difiere ~1 min vía pg_cron para evitar avisos por error.
 */
export const marcarPuntoInstalado = accion(async (
  puntoId: number,
  asignacionId: number,
): Promise<EstadosAnteriores> => {
  const supabase = await createClient();

  const [{ data: punto }, { data: asignacion }, usuario] = await Promise.all([
    supabase.from("puntos_campana").select("estado").eq("id", puntoId).maybeSingle(),
    supabase.from("asignaciones_punto").select("estado, punto_id").eq("id", asignacionId).maybeSingle(),
    obtenerUsuarioActual(),
  ]);
  if (!usuario) throw new Error("Sesión no válida.");
  if (!punto || !asignacion || asignacion.punto_id !== puntoId) {
    throw new Error("No se encuentra el punto o la asignación.");
  }
  if (punto.estado === "verificado") {
    throw new Error("El administrador ya ha verificado este punto.");
  }

  const { data: puntosActualizados, error: errorPunto } = await supabase
    .from("puntos_campana")
    .update({ estado: "instalado" })
    .eq("id", puntoId)
    .select("id");
  if (errorPunto) throw new Error(errorPunto.message);
  if (!puntosActualizados || puntosActualizados.length === 0) throw new Error("No puedes modificar este punto.");

  const ahoraIso = new Date().toISOString();
  const { data: asignacionesActualizadas, error: errorAsignacion } = await supabase
    .from("asignaciones_punto")
    .update({
      estado: "completada",
      fecha_completada: ahoraIso,
      // Si cierra un admin no hace falta notificarlo después; si es miembro queda pendiente 1 min.
      cierre_notificado_en: usuario.rol === "admin" ? ahoraIso : null,
    })
    .eq("id", asignacionId)
    .select("id");
  if (errorAsignacion || !asignacionesActualizadas || asignacionesActualizadas.length === 0) {
    // Dejar el punto como estaba si la asignación no se pudo actualizar.
    await supabase.from("puntos_campana").update({ estado: punto.estado }).eq("id", puntoId);
    throw new Error(errorAsignacion?.message ?? "No puedes modificar esta tarea.");
  }

  revalidatePath(`/app/punto/${puntoId}`);
  revalidatePath("/app/agenda");
  // La ficha de la campaña y el panel del admin muestran el estado de los puntos.
  revalidatePath("/admin/campanas", "layout");
  revalidatePath("/admin/panel");
  return { punto: punto.estado, asignacion: asignacion.estado };
});

/**
 * Deshace "marcar como instalado": sirve para el botón "Deshacer" de unos segundos (con los
 * estados anteriores exactos) y para marcarlo más tarde como no instalado por error u otro problema.
 * Si ya había pasado el minuto de gracia y el admin fue notificado, se le avisa inmediatamente.
 */
export const reabrirPunto = accion(async (
  puntoId: number,
  asignacionId: number,
  anteriores?: Partial<EstadosAnteriores>,
) => {
  const supabase = await createClient();

  const [{ data: punto }, { data: asignacionAntes }, usuario] = await Promise.all([
    supabase.from("puntos_campana").select("estado").eq("id", puntoId).maybeSingle(),
    supabase.from("asignaciones_punto").select("cierre_notificado_en").eq("id", asignacionId).maybeSingle(),
    obtenerUsuarioActual(),
  ]);
  if (!usuario) throw new Error("Sesión no válida.");
  if (!punto) throw new Error("No se encuentra el punto.");
  if (punto.estado === "verificado") {
    throw new Error("El administrador ya ha verificado este punto: no se puede reabrir.");
  }
  if (punto.estado !== "instalado") throw new Error("El punto no está marcado como instalado.");

  const estadoPunto = ESTADOS_PUNTO_REABRIR.includes(anteriores?.punto ?? "") ? anteriores!.punto! : "pendiente";
  const estadoAsignacion = ESTADOS_ASIGNACION_REABRIR.includes(anteriores?.asignacion ?? "")
    ? anteriores!.asignacion!
    : "en_curso";

  // El filtro por estado hace la operación atómica: si alguien lo verificó entre medias, no toca nada.
  const { data: actualizados, error: errorPunto } = await supabase
    .from("puntos_campana")
    .update({ estado: estadoPunto as "pendiente" })
    .eq("id", puntoId)
    .eq("estado", "instalado")
    .select("id");
  if (errorPunto) throw new Error(errorPunto.message);
  if (!actualizados || actualizados.length === 0) throw new Error("No se pudo reabrir el punto.");

  const { data: asignacionesActualizadas, error: errorAsignacion } = await supabase
    .from("asignaciones_punto")
    .update({
      estado: estadoAsignacion as "pendiente",
      fecha_completada: null,
      cierre_notificado_en: null,
    })
    .eq("id", asignacionId)
    .select("id");
  if (errorAsignacion) throw new Error(errorAsignacion.message);
  if (!asignacionesActualizadas || asignacionesActualizadas.length === 0) throw new Error("No puedes modificar esta tarea.");

  if (asignacionAntes?.cierre_notificado_en != null && usuario.rol !== "admin") {
    enSegundoPlano(() =>
      avisarReaperturaAdministracion(puntoId, usuario.nombre, usuario.apellidos, usuario.id),
    );
  }

  revalidatePath(`/app/punto/${puntoId}`);
  revalidatePath("/app/agenda");
  // La ficha de la campaña y el panel del admin muestran el estado de los puntos.
  revalidatePath("/admin/campanas", "layout");
  revalidatePath("/admin/panel");
});

export const reportarIncidencia = accion(async (puntoId: number, notas: string) => {
  const texto = notas.trim();
  if (!texto) throw new Error("Cuenta qué ha pasado para poder avisar.");
  const supabase = await createClient();
  const [{ data: punto }, usuario] = await Promise.all([
    supabase.from("puntos_campana").select("nombre, campana_id, campanas(nombre)").eq("id", puntoId).maybeSingle(),
    obtenerUsuarioActual(),
  ]);
  if (!usuario) throw new Error("Sesión no válida.");
  if (!punto) throw new Error("No se encuentra el punto.");
  const { data: actualizados, error } = await supabase
    .from("puntos_campana")
    .update({ estado: "incidencia", incidencia: texto, incidencia_en: new Date().toISOString() })
    .eq("id", puntoId)
    .select("id");
  if (error) throw new Error(error.message);
  // Sin fila actualizada (punto ajeno) no se avisa a nadie: evita avisos urgentes falsos.
  if (!actualizados || actualizados.length === 0) throw new Error("No puedes modificar este punto.");

  // La administración se entera al momento de lo que pasa en el campo.
  const campana = Array.isArray(punto.campanas) ? punto.campanas[0] : punto.campanas;
  enSegundoPlano(() =>
    notificarAdministradores(
      {
        tipo: "incidencia_reportada",
        titulo: `Incidencia en ${punto.nombre}`,
        cuerpo: `${usuario.nombre}${campana?.nombre ? ` (${campana.nombre})` : ""}: ${texto.slice(0, 140)}`,
        url: `/admin/campanas/${punto.campana_id}`,
        tag: `incidencia-${puntoId}`,
        urgente: true,
      },
      { excluir: usuario.id },
    ),
  );

  revalidatePath(`/app/punto/${puntoId}`);
  revalidatePath("/app/agenda");
  // La ficha de la campaña y el panel del admin muestran el estado de los puntos.
  revalidatePath("/admin/campanas", "layout");
  revalidatePath("/admin/panel");
});

/** Cierra una tarea de retirada: el punto pasa a "retirado". */
export const marcarPuntoRetirado = accion(async (puntoId: number, asignacionId: number) => {
  const supabase = await createClient();

  const [{ data: punto }, { data: asignacion }, usuario] = await Promise.all([
    supabase.from("puntos_campana").select("estado").eq("id", puntoId).maybeSingle(),
    supabase.from("asignaciones_punto").select("estado, punto_id, rol_asignacion").eq("id", asignacionId).maybeSingle(),
    obtenerUsuarioActual(),
  ]);
  if (!usuario) throw new Error("Sesión no válida.");
  if (!punto || !asignacion || asignacion.punto_id !== puntoId) throw new Error("No se encuentra el punto o la tarea.");
  if (asignacion.rol_asignacion !== "retirador") throw new Error("Esta tarea no es una retirada.");
  if (punto.estado === "retirado") return;
  if (!["instalado", "verificado"].includes(punto.estado)) throw new Error("Este punto no está instalado.");

  const { data: puntosActualizados, error: errorPunto } = await supabase
    .from("puntos_campana")
    .update({ estado: "retirado" })
    .eq("id", puntoId)
    .select("id");
  if (errorPunto) throw new Error(errorPunto.message);
  if (!puntosActualizados || puntosActualizados.length === 0) throw new Error("No puedes modificar este punto.");

  const ahoraIso = new Date().toISOString();
  const { data: asignacionesActualizadas, error: errorAsignacion } = await supabase
    .from("asignaciones_punto")
    .update({ estado: "completada", fecha_completada: ahoraIso, cierre_notificado_en: ahoraIso })
    .eq("id", asignacionId)
    .select("id");
  if (errorAsignacion || !asignacionesActualizadas || asignacionesActualizadas.length === 0) {
    await supabase.from("puntos_campana").update({ estado: punto.estado }).eq("id", puntoId);
    throw new Error(errorAsignacion?.message ?? "No puedes modificar esta tarea.");
  }

  enSegundoPlano(() => avisarCierreAdministracion(puntoId, "retirado"));

  revalidatePath(`/app/punto/${puntoId}`);
  revalidatePath("/app/agenda");
  // La ficha de la campaña y el panel del admin muestran el estado de los puntos.
  revalidatePath("/admin/campanas", "layout");
  revalidatePath("/admin/panel");
});
