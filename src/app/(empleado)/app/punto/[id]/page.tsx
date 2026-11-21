import { notFound } from "next/navigation";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { esGeometriaZona, esTipoUbicacion, type TipoUbicacion } from "@/lib/mapa/zonas";
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

  const resultados = await Promise.all([
    supabase
      .from("puntos_campana")
      .select(
        "id, nombre, tipo_soporte, direccion, latitud, longitud, tipo_ubicacion, radio_metros, geometria, estado, notas, incidencia, piezas, fecha_colocacion_prevista, fecha_retirada_prevista, campana_id, campanas(nombre, descripcion)",
      )
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
      .select("id, tipo, url_foto, tomada_en, usuario_id, latitud, longitud, origen_foto, origen_ubicacion")
      .eq("punto_id", puntoId)
      .order("tomada_en", { ascending: false }),
  ]);

  // "No se encuentra" (PGRST116) es un 404 normal; cualquier otro fallo es un error de verdad.
  if (resultados[0].error?.code !== "PGRST116") lanzarSiError(...resultados);
  const [{ data: punto }, { data: asignacion }, { data: fotos }] = resultados;

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
      punto={{
        ...punto,
        latitud: Number(punto.latitud),
        longitud: Number(punto.longitud),
        tipo_ubicacion: esTipoUbicacion(punto.tipo_ubicacion) ? punto.tipo_ubicacion : ("punto" as TipoUbicacion),
        radio_metros: punto.radio_metros == null ? null : Number(punto.radio_metros),
        geometria: esGeometriaZona(punto.geometria) ? punto.geometria : null,
      }}
      asignacion={asignacion}
      fotos={fotosConUrl}
      usuarioId={usuario?.id ?? null}
      esAdmin={usuario?.rol === "admin"}
    />
  );
}
