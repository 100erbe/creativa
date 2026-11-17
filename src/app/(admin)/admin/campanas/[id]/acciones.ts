"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { accion } from "@/lib/accion";
import type { Database } from "@/lib/supabase/types";
import { ETIQUETA_SOPORTE } from "@/lib/etiquetas";
import { enSegundoPlano, fechaAviso, notificar } from "@/lib/push/notificar";
import { soporteDe } from "@/lib/soporte";
import { articulosDeCampana } from "@/lib/campanas/articulos";

/** Personas con el punto pendiente o en curso en su agenda (las que hay que avisar de un cambio). */
async function asignadosActivos(supabase: Awaited<ReturnType<typeof createClient>>, puntoId: number) {
  const { data } = await supabase
    .from("asignaciones_punto")
    .select("usuario_id")
    .eq("punto_id", puntoId)
    .in("estado", ["pendiente", "en_curso"]);
  return (data ?? []).map((a) => a.usuario_id);
}

function refrescar(campanaId: number) {
  revalidatePath(`/admin/campanas/${campanaId}`);
  revalidatePath("/admin/campanas");
  revalidatePath("/admin/panel");
}

export const asignarPunto = accion(async (campanaId: number, puntoId: number, usuarioId: string) => {
  const admin = await exigirAdmin();
  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("asignaciones_punto")
    .select("id")
    .eq("punto_id", puntoId)
    .eq("usuario_id", usuarioId)
    .in("estado", ["pendiente", "en_curso"])
    .limit(1);
  if (existente && existente.length > 0) return; // ya tiene este punto asignado

  // La fecha de la agenda del empleado es la de colocación prevista del punto.
  const { data: punto } = await supabase
    .from("puntos_campana")
    .select("nombre, fecha_colocacion_prevista, campanas(nombre)")
    .eq("id", puntoId)
    .maybeSingle();

  const { error } = await supabase.from("asignaciones_punto").insert({
    punto_id: puntoId,
    usuario_id: usuarioId,
    estado: "pendiente",
    fecha_programada: punto?.fecha_colocacion_prevista ?? null,
  });
  if (error) throw new Error(error.message);

  // Al asignar el primer punto la campaña deja de estar "planificada".
  await supabase.from("campanas").update({ estado: "en_curso" }).eq("id", campanaId).eq("estado", "planificada");

  const campana = Array.isArray(punto?.campanas) ? punto?.campanas[0] : punto?.campanas;
  enSegundoPlano(() =>
    notificar(
      [usuarioId],
      {
        tipo: "punto_asignado",
        titulo: `Nuevo punto: ${punto?.nombre ?? "punto"}`,
        cuerpo: `${campana?.nombre ?? "Campaña"} · colocar ${fechaAviso(punto?.fecha_colocacion_prevista)}`,
        url: `/app/punto/${puntoId}`,
        tag: `punto-${puntoId}`,
      },
      { excluir: admin.id },
    ),
  );

  refrescar(campanaId);
});

export const quitarAsignacion = accion(async (campanaId: number, asignacionId: number) => {
  const admin = await exigirAdmin();
  const supabase = await createClient();

  const { data: antes } = await supabase
    .from("asignaciones_punto")
    .select("usuario_id, estado, puntos_campana(nombre)")
    .eq("id", asignacionId)
    .maybeSingle();

  const { error } = await supabase.from("asignaciones_punto").delete().eq("id", asignacionId);
  if (error) throw new Error(error.message);

  // Solo se avisa si el trabajo seguía pendiente: quitar una tarea ya hecha no cambia nada para esa persona.
  if (antes && ["pendiente", "en_curso"].includes(antes.estado)) {
    const punto = Array.isArray(antes.puntos_campana) ? antes.puntos_campana[0] : antes.puntos_campana;
    enSegundoPlano(() =>
      notificar(
        [antes.usuario_id],
        {
          tipo: "punto_quitado",
          titulo: `Ya no tienes: ${punto?.nombre ?? "un punto"}`,
          cuerpo: "Se ha quitado de tu agenda.",
          url: "/app/agenda",
        },
        { excluir: admin.id },
      ),
    );
  }

  refrescar(campanaId);
});

export const verificarPunto = accion(async (campanaId: number, puntoId: number) => {
  await exigirAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("puntos_campana").update({ estado: "verificado" }).eq("id", puntoId);
  if (error) throw new Error(error.message);

  refrescar(campanaId);
});

