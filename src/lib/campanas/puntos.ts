import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";
import { enSegundoPlano, fechaAviso, notificar } from "@/lib/push/notificar";
import {
  RADIO_DEFECTO_METROS,
  esGeometriaZona,
  esTipoUbicacion,
  simplificarGeometria,
  type GeometriaZona,
  type TipoUbicacion,
} from "@/lib/mapa/zonas";

/**
 * Reglas comunes de los puntos de campaña, compartidas por la ficha de la campaña
 * (campanas/[id]/acciones.ts) y el asistente de documentos (documentos/nuevo/acciones.ts).
 * Antes cada uno tenía su copia y el asistente no avisaba al equipo, no movía la fecha de la
 * agenda ni impedía borrar un punto con fotos.
 */

type Cliente = Awaited<ReturnType<typeof createClient>>;
type Punto = Database["public"]["Tables"]["puntos_campana"]["Row"];

export const redondearCoordenada = (v: number) => Math.round(v * 1e7) / 1e7;

/** Tipo de ubicación, radio y polígono validados para guardar un punto o una zona. */
export function ubicacionValidada(d: {
  tipoUbicacion?: TipoUbicacion | string | null;
  radioMetros?: number | null;
  geometria?: GeometriaZona | null;
}): { tipo_ubicacion: TipoUbicacion; radio_metros: number | null; geometria: Json | null } {
  const tipo: TipoUbicacion = esTipoUbicacion(d.tipoUbicacion) ? d.tipoUbicacion : "punto";
  if (tipo === "radio") {
    const r = d.radioMetros ?? RADIO_DEFECTO_METROS;
    if (!Number.isFinite(r) || r < 50 || r > 25000) throw new Error("Radio de zona no válido.");
    return { tipo_ubicacion: tipo, radio_metros: Math.round(r), geometria: null };
  }
  if (tipo === "poligono") {
    if (!esGeometriaZona(d.geometria)) throw new Error("Geometría de zona no válida.");
    return { tipo_ubicacion: tipo, radio_metros: null, geometria: simplificarGeometria(d.geometria) as unknown as Json };
  }
  return { tipo_ubicacion: tipo, radio_metros: null, geometria: null };
}

/** Radio nuevo solo si el punto ya es una zona circular y el valor es válido. */
export function radioActualizable(tipoActual: string | null | undefined, radio: number | null | undefined) {
  return tipoActual === "radio" && radio != null && Number.isFinite(radio) && radio >= 50 && radio <= 25000
    ? Math.round(radio)
    : undefined;
}

/** Personas con el punto pendiente o en curso en su agenda (las que hay que avisar de un cambio). */
export async function asignadosActivos(supabase: Cliente, puntoId: number) {
  const { data } = await supabase
    .from("asignaciones_punto")
    .select("usuario_id")
    .eq("punto_id", puntoId)
    .in("estado", ["pendiente", "en_curso"]);
  return (data ?? []).map((a) => a.usuario_id);
}

/** La agenda de quien tiene el punto sigue a la fecha de colocación prevista. */
export async function sincronizarFechaAgenda(supabase: Cliente, puntoId: number, fecha: string | null) {
  await supabase
    .from("asignaciones_punto")
    .update({ fecha_programada: fecha })
    .eq("punto_id", puntoId)
    .in("estado", ["pendiente", "en_curso"]);
}

type CamposAviso = Pick<
  Punto,
  "tipo_soporte" | "direccion" | "latitud" | "longitud" | "piezas" | "fecha_colocacion_prevista" | "fecha_retirada_prevista" | "notas"
>;

/** Lista legible de lo que cambia entre dos versiones de un punto (para el aviso al equipo). */
export function cambiosPunto(antes: Partial<CamposAviso>, despues: Partial<CamposAviso>): string[] {
  const cambios: string[] = [];
  const tiene = (k: keyof CamposAviso) => k in despues;
  if (tiene("fecha_colocacion_prevista") && (antes.fecha_colocacion_prevista ?? null) !== (despues.fecha_colocacion_prevista ?? null)) {
    cambios.push(`colocación ${fechaAviso(despues.fecha_colocacion_prevista ?? null)}`);
  }
  if (tiene("fecha_retirada_prevista") && (antes.fecha_retirada_prevista ?? null) !== (despues.fecha_retirada_prevista ?? null)) {
    cambios.push(`retirada ${fechaAviso(despues.fecha_retirada_prevista ?? null)}`);
  }
  const seMovio =
    tiene("latitud") &&
    tiene("longitud") &&
    (Math.abs(Number(antes.latitud) - Number(despues.latitud)) > 1e-5 ||
      Math.abs(Number(antes.longitud) - Number(despues.longitud)) > 1e-5);
  if (seMovio || (tiene("direccion") && (antes.direccion ?? null) !== (despues.direccion ?? null))) cambios.push("ubicación");
  if (tiene("notas") && (antes.notas ?? null) !== (despues.notas ?? null)) cambios.push("instrucciones");
  if (tiene("tipo_soporte") && antes.tipo_soporte !== despues.tipo_soporte) cambios.push("soporte");
  if (tiene("piezas") && (antes.piezas == null ? null : Number(antes.piezas)) !== (despues.piezas == null ? null : Number(despues.piezas))) {
    cambios.push("unidades");
  }
  return cambios;
}

/** Avisa (campana + push) a quien tiene el punto en su agenda de lo que ha cambiado. */
export async function avisarCambiosPunto(
  supabase: Cliente,
  puntoId: number,
  nombre: string,
  cambios: string[],
  excluir: string,
) {
  if (cambios.length === 0) return;
  const destinatarios = await asignadosActivos(supabase, puntoId);
  enSegundoPlano(() =>
    notificar(
      destinatarios,
      {
        tipo: "punto_modificado",
        titulo: `Cambios en ${nombre}`,
        cuerpo: `Cambia: ${cambios.join(", ")}.`,
        url: `/app/punto/${puntoId}`,
        tag: `punto-${puntoId}`,
      },
      { excluir },
    ),
  );
}

/**
 * Borra un punto que aún no se ha trabajado y no tiene fotos (el archivo quedaría huérfano)
 * y avisa a quien lo tenía en su agenda.
 */
export async function eliminarPuntoSinTrabajar(supabase: Cliente, campanaId: number, puntoId: number, excluir: string) {
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
      { excluir },
    ),
  );
}

/** Columnas que devuelven las acciones al crear un punto (para pintarlo sin recargar). */
export const COLUMNAS_PUNTO_CREADO =
  "id, nombre, tipo_soporte, linea_id, piezas, direccion, latitud, longitud, tipo_ubicacion, radio_metros, geometria, fecha_colocacion_prevista, fecha_retirada_prevista, estado, notas";

/** Normaliza los numéricos y la zona del punto recién creado. */
export function puntoCreado<
  T extends { piezas: unknown; latitud: unknown; longitud: unknown; tipo_ubicacion: string | null; radio_metros: unknown; geometria: unknown },
>(creado: T) {
  return {
    ...creado,
    piezas: creado.piezas == null ? null : Number(creado.piezas),
    latitud: Number(creado.latitud),
    longitud: Number(creado.longitud),
    tipo_ubicacion: esTipoUbicacion(creado.tipo_ubicacion) ? creado.tipo_ubicacion : ("punto" as TipoUbicacion),
    radio_metros: creado.radio_metros == null ? null : Number(creado.radio_metros),
    geometria: esGeometriaZona(creado.geometria) ? creado.geometria : null,
  };
}
