import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { ETIQUETA_TIPO } from "@/lib/documentos";

type Cliente = Awaited<ReturnType<typeof createClient>>;

export function etiquetaDocumentoAsociado(d: { tipo: string; numero_completo: string | null }) {
  const tipo = ETIQUETA_TIPO[d.tipo] ?? "Documento";
  return d.numero_completo ? `${tipo} ${d.numero_completo}` : `${tipo} en borrador`;
}

/**
 * Devuelve las etiquetas legibles de los documentos asociados a cada campaña
 * (tanto por `documentos.campana_id` como por `campanas.documento_id`), sin duplicados.
 */
export async function documentosAsociadosACampanas(
  supabase: Cliente,
  campanas: { id: number; documento_id: number | null }[],
): Promise<Map<number, string[]>> {
  const resultado = new Map<number, string[]>();
  if (campanas.length === 0) return resultado;

  const campanaIds = campanas.map((c) => c.id);
  const docIds = [...new Set(campanas.map((c) => c.documento_id).filter((id): id is number => id != null))];

  let consulta = supabase.from("documentos").select("id, tipo, numero_completo, campana_id");
  consulta = docIds.length
    ? consulta.or(`campana_id.in.(${campanaIds.join(",")}),id.in.(${docIds.join(",")})`)
    : consulta.in("campana_id", campanaIds);

  const { data, error } = await consulta.order("id");
  if (error) throw new Error(error.message);

  const docs = data ?? [];
  const docPorId = new Map(docs.map((d) => [d.id, d]));

  for (const c of campanas) {
    const vistos = new Set<number>();
    const etiquetas: string[] = [];

    if (c.documento_id != null) {
      const ref = docPorId.get(c.documento_id);
      if (ref) {
        vistos.add(ref.id);
        etiquetas.push(etiquetaDocumentoAsociado(ref));
      }
    }

    for (const d of docs) {
      if (d.campana_id === c.id && !vistos.has(d.id)) {
        vistos.add(d.id);
        etiquetas.push(etiquetaDocumentoAsociado(d));
      }
    }

    if (etiquetas.length > 0) resultado.set(c.id, etiquetas);
  }

  return resultado;
}
