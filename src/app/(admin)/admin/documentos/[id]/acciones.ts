"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { METODOS_COBRO, type MetodoCobro } from "@/lib/documentos";
import { accion } from "@/lib/accion";

function refrescar(id?: number) {
  if (id) revalidatePath(`/admin/documentos/${id}`);
  revalidatePath("/admin/documentos");
  revalidatePath("/admin/panel");
}

/**
 * Emite un borrador: la función SQL asigna el número definitivo, copia los
 * datos del cliente y bloquea el documento. No se puede deshacer.
 */
export const emitirDocumento = accion(async (documentoId: number, fecha?: string) => {
  await exigirAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("emitir_documento", {
    p_doc: documentoId,
    p_fecha: fecha || undefined,
  });
  if (error) throw new Error(error.message);

  refrescar(documentoId);
  return data as string; // número completo asignado
});

/** Presupuesto/albarán → factura, o factura → rectificativa. Devuelve el id nuevo. */
export const convertirDocumento = accion(async (
  documentoId: number,
  tipo: "factura" | "rectificativa",
  motivo?: string,
) => {
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
});

/**
 * Versión nueva de un presupuesto emitido: un borrador enlazado para modificarlo y reenviarlo.
 * Al emitirla, el presupuesto anterior pasa a «Sustituido». Si ya hay una en borrador, devuelve esa.
 */
export const nuevaVersionPresupuesto = accion(async (documentoId: number) => {
  await exigirAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("nueva_version_presupuesto", { p_origen: documentoId });
  if (error) throw new Error(error.message);

  refrescar(documentoId);
  return data as number;
});

export const duplicarDocumento = accion(async (documentoId: number) => {
  await exigirAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("duplicar_documento", { p_origen: documentoId });
  if (error) throw new Error(error.message);

  refrescar();
  return data as number;
});

/** Solo los borradores se pueden eliminar; los emitidos quedan por ley. */
export const eliminarBorrador = accion(async (documentoId: number) => {
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
});

export const registrarCobro = accion(async (
  documentoId: number,
  datos: { importe: number; fecha: string; metodo: MetodoCobro; referencia?: string },
) => {
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
});

export const eliminarCobro = accion(async (documentoId: number, cobroId: number) => {
  await exigirAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("cobros")
    .delete()
    .eq("id", cobroId)
    .eq("documento_id", documentoId);
  if (error) throw new Error(error.message);

  refrescar(documentoId);
});

// ---------------------------------------------------------------------
//  Estado del presupuesto y condiciones del documento
// ---------------------------------------------------------------------

const ESTADOS_PRESUPUESTO = ["emitido", "enviado", "aceptado", "rechazado", "caducado"] as const;
export type EstadoPresupuesto = (typeof ESTADOS_PRESUPUESTO)[number];

/**
 * Seguimiento comercial de un presupuesto emitido: enviado → aceptado / rechazado / caducado
 * (y "emitido" para deshacerlo). Los presupuestos facturados o anulados ya no cambian.
 */
export const cambiarEstadoPresupuesto = accion(async (documentoId: number, estado: EstadoPresupuesto) => {
  await exigirAdmin();
  if (!ESTADOS_PRESUPUESTO.includes(estado)) throw new Error("Estado no válido.");
  const supabase = await createClient();

  const { data: doc } = await supabase.from("documentos").select("tipo, estado").eq("id", documentoId).maybeSingle();
  if (!doc) throw new Error("No se ha encontrado el documento.");
  if (doc.tipo !== "presupuesto") throw new Error("Solo los presupuestos tienen este seguimiento.");
  if (!(ESTADOS_PRESUPUESTO as readonly string[]).includes(doc.estado)) {
    throw new Error("Este presupuesto ya no admite cambios de estado.");
  }

  const { error } = await supabase
    .from("documentos")
    .update(estado === "enviado" ? { estado, enviado_en: new Date().toISOString() } : { estado })
    .eq("id", documentoId);
  if (error) throw new Error(error.message);

  refrescar(documentoId);
});

