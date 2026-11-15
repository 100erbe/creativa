import { lanzarSiError } from "@/lib/supabase/consulta";
import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { MapaAgenda } from "./mapa-agenda";

export const dynamic = "force-dynamic";

export default async function PaginaMapa() {
  const supabase = await createClient();
  const usuario = await obtenerUsuarioActual();

  const { data: agenda, error } = await supabase
    .from("v_agenda_empleado")
    .select("*")
    .eq("usuario_id", usuario?.id ?? "")
    .in("estado_asignacion", ["pendiente", "en_curso"]);

  lanzarSiError({ error });

  // La vista devuelve columnas anulables; solo se mapean los puntos completos.
  const puntos = (agenda ?? []).flatMap((p) =>
    p.punto_id != null &&
    p.punto != null &&
    p.latitud != null &&
    p.longitud != null &&
    p.estado_punto != null
      ? [
          {
            punto_id: p.punto_id,
            punto: p.punto,
            latitud: p.latitud,
            longitud: p.longitud,
            estado_punto: p.estado_punto,
          },
        ]
      : [],
  );

  return <MapaAgenda puntos={puntos} />;
}