export const crearEnlaceCliente = accion(async (campanaId: number) => {
  const admin = await exigirAdmin();
  const supabase = await createClient();

  const expira = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("enlaces_cliente")
    .insert({ campana_id: campanaId, creado_por: admin.id, expira_en: expira });
  if (error) throw new Error(error.message);

  refrescar(campanaId);
});

// ---------------------------------------------------------------------
//  Campaña: datos, puntos, incidencias y enlace del cliente
// ---------------------------------------------------------------------

type EstadoCampana = Database["public"]["Enums"]["estado_campana"];
type TipoSoporte = Database["public"]["Enums"]["tipo_soporte"];
const ESTADOS_CAMPANA: EstadoCampana[] = ["planificada", "en_curso", "finalizada", "cancelada"];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export const actualizarCampana = accion(
  async (
    campanaId: number,
    datos: { nombre: string; estado: string; fechaInicio: string; fechaFin: string; descripcion: string },
  ) => {
    await exigirAdmin();
    const nombre = datos.nombre.trim();
    if (!nombre) throw new Error("La campaña necesita un nombre.");
    if (!ESTADOS_CAMPANA.includes(datos.estado as EstadoCampana)) throw new Error("Estado no válido.");
    for (const f of [datos.fechaInicio, datos.fechaFin]) if (f && !FECHA.test(f)) throw new Error("Fecha no válida.");
    if (datos.fechaInicio && datos.fechaFin && datos.fechaFin < datos.fechaInicio) {
      throw new Error("La fecha de fin es anterior a la de inicio.");
    }
    const supabase = await createClient();

    const { error } = await supabase
      .from("campanas")
      .update({
        nombre,
        estado: datos.estado as EstadoCampana,
        fecha_inicio: datos.fechaInicio || null,
        fecha_fin: datos.fechaFin || null,
        descripcion: datos.descripcion.trim() || null,
      })
      .eq("id", campanaId);
    if (error) throw new Error(error.message);

    refrescar(campanaId);
  },
);

export type DatosPunto = {
  nombre: string;
  tipoSoporte: string;
  /** Artículo del presupuesto/factura al que pertenece el punto (obligatorio si la campaña tiene documentos). */
  lineaId: number | null;
  direccion: string;
  latitud: number;
  longitud: number;
  piezas: number | null;
  fechaColocacion: string;
  fechaRetirada: string;
  instrucciones: string;
};

