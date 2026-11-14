"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Paso 1 → 2: crea el borrador y lleva al asistente de líneas.
 * Usa la serie marcada "por_defecto" para presupuestos.
 */
export async function crearBorrador(clienteId: number) {
  const supabase = await createClient();

  const { data: serie, error: errorSerie } = await supabase
    .from("series")
    .select("id")
    .eq("tipo", "presupuesto")
    .eq("por_defecto", true)
    .single();

  if (errorSerie || !serie) {
    throw new Error("No hay una serie por defecto configurada para presupuestos.");
  }

  const { data, error } = await supabase
    .from("documentos")
    .insert({ tipo: "presupuesto", serie_id: serie.id, cliente_id: clienteId })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  return data.id as number;
}

/**
 * Añade una línea resolviendo cantidad y precio en la base de datos
 * (función anadir_linea_rapida, ver supabase/migrations/0004_...sql).
 * El admin nunca escribe un precio a mano.
 */
export async function anadirLineaRapida(args: {
  documentoId: number;
  clienteId: number;
  productoId: number;
  formatoId: number | null;
  alcance: "fabricacion" | "instalacion" | "fabricacion_instalacion";
  piezas?: number;
  anchoCm?: number;
  altoCm?: number;
  acabados?: number[];
  descripcion?: string;
}) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("anadir_linea_rapida", {
    p_documento: args.documentoId,
    p_producto: args.productoId,
    p_formato: args.formatoId,
    p_cliente: args.clienteId,
    p_alcance: args.alcance,
    p_piezas: args.piezas ?? 1,
    p_ancho_cm: args.anchoCm ?? null,
    p_alto_cm: args.altoCm ?? null,
    p_acabados: args.acabados ?? null,
    p_descripcion: args.descripcion ?? null,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/documentos/nuevo");
}

export async function eliminarLinea(lineaId: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("lineas_documento").delete().eq("id", lineaId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/documentos/nuevo");
}

export async function duplicarUltimoDocumento(documentoOrigenId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicar_documento", {
    p_origen: documentoOrigenId,
  });
  if (error) throw new Error(error.message);
  return data as number;
}

export async function actualizarOpcionesDocumento(
  documentoId: number,
  cambios: { campana_id?: number | null; forma_pago_id?: number | null },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("documentos").update(cambios).eq("id", documentoId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/documentos/nuevo");
}