export type DatosCabecera = {
  fechaVencimiento: string;
  /** Plazo elegido entre los de la forma de pago (cuenta desde la fecha de emisión); anula la fecha de vencimiento. */
  plazoDias: number | null;
  validoHasta: string;
  formaPagoId: number | null;
  descuentoGlobalPct: number;
  retencionPct: number;
  campana: string;
  descripcion: string;
  notasCliente: string;
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Condiciones de un borrador. Los totales se recalculan solos en la base de datos. */
export const guardarCabecera = accion(async (documentoId: number, d: DatosCabecera) => {
  await exigirAdmin();
  for (const [nombre, valor] of [
    ["descuento global", d.descuentoGlobalPct],
    ["retención", d.retencionPct],
  ] as const) {
    if (!Number.isFinite(valor) || valor < 0 || valor > 100) throw new Error(`La ${nombre} va de 0 a 100 %.`);
  }
  for (const f of [d.fechaVencimiento, d.validoHasta]) {
    if (f && !FECHA.test(f)) throw new Error("Fecha no válida.");
  }
  const supabase = await createClient();

  // Solo vale un plazo que la forma de pago elegida ofrezca.
  let plazo: number | null = null;
  if (d.plazoDias && d.formaPagoId) {
    const { data: forma } = await supabase.from("formas_pago").select("plazos_dias").eq("id", d.formaPagoId).maybeSingle();
    if (forma?.plazos_dias.includes(d.plazoDias)) plazo = d.plazoDias;
  }

  const { data: doc } = await supabase.from("documentos").select("fecha, estado").eq("id", documentoId).maybeSingle();
  if (!doc) throw new Error("No se ha encontrado el documento.");
  if (doc.estado !== "borrador") throw new Error("Solo se pueden editar los documentos en borrador.");
  if (d.fechaVencimiento && d.fechaVencimiento < doc.fecha) {
    throw new Error("El vencimiento no puede ser anterior a la fecha del documento.");
  }
  if (d.validoHasta && d.validoHasta < doc.fecha) {
    throw new Error("«Válido hasta» no puede ser anterior a la fecha del documento.");
  }

  const { error } = await supabase
    .from("documentos")
    .update({
      fecha_vencimiento: plazo ? null : d.fechaVencimiento || null,
      plazo_dias: plazo,
      valido_hasta: d.validoHasta || null,
      forma_pago_id: d.formaPagoId,
      // Al emitir, el texto de pago se copia de la forma de pago elegida.
      texto_forma_pago: null,
      descuento_global_pct: d.descuentoGlobalPct,
      retencion_pct: d.retencionPct,
      campana: d.campana.trim() || null,
      descripcion: d.descripcion.trim() || null,
      notas_cliente: d.notasCliente.trim() || null,
    })
    .eq("id", documentoId)
    .eq("estado", "borrador");
  if (error) throw new Error(error.message);

  refrescar(documentoId);
});

/**
 * Elimina los borradores sin ninguna línea (los que deja el asistente al salir sin seguir).
 * Los de la última hora se respetan: pueden ser un documento que se está creando ahora.
 */
export const eliminarBorradoresVacios = accion(async () => {
  await exigirAdmin();
  const supabase = await createClient();

  const limite = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("documentos")
    .select("id, lineas_documento(id)")
    .eq("estado", "borrador")
    .lt("creado_en", limite);
  if (error) throw new Error(error.message);

  const ids = (data ?? []).filter((d) => (d.lineas_documento ?? []).length === 0).map((d) => d.id);
  if (ids.length === 0) return 0;

  const { error: errorBorrado } = await supabase.from("documentos").delete().in("id", ids).eq("estado", "borrador");
  if (errorBorrado) throw new Error(errorBorrado.message);

  refrescar();
  return ids.length;
});
