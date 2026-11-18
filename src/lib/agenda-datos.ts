import "server-only";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { diasDesdeVencimiento } from "@/lib/documentos";
import { construirSeriesAgenda, ventanaConsultaAgenda } from "@/lib/series-agenda";
import type { PuntoActivoAgenda } from "@/lib/distancia";
import type { FilaAgenda, FilaEnriquecida } from "@/components/empleado/tarjeta-punto";

/** La fecha de "hoy" en España, en formato AAAA-MM-DD (el servidor puede estar en otra zona horaria). */
export function hoyEnEspana() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
}

export async function cargarDatosAgenda() {
  const supabase = await createClient();
  const usuario = await obtenerUsuarioActual();
  const hoy = hoyEnEspana();
  const hoyDate = new Date(`${hoy}T12:00:00Z`);
  const ventana = ventanaConsultaAgenda(hoy);

  const [pendientesRes, hechasRes, hechasPeriodoRes] = await Promise.all([
    supabase
      .from("v_agenda_empleado")
      .select("*")
      .eq("usuario_id", usuario?.id ?? "")
      .in("estado_asignacion", ["pendiente", "en_curso"])
      .order("fecha_programada", { ascending: true, nullsFirst: false }),
    supabase
      .from("v_agenda_empleado")
      .select("*")
      .eq("usuario_id", usuario?.id ?? "")
      .eq("estado_asignacion", "completada")
      .order("fecha_programada", { ascending: false, nullsFirst: false })
      .limit(10),
    supabase
      .from("v_agenda_empleado")
      .select("fecha_programada, estado_asignacion, rol_asignacion")
      .eq("usuario_id", usuario?.id ?? "")
      .eq("estado_asignacion", "completada")
      .gte("fecha_programada", ventana.desde)
      .lte("fecha_programada", ventana.hasta),
  ]);
  lanzarSiError(pendientesRes, hechasRes, hechasPeriodoRes);

  const enriquecer = (p: FilaAgenda, completada = false): FilaEnriquecida => {
    const dias = completada ? 0 : Math.max(0, diasDesdeVencimiento(p.fecha_programada, hoyDate));
    const incidencia = !completada && p.estado_punto === "incidencia";
    const esCritico = !completada && (incidencia || dias >= 7);
    const esAtrasado = !completada && dias >= 1;
    return { ...p, diasRetraso: dias, esCritico, esAtrasado };
  };

  const pendientes = ((pendientesRes.data ?? []) as FilaAgenda[]).map((p) => enriquecer(p, false));
  const hechas = ((hechasRes.data ?? []) as FilaAgenda[]).map((p) => enriquecer(p, true));

  const atrasadasAll = pendientes.filter((p) => p.esAtrasado || p.estado_punto === "incidencia");
  const criticasAll = pendientes.filter((p) => p.esCritico);
  const deHoyAll = pendientes.filter((p) => p.fecha_programada === hoy && !p.esCritico);

  const ahora = new Date();
  const nombrePila = usuario?.nombre.trim().split(/\s+/)[0] ?? null;

  const puntosActivos: PuntoActivoAgenda[] = pendientes
    .filter((p) => p.asignacion_id != null && p.punto_id != null)
    .map((p) => ({
      asignacionId: p.asignacion_id as number,
      puntoId: p.punto_id as number,
      punto: p.punto ?? "Punto",
      campana: p.campana ?? "Campaña",
      direccion: p.direccion,
      latitud: p.latitud,
      longitud: p.longitud,
      rolAsignacion: p.rol_asignacion,
      fechaProgramada: p.fecha_programada,
      esHoy: p.fecha_programada === hoy,
      esAtrasado: p.esAtrasado,
    }));

  const seriesProyeccion = construirSeriesAgenda(
    [
      ...pendientes.map((p) => ({
        fechaProgramada: p.fecha_programada,
        estadoAsignacion: p.estado_asignacion,
        rolAsignacion: p.rol_asignacion,
      })),
      ...(hechasPeriodoRes.data ?? []).map((p) => ({
        fechaProgramada: p.fecha_programada,
        estadoAsignacion: p.estado_asignacion,
        rolAsignacion: p.rol_asignacion,
      })),
    ],
    hoy,
  );

  return {
    usuario,
    hoy,
    ahora,
    nombrePila,
    pendientes,
    hechas,
    atrasadasAll,
    criticasAll,
    deHoyAll,
    puntosActivos,
    seriesProyeccion,
  };
}
