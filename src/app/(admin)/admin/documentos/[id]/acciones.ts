"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { METODOS_COBRO, type MetodoCobro } from "@/lib/documentos";

function refrescar(id?: number) {
  if (id) revalidatePath(`/admin/documentos/${id}`);
  revalidatePath("/admin/documentos");
  revalidatePath("/admin/panel");
}

/**
 * Emite un borrador: la función SQL asigna el número definitivo, copia los
 * datos del cliente y bloquea el documento. No se puede deshacer.
 */
export async function emitirDocumento(documentoId: number, fecha?: string) {
  await exigirAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("emitir_documento", {
    p_doc: documentoId,
    p_fecha: fecha || undefined,
  });
  if (error) throw new Error(error.message);

  refrescar(documentoId);
  return data as string; // número completo asignado
}

/** Presupuesto/albarán → factura, o factura → rectificativa. Devuelve el id nuevo. */
export async function convertirDocumento(
  documentoId: number,
  tipo: "factura" | "rectificativa",
  motivo?: string,
) {
  await exigirAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("convertir_documento", {
    p_origen: documentoId,
    p_tipo: tipo,
    p_motivo: motivo?.trim() || undefined,
  });
  if (error) throw new Error(error.message);

  refrescar(documentoId);
  return data as number;
}

export async function duplicarDocumento(documentoId: number) {
  await exigirAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("duplicar_documento", { p_origen: documentoId });
  if (error) throw new Error(error.message);

  refrescar();
  return data as number;
}

/** Solo los borradores se pueden eliminar; los emitidos quedan por ley. */
export async function eliminarBorrador(documentoId: number) {
  await exigirAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documentos")
    .delete()
    .eq("id", documentoId)
    .eq("estado", "borrador")
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Solo se pueden eliminar documentos en borrador.");
  }

  refrescar();
}

export async function registrarCobro(
  documentoId: number,
  datos: { importe: number; fecha: string; metodo: MetodoCobro; referencia?: string },
) {
  await exigirAdmin();
  const supabase = await createClient();

  if (!Number.isFinite(datos.importe) || datos.importe <= 0) {
    throw new Error("El importe debe ser mayor que cero.");
  }
  if (!METODOS_COBRO.some((m) => m.valor === datos.metodo)) {
    throw new Error("Método de cobro no válido.");
  }

  const { data: estado } = await supabase
    .from("v_estado_cobro")
    .select("pendiente")
    .eq("id", documentoId)
    .maybeSingle();
  if (!estado) throw new Error("Solo se registran cobros de facturas emitidas.");
  if (datos.importe > Number(estado.pendiente) + 0.005) {
    throw new Error("El importe supera lo pendiente de cobro.");
  }

  const { error } = await supabase.from("cobros").insert({
    documento_id: documentoId,
    fecha: datos.fecha,
    importe: Math.round(datos.importe * 100) / 100,
    metodo: datos.metodo,
    referencia: datos.referencia?.trim() || null,
  });
  if (error) throw new Error(error.message);

  refrescar(documentoId);
}

export async function eliminarCobro(documentoId: number, cobroId: number) {
  await exigirAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("cobros")
    .delete()
    .eq("id", cobroId)
    .eq("documento_id", documentoId);
  if (error) throw new Error(error.message);

  refrescar(documentoId);
}
