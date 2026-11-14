import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { MapaAgenda } from "./mapa-agenda";

export const dynamic = "force-dynamic";

export default async function PaginaMapa() {
  const supabase = await createClient();
  const usuario = await obtenerUsuarioActual();

  const { data: agenda } = await supabase
    .from("v_agenda_empleado")
    .select("*")
    .eq("usuario_id", usuario?.id)
    .in("estado_asignacion", ["pendiente", "en_curso"]);

  return <MapaAgenda puntos={agenda ?? []} />;
}
