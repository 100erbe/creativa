import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { ETIQUETA_TIPO } from "@/lib/documentos";

type Cliente = Awaited<ReturnType<typeof createClient>>;

export type ArticuloCampana = {
  /** Id de la línea del documento (lo que guarda `puntos_campana.linea_id`). */
  id: number;
  descripcion: string;
  /** Nombre corto para elegirlo en un menú: producto y formato ("Cartel de papel · Cartel A3"), no el texto largo de la factura. */
  nombre: string;
  artista: string | null;
  piezas: number;
  unidad: string;
  /** Nombre del producto del catálogo (de ahí sale el tipo de soporte). */
  producto: string;
  /** Número del documento al que pertenece ("0139/26") o su tipo si aún es borrador. */
  documento: string;
};

/** Unidades de líneas libres (sin producto del catálogo) que representan servicios o desplazamientos no instalables. */
const UNIDADES_NO_INSTALABLES = new Set(["km", "servicio"]);

/**
 * Determina si una línea de documento corresponde a un artículo instalable/repartible en puntos de campaña.
 * - Si viene del catálogo, manda `productos.instalable_en_campana` (false para kilometraje, portes, comisiones y otros servicios).
 * - Si es un concepto libre sin producto del catálogo, se excluyen unidades de servicio o desplazamiento (`km`, `servicio`).
 */
export function esLineaInstalableEnCampana(linea: {
  unidad: string;
  producto: { instalable_en_campana: boolean } | null;
}): boolean {
  if (linea.producto) {
    return linea.producto.instalable_en_campana;
  }
  return !UNIDADES_NO_INSTALABLES.has(linea.unidad);
}

/**
 * Los artículos instalables de un documento concreto (usado en el paso 3 del asistente de documentos).
 * Excluye conceptos no instalables como kilometraje, portes, montaje como servicio o comisiones.
 */
export async function articulosDeDocumento(
  supabase: Cliente,
  documentoId: number,
): Promise<Omit<ArticuloCampana, "documento">[]> {
  const { data: lineas } = await supabase
    .from("lineas_documento")
    .select("id, descripcion, articulo, artista, piezas, unidad, productos(nombre, instalable_en_campana)")
    .eq("documento_id", documentoId)
    .order("orden");

  return (lineas ?? []).flatMap((l) => {
    const producto = (Array.isArray(l.productos) ? l.productos[0] : l.productos) ?? null;
    if (!esLineaInstalableEnCampana({ unidad: l.unidad, producto })) return [];
    return [
      {
        id: l.id,
        descripcion: l.descripcion,
        nombre: producto?.nombre ? `${producto.nombre}${l.articulo ? ` · ${l.articulo}` : ""}` : l.descripcion,
        artista: l.artista,
        piezas: Number(l.piezas),
        unidad: l.unidad,
        producto: producto?.nombre ?? l.descripcion,
      },
    ];
  });
}

/**
 * Los artículos que se pueden instalar en una campaña: las líneas instalables de los presupuestos, albaranes y facturas
 * vinculados a ella. Ofrecer cualquier otro soporte no tiene sentido: no estará en lo que se factura.
 * Se excluyen las rectificativas (restan), los documentos anulados y los conceptos no instalables (kilometraje, servicios…).
 */
export async function articulosDeCampana(supabase: Cliente, campanaId: number): Promise<ArticuloCampana[]> {
  const [{ data: campana }, { data: vinculados }] = await Promise.all([
    supabase.from("campanas").select("documento_id").eq("id", campanaId).maybeSingle(),
    supabase.from("documentos").select("id").eq("campana_id", campanaId),
  ]);

  const ids = new Set((vinculados ?? []).map((d) => d.id));
  if (campana?.documento_id) ids.add(campana.documento_id);
  if (ids.size === 0) return [];

  const { data: documentos } = await supabase
    .from("documentos")
    .select("id, tipo, estado, numero_completo")
    .in("id", [...ids])
    .neq("estado", "anulado")
    .neq("tipo", "rectificativa");
  const validos = new Map((documentos ?? []).map((d) => [d.id, d]));
  if (validos.size === 0) return [];

  const { data: lineas } = await supabase
    .from("lineas_documento")
    .select("id, documento_id, descripcion, articulo, artista, piezas, unidad, productos(nombre, instalable_en_campana)")
    .in("documento_id", [...validos.keys()])
    .order("documento_id")
    .order("orden");

  return (lineas ?? []).flatMap((l) => {
    const documento = validos.get(l.documento_id);
    const producto = (Array.isArray(l.productos) ? l.productos[0] : l.productos) ?? null;
    if (!esLineaInstalableEnCampana({ unidad: l.unidad, producto })) return [];
    return [
      {
        id: l.id,
        descripcion: l.descripcion,
        nombre: producto?.nombre ? `${producto.nombre}${l.articulo ? ` · ${l.articulo}` : ""}` : l.descripcion,
        artista: l.artista,
        piezas: Number(l.piezas),
        unidad: l.unidad,
        producto: producto?.nombre ?? l.descripcion,
        documento: documento?.numero_completo ?? `${ETIQUETA_TIPO[documento?.tipo ?? ""] ?? "Documento"} (borrador)`,
      },
    ];
  });
}