/** Crea (puntoId null) o modifica un punto de la campaña, también cuando el documento ya está emitido. */
export const guardarPunto = accion(async (campanaId: number, puntoId: number | null, d: DatosPunto) => {
  const admin = await exigirAdmin();
  if (!d.nombre.trim()) throw new Error("Pon un nombre al punto (ej. «Farola Av. Andalucía 12»).");
  if (!Number.isFinite(d.latitud) || !Number.isFinite(d.longitud)) {
    throw new Error("Marca la ubicación en el mapa o busca la dirección.");
  }
  if (d.piezas != null && (!Number.isFinite(d.piezas) || d.piezas <= 0)) {
    throw new Error("Las piezas del punto deben ser mayores que 0.");
  }
  for (const f of [d.fechaColocacion, d.fechaRetirada]) if (f && !FECHA.test(f)) throw new Error("Fecha no válida.");
  if (d.fechaColocacion && d.fechaRetirada && d.fechaRetirada < d.fechaColocacion) {
    throw new Error("La fecha de retirada es anterior a la de colocación.");
  }
  const supabase = await createClient();

  // Solo se pueden instalar los artículos que están en el presupuesto o la factura de la campaña. Sin
  // documentos vinculados no hay artículos que elegir y se admite el soporte a mano.
  const articulos = await articulosDeCampana(supabase, campanaId);
  let tipoSoporte: TipoSoporte;
  let lineaId: number | null = null;
  if (articulos.length > 0) {
    const elegido = articulos.find((a) => a.id === d.lineaId);
    if (!elegido) throw new Error("Elige a qué artículo del presupuesto o de la factura corresponde el punto.");
    lineaId = elegido.id;
    tipoSoporte = soporteDe(elegido.producto);
  } else {
    if (!(d.tipoSoporte in ETIQUETA_SOPORTE)) throw new Error("Tipo de soporte no válido.");
    tipoSoporte = d.tipoSoporte as TipoSoporte;
  }

  const fila = {
    nombre: d.nombre.trim(),
    tipo_soporte: tipoSoporte,
    linea_id: lineaId,
    direccion: d.direccion.trim() || null,
    latitud: Math.round(d.latitud * 1e7) / 1e7,
    longitud: Math.round(d.longitud * 1e7) / 1e7,
    piezas: d.piezas,
    fecha_colocacion_prevista: d.fechaColocacion || null,
    fecha_retirada_prevista: d.fechaRetirada || null,
    notas: d.instrucciones.trim() || null,
  };

  if (puntoId == null) {
    const { error } = await supabase.from("puntos_campana").insert({ ...fila, campana_id: campanaId });
    if (error) throw new Error(error.message);
  } else {
    const { data: antes } = await supabase
      .from("puntos_campana")
      .select("nombre, tipo_soporte, direccion, latitud, longitud, piezas, fecha_colocacion_prevista, fecha_retirada_prevista, notas")
      .eq("id", puntoId)
      .maybeSingle();
    const { data, error } = await supabase
      .from("puntos_campana")
      .update(fila)
      .eq("id", puntoId)
      .eq("campana_id", campanaId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("No se ha encontrado el punto.");
    // Si cambia la fecha de colocación, la agenda de quien lo tiene asignado la sigue.
    await supabase
      .from("asignaciones_punto")
      .update({ fecha_programada: fila.fecha_colocacion_prevista })
      .eq("punto_id", puntoId)
      .in("estado", ["pendiente", "en_curso"]);

    // Se avisa de lo que ha cambiado a quien tiene el punto en su agenda.
    if (antes) {
      const cambios: string[] = [];
      if (antes.fecha_colocacion_prevista !== fila.fecha_colocacion_prevista) {
        cambios.push(`colocación ${fechaAviso(fila.fecha_colocacion_prevista)}`);
      }
      if (antes.fecha_retirada_prevista !== fila.fecha_retirada_prevista) {
        cambios.push(`retirada ${fechaAviso(fila.fecha_retirada_prevista)}`);
      }
      const seMovio =
        Math.abs(Number(antes.latitud) - fila.latitud) > 1e-5 || Math.abs(Number(antes.longitud) - fila.longitud) > 1e-5;
      if (seMovio || (antes.direccion ?? null) !== fila.direccion) cambios.push("ubicación");
      if ((antes.notas ?? null) !== fila.notas) cambios.push("instrucciones");
      if (antes.nombre !== fila.nombre) cambios.push("nombre");
      if (antes.tipo_soporte !== fila.tipo_soporte) cambios.push("soporte");
      if ((antes.piezas == null ? null : Number(antes.piezas)) !== fila.piezas) cambios.push("piezas");

      if (cambios.length > 0) {
        const destinatarios = await asignadosActivos(supabase, puntoId);
        enSegundoPlano(() =>
          notificar(
            destinatarios,
            {
              tipo: "punto_modificado",
              titulo: `Cambios en ${fila.nombre}`,
              cuerpo: `Cambia: ${cambios.join(", ")}.`,
              url: `/app/punto/${puntoId}`,
              tag: `punto-${puntoId}`,
            },
            { excluir: admin.id },
          ),
        );
      }
    }
  }

  refrescar(campanaId);
});

/** Solo se borran puntos que aún no se han trabajado y no tienen fotos (el archivo quedaría huérfano). */
export const eliminarPuntoCampana = accion(async (campanaId: number, puntoId: number) => {
  const admin = await exigirAdmin();
  const supabase = await createClient();

  const { data: punto } = await supabase
    .from("puntos_campana")
    .select("estado, nombre")
    .eq("id", puntoId)
    .eq("campana_id", campanaId)
    .maybeSingle();
  if (!punto) throw new Error("No se ha encontrado el punto.");
  if (!["pendiente", "incidencia"].includes(punto.estado)) {
    throw new Error("Este punto ya está instalado: no se puede eliminar.");
  }
  const { count } = await supabase.from("fotos_punto").select("id", { count: "exact", head: true }).eq("punto_id", puntoId);
  if ((count ?? 0) > 0) throw new Error("Este punto tiene fotos: elimínalas antes de borrar el punto.");

  const destinatarios = await asignadosActivos(supabase, puntoId); // antes de borrar: las asignaciones caen en cascada
  const { error } = await supabase.from("puntos_campana").delete().eq("id", puntoId).eq("campana_id", campanaId);
  if (error) throw new Error(error.message);
  enSegundoPlano(() =>
    notificar(
      destinatarios,
      {
        tipo: "punto_eliminado",
        titulo: `Punto eliminado: ${punto.nombre}`,
        cuerpo: "Ya no hay que hacerlo.",
        url: "/app/agenda",
      },
      { excluir: admin.id },
    ),
  );

  refrescar(campanaId);
});

/** El administrador da por resuelta una incidencia: el punto vuelve a estar pendiente en la agenda. */
export const resolverIncidencia = accion(async (campanaId: number, puntoId: number) => {
  const admin = await exigirAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("puntos_campana")
    .update({ estado: "pendiente" })
    .eq("id", puntoId)
    .eq("campana_id", campanaId)
    .eq("estado", "incidencia")
    .select("id, nombre");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Este punto no tiene una incidencia abierta.");

  const destinatarios = await asignadosActivos(supabase, puntoId);
  enSegundoPlano(() =>
    notificar(
      destinatarios,
      {
        tipo: "incidencia_resuelta",
        titulo: `Incidencia resuelta: ${data[0]?.nombre ?? "punto"}`,
        cuerpo: "El punto vuelve a estar pendiente en tu agenda.",
        url: `/app/punto/${puntoId}`,
        tag: `punto-${puntoId}`,
      },
      { excluir: admin.id },
    ),
  );

  refrescar(campanaId);
});

/** Desactiva el enlace público: el cliente que lo tenga verá "no encontrada". */
export const revocarEnlaceCliente = accion(async (campanaId: number) => {
  await exigirAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("enlaces_cliente").update({ activo: false }).eq("campana_id", campanaId).eq("activo", true);
  if (error) throw new Error(error.message);

  refrescar(campanaId);
});

/** Revoca el enlace actual y crea uno nuevo (con otros 60 días de validez). */
export const renovarEnlaceCliente = accion(async (campanaId: number) => {
  const admin = await exigirAdmin();
  const supabase = await createClient();

  const { error: errorRevocar } = await supabase
    .from("enlaces_cliente")
    .update({ activo: false })
    .eq("campana_id", campanaId)
    .eq("activo", true);
  if (errorRevocar) throw new Error(errorRevocar.message);

  const expira = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("enlaces_cliente")
    .insert({ campana_id: campanaId, creado_por: admin.id, expira_en: expira });
  if (error) throw new Error(error.message);

  refrescar(campanaId);
});

// ---------------------------------------------------------------------
//  Retirada del material
// ---------------------------------------------------------------------

/** Encarga la retirada de un punto ya instalado: aparece en la agenda de esa persona como "Retirar". */
export const programarRetirada = accion(async (campanaId: number, puntoId: number, usuarioId: string) => {
  const admin = await exigirAdmin();
  const supabase = await createClient();

  const { data: punto } = await supabase
    .from("puntos_campana")
    .select("estado, nombre, fecha_retirada_prevista")
    .eq("id", puntoId)
    .eq("campana_id", campanaId)
    .maybeSingle();
  if (!punto) throw new Error("No se ha encontrado el punto.");
  if (!["instalado", "verificado"].includes(punto.estado)) {
    throw new Error("Solo se programa la retirada de puntos instalados.");
  }

  const { data: existente } = await supabase
    .from("asignaciones_punto")
    .select("id")
    .eq("punto_id", puntoId)
    .eq("rol_asignacion", "retirador")
    .in("estado", ["pendiente", "en_curso"])
    .limit(1);
  if (existente && existente.length > 0) throw new Error("Este punto ya tiene una retirada pendiente.");

  const { error } = await supabase.from("asignaciones_punto").insert({
    punto_id: puntoId,
    usuario_id: usuarioId,
    rol_asignacion: "retirador",
    estado: "pendiente",
    fecha_programada: punto.fecha_retirada_prevista,
  });
  if (error) throw new Error(error.message);

  enSegundoPlano(() =>
    notificar(
      [usuarioId],
      {
        tipo: "retirada_asignada",
        titulo: `Retirada: ${punto.nombre}`,
        cuerpo: `Retirar ${fechaAviso(punto.fecha_retirada_prevista)}`,
        url: `/app/punto/${puntoId}`,
        tag: `punto-${puntoId}`,
      },
      { excluir: admin.id },
    ),
  );

  refrescar(campanaId);
});

/** El administrador da el punto por retirado (p. ej. lo retiró él mismo o se avisó por teléfono). */
export const marcarRetirado = accion(async (campanaId: number, puntoId: number) => {
  await exigirAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("puntos_campana")
    .update({ estado: "retirado" })
    .eq("id", puntoId)
    .eq("campana_id", campanaId)
    .in("estado", ["instalado", "verificado"])
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Solo se pueden retirar puntos instalados.");

  // Las tareas de retirada que quedaran abiertas se cierran.
  await supabase
    .from("asignaciones_punto")
    .update({ estado: "completada", fecha_completada: new Date().toISOString() })
    .eq("punto_id", puntoId)
    .eq("rol_asignacion", "retirador")
    .in("estado", ["pendiente", "en_curso"]);

  refrescar(campanaId);
});

/** Cierra la campaña cuando todos sus puntos están retirados. */
export const finalizarCampana = accion(async (campanaId: number) => {
  await exigirAdmin();
  const supabase = await createClient();

  const { data: puntos, error: errorPuntos } = await supabase.from("puntos_campana").select("estado").eq("campana_id", campanaId);
  if (errorPuntos) throw new Error(errorPuntos.message);
  if (!puntos || puntos.length === 0 || puntos.some((p) => p.estado !== "retirado")) {
    throw new Error("Todos los puntos deben estar retirados para finalizar la campaña.");
  }

  const { error } = await supabase.from("campanas").update({ estado: "finalizada" }).eq("id", campanaId);
  if (error) throw new Error(error.message);

  refrescar(campanaId);
});

/**
 * Borra una campaña que no está vinculada a ningún documento (si lo está, forma parte de lo facturado).
 * Se borran también sus fotos del almacenamiento; puntos, asignaciones y enlaces caen en cascada.
 */
export const eliminarCampana = accion(async (campanaId: number) => {
  const admin = await exigirAdmin();
  const supabase = await createClient();

  const [{ data: campana }, { count: documentos }, { data: puntos }] = await Promise.all([
    supabase.from("campanas").select("nombre, documento_id").eq("id", campanaId).maybeSingle(),
    supabase.from("documentos").select("id", { count: "exact", head: true }).eq("campana_id", campanaId),
    supabase.from("puntos_campana").select("id").eq("campana_id", campanaId),
  ]);
  if (!campana) throw new Error("No se ha encontrado la campaña.");
  if (campana.documento_id || (documentos ?? 0) > 0) {
    throw new Error("La campaña está vinculada a un documento: no se puede eliminar. Cámbiala a «Cancelada».");
  }
  const ids = (puntos ?? []).map((p) => p.id);

  let destinatarios: string[] = [];
  if (ids.length) {
    const [{ data: fotos, error: errorFotos }, { data: asignados }] = await Promise.all([
      supabase.from("fotos_punto").select("id, url_foto").in("punto_id", ids),
      supabase.from("asignaciones_punto").select("usuario_id").in("punto_id", ids).in("estado", ["pendiente", "en_curso"]),
    ]);
    if (errorFotos) throw new Error(errorFotos.message);
    destinatarios = [...new Set((asignados ?? []).map((a) => a.usuario_id))];

    if (fotos && fotos.length) {
      const { error: errorArchivos } = await supabase.storage.from("fotos-puntos").remove(fotos.map((f) => f.url_foto));
      if (errorArchivos) throw new Error(`No se pudieron borrar las fotos: ${errorArchivos.message}`);
      const { error } = await supabase.from("fotos_punto").delete().in("punto_id", ids);
      if (error) throw new Error(error.message);
    }
  }

  const { error } = await supabase.from("campanas").delete().eq("id", campanaId);
  if (error) throw new Error(error.message);
  if (destinatarios.length) {
    enSegundoPlano(() =>
      notificar(
        destinatarios,
        {
          tipo: "punto_eliminado",
          titulo: `Campaña eliminada: ${campana.nombre}`,
          cuerpo: "Sus puntos ya no hay que hacerlos.",
          url: "/app/agenda",
        },
        { excluir: admin.id },
      ),
    );
  }

  revalidatePath("/admin/campanas");
  revalidatePath("/admin/panel");
});
