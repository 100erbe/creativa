import { lanzarSiError } from "@/lib/supabase/consulta";
import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { esGeometriaZona, esTipoUbicacion, type TipoUbicacion } from "@/lib/mapa/zonas";
import { MapaAgenda } from "./mapa-agenda";

export const dynamic = "force-dynamic";

export default async function PaginaMapa() {
  const supabase = await createClient();
  const usuario = await obtenerUsuarioActual();

  const [resAgenda, resOtros] = await Promise.all([
    supabase
      .from("v_agenda_empleado")
      .select("*")
      .eq("usuario_id", usuario?.id ?? "")
      .in("estado_asignacion", ["pendiente", "en_curso"]),
    supabase.rpc("obtener_otros_puntos_campanas_empleado"),
  ]);

  lanzarSiError(resAgenda, resOtros);

  // La vista devuelve columnas anulables; solo se mapean los puntos completos.
  const puntos = (resAgenda.data ?? []).flatMap((p) =>
    p.punto_id != null &&
    p.punto != null &&
    p.latitud != null &&
    p.longitud != null &&
    p.estado_punto != null
      ? [
          {
            punto_id: p.punto_id,
            campana_id: p.campana_id,
            punto: p.punto,
            latitud: Number(p.latitud),
            longitud: Number(p.longitud),
            estado_punto: p.estado_punto,
            campana: p.campana,
            tipo_soporte: p.tipo_soporte,
            direccion: p.direccion,
            fecha_programada: p.fecha_programada,
            rol_asignacion: p.rol_asignacion,
            tipo_ubicacion: esTipoUbicacion(p.tipo_ubicacion) ? p.tipo_ubicacion : ("punto" as TipoUbicacion),
            radio_metros: p.radio_metros == null ? null : Number(p.radio_metros),
            geometria: esGeometriaZona(p.geometria) ? p.geometria : null,
          },
        ]
      : [],
  );

  const otrosPuntos = (resOtros.data ?? []).map((p) => ({
    punto_id: p.punto_id,
    campana_id: p.campana_id,
    campana: p.campana,
    punto: p.punto,
    direccion: p.direccion,
    latitud: Number(p.latitud),
    longitud: Number(p.longitud),
    tipo_ubicacion: esTipoUbicacion(p.tipo_ubicacion) ? p.tipo_ubicacion : ("punto" as TipoUbicacion),
    radio_metros: p.radio_metros == null ? null : Number(p.radio_metros),
    geometria: esGeometriaZona(p.geometria) ? p.geometria : null,
  }));

  return <MapaAgenda puntos={puntos} otrosPuntos={otrosPuntos} />;
}
