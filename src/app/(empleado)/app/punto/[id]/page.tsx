import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { PanelPunto } from "./panel-punto";

export const dynamic = "force-dynamic";

export default async function PaginaPunto({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const puntoId = Number(id);
  const supabase = await createClient();
  const usuario = await obtenerUsuarioActual();

  const [{ data: punto }, { data: asignacion }, { data: fotos }] = await Promise.all([
    supabase
      .from("puntos_campana")
      .select("id, nombre, tipo_soporte, direccion, latitud, longitud, estado, notas, campana_id, campanas(nombre)")
      .eq("id", puntoId)
      .single(),
    supabase
      .from("asignaciones_punto")
      .select("id, estado, rol_asignacion")
      .eq("punto_id", puntoId)
      .eq("usuario_id", usuario?.id ?? "")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("fotos_punto")
      .select("id, tipo, url_foto, tomada_en, usuario_id")
      .eq("punto_id", puntoId)
      .order("tomada_en", { ascending: false }),
  ]);

  if (!punto) notFound();

  // Genera URLs firmadas (el bucket es privado) para mostrar las fotos ya subidas.
  const fotosConUrl = await Promise.all(
    (fotos ?? []).map(async (f) => {
      const { data } = await supabase.storage
        .from("fotos-puntos")
        .createSignedUrl(f.url_foto, 60 * 60);
      return { ...f, url: data?.signedUrl ?? null };
    }),
  );

  return (
    <PanelPunto
      punto={punto}
      asignacion={asignacion}
      fotos={fotosConUrl}
      usuarioId={usuario?.id ?? null}
      esAdmin={usuario?.rol === "admin"}
    />
  );
}
