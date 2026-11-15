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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  revalidatePath(`/app/punto/${puntoId}`);
  revalidatePath("/app/agenda");
});

/**
 * Borra una foto (fila + archivo). Solo la puede borrar quien la subió o un
 * admin: lo garantizan las políticas RLS de fotos_punto y de storage.objects,
 * no esta función. Si la fila no se borra (no es suya), no se toca el archivo.
 */
export const eliminarFotoPunto = accion(async (fotoId: number, puntoId: number) => {
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

/** Avisa a la administración de que un miembro ha cerrado un punto (instalado o retirado). */
async function avisarCierreAdministracion(puntoId: number, estado: keyof typeof ETIQUETA_ESTADO) {
  const supabase = await createClient();
  const [{ data: punto }, usuario] = await Promise.all([
    supabase.from("puntos_campana").select("nombre, campana_id, campanas(nombre)").eq("id", puntoId).maybeSingle(),
    obtenerUsuarioActual(),
  ]);
  if (!punto) return;
  const campana = Array.isArray(punto.campanas) ? punto.campanas[0] : punto.campanas;
  await notificarAdministradores(
    {
      tipo: `punto_${estado}`,
      titulo: `Punto ${ETIQUETA_ESTADO[estado]}: ${punto.nombre}`,
      cuerpo: `${usuario?.nombre ?? "Un miembro"}${campana?.nombre ? ` (${campana.nombre})` : ""}`,
      url: `/admin/campanas/${punto.campana_id}`,
      tag: `cierre-${puntoId}`,
    },
    { excluir: usuario?.id },
  );
}

const ESTADOS_ASIGNACION_REABRIR = ["pendiente", "en_curso"];

/**
 * Marca el punto como instalado. Devuelve los estados anteriores para poder deshacerlo
 * (el botón "Deshacer" de unos segundos usa exactamente esos).
 */
export const marcarPuntoInstalado = accion(async (
  puntoId: number,
  asignacionId: number,
): Promise<EstadosAnteriores> => {
  const supabase = await createClient();

  const [{ data: punto }, { data: asignacion }] = await Promise.all([
    supabase.from("puntos_campana").select("estado").eq("id", puntoId).maybeSingle(),
    supabase.from("asignaciones_punto").select("estado, punto_id").eq("id", asignacionId).maybeSingle(),
  ]);
  if (!punto || !asignacion || asignacion.punto_id !== puntoId) {
    throw new Error("No se encuentra el punto o la asignación.");
  }
  if (punto.estado === "verificado") {
    throw new Error("El administrador ya ha verificado este punto.");
  }

  const { error: errorPunto } = await supabase
    .from("puntos_campana")
    .update({ estado: "instalado" })
    .eq("id", puntoId);
  if (errorPunto) throw new Error(errorPunto.message);

  const { error: errorAsignacion } = await supabase
    .from("asignaciones_punto")
    .update({ estado: "completada", fecha_completada: new Date().toISOString() })
    .eq("id", asignacionId);
  if (errorAsignacion) {
    // Dejar el punto como estaba si la asignación no se pudo actualizar.
    await supabase.from("puntos_campana").update({ estado: punto.estado }).eq("id", puntoId);
    throw new Error(errorAsignacion.message);
  }

  enSegundoPlano(() => avisarCierreAdministracion(puntoId, "instalado"));

  revalidatePath(`/app/punto/${puntoId}`);
  revalidatePath("/app/agenda");
  return { punto: punto.estado, asignacion: asignacion.estado };
});

/**
 * Deshace "marcar como instalado": sirve para el botón "Deshacer" de unos segundos (con los
 * estados anteriores exactos) y para reabrir el punto más tarde si se marcó por error
 * (sin ellos: vuelve a pendiente / en curso). No se puede reabrir un punto ya verificado por
 * el administrador: lo impide esta función y, además, un trigger de la base de datos.
 */
export const reabrirPunto = accion(async (
  puntoId: number,
  asignacionId: number,
  anteriores?: Partial<EstadosAnteriores>,
) => {
  const supabase = await createClient();

  const { data: punto } = await supabase.from("puntos_campana").select("estado").eq("id", puntoId).maybeSingle();
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

  const { error: errorAsignacion } = await supabase
    .from("asignaciones_punto")
    .update({ estado: estadoAsignacion as "pendiente", fecha_completada: null })
    .eq("id", asignacionId);
  if (errorAsignacion) throw new Error(errorAsignacion.message);

  revalidatePath(`/app/punto/${puntoId}`);
  revalidatePath("/app/agenda");
});

export const reportarIncidencia = accion(async (puntoId: number, notas: string) => {
  const texto = notas.trim();
  if (!texto) throw new Error("Cuenta qué ha pasado para poder avisar.");
  const supabase = await createClient();
  const [{ data: punto }, usuario] = await Promise.all([
    supabase.from("puntos_campana").select("nombre, campana_id, campanas(nombre)").eq("id", puntoId).maybeSingle(),
    obtenerUsuarioActual(),
  ]);
  const { error } = await supabase
    .from("puntos_campana")
    .update({ estado: "incidencia", incidencia: texto, incidencia_en: new Date().toISOString() })
    .eq("id", puntoId);
  if (error) throw new Error(error.message);

  // La administración se entera al momento de lo que pasa en el campo.
  const campana = Array.isArray(punto?.campanas) ? punto?.campanas[0] : punto?.campanas;
  enSegundoPlano(() =>
    notificarAdministradores(
      {
        tipo: "incidencia_reportada",
        titulo: `Incidencia en ${punto?.nombre ?? "un punto"}`,
        cuerpo: `${usuario?.nombre ?? "Un instalador"}${campana?.nombre ? ` (${campana.nombre})` : ""}: ${texto.slice(0, 140)}`,
        url: punto ? `/admin/campanas/${punto.campana_id}` : "/admin/campanas",
        tag: `incidencia-${puntoId}`,
        urgente: true,
      },
      { excluir: usuario?.id },
    ),
  );

  revalidatePath(`/app/punto/${puntoId}`);
  revalidatePath("/app/agenda");
});

/** Cierra una tarea de retirada: el punto pasa a "retirado". */
export const marcarPuntoRetirado = accion(async (puntoId: number, asignacionId: number) => {
  const supabase = await createClient();

  const [{ data: punto }, { data: asignacion }] = await Promise.all([
    supabase.from("puntos_campana").select("estado").eq("id", puntoId).maybeSingle(),
    supabase.from("asignaciones_punto").select("estado, punto_id, rol_asignacion").eq("id", asignacionId).maybeSingle(),
  ]);
  if (!punto || !asignacion || asignacion.punto_id !== puntoId) throw new Error("No se encuentra el punto o la tarea.");
  if (asignacion.rol_asignacion !== "retirador") throw new Error("Esta tarea no es una retirada.");
  if (punto.estado === "retirado") return;
  if (!["instalado", "verificado"].includes(punto.estado)) throw new Error("Este punto no está instalado.");

  const { error: errorPunto } = await supabase.from("puntos_campana").update({ estado: "retirado" }).eq("id", puntoId);
  if (errorPunto) throw new Error(errorPunto.message);

  const { error: errorAsignacion } = await supabase
    .from("asignaciones_punto")
    .update({ estado: "completada", fecha_completada: new Date().toISOString() })
    .eq("id", asignacionId);
  if (errorAsignacion) {
    await supabase.from("puntos_campana").update({ estado: punto.estado }).eq("id", puntoId);
    throw new Error(errorAsignacion.message);
  }

  enSegundoPlano(() => avisarCierreAdministracion(puntoId, "retirado"));

  revalidatePath(`/app/punto/${puntoId}`);
  revalidatePath("/app/agenda");
});
