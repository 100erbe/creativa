"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { ETIQUETA_CAUSA_RECTIFICACION, METODOS_COBRO, type CausaRectificacion, type MetodoCobro } from "@/lib/documentos";
import { accion } from "@/lib/accion";

function refrescar(id?: number) {
  if (id) revalidatePath(`/admin/documentos/${id}`);
  revalidatePath("/admin/documentos");
  revalidatePath("/admin/cobros");
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/panel");
  revalidatePath("/admin", "layout");
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
  causa?: CausaRectificacion,
) => {
  await exigirAdmin();
  if (tipo === "rectificativa") {
    if (!motivo?.trim()) throw new Error("Indica el motivo de la rectificación.");
    if (!causa || !(causa in ETIQUETA_CAUSA_RECTIFICACION)) throw new Error("Causa de rectificación no válida.");
  }
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("convertir_documento", {
    p_origen: documentoId,
    p_tipo: tipo,
    p_motivo: motivo?.trim() || undefined,
    p_causa: tipo === "rectificativa" ? causa : undefined,
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

/**
 * Anota un cobro (factura) o una devolución al cliente (rectificativa con importe a su favor).
 * El importe llega siempre en positivo; en una rectificativa se guarda en negativo.
 */
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
  if (!FECHA.test(datos.fecha)) throw new Error("Fecha no válida.");

  const { data: estado } = await supabase
    .from("v_estado_cobro")
    .select("pendiente")
    .eq("id", documentoId)
    .maybeSingle();
  if (!estado) throw new Error("Solo se registran cobros de facturas emitidas.");
  const pendiente = Number(estado.pendiente);
  // Pendiente negativo = abono a favor del cliente: lo que se anota es una devolución.
  const signo = pendiente < 0 ? -1 : 1;
  if (datos.importe > Math.abs(pendiente) + 0.005) {
    throw new Error(signo < 0 ? "El importe supera lo pendiente de devolver." : "El importe supera lo pendiente de cobro.");
  }

  const { error } = await supabase.from("cobros").insert({
    documento_id: documentoId,
    fecha: datos.fecha,
    importe: (signo * Math.round(datos.importe * 100)) / 100,
    metodo: datos.metodo,
    referencia: datos.referencia?.trim() || null,
  });
  if (error) throw new Error(error.message);

  refrescar(documentoId);
});

/**
 * Borra un cobro. Si es una compensación, borra también su pareja en el otro documento
 * (la compensación siempre son dos cobros de signo opuesto: no se deja uno suelto).
 */
export const eliminarCobro = accion(async (documentoId: number, cobroId: number) => {
  await exigirAdmin();
  const supabase = await createClient();

  const { data: cobro } = await supabase
    .from("cobros")
    .select("id, importe, metodo, referencia, fecha, documentos(numero_completo)")
    .eq("id", cobroId)
    .eq("documento_id", documentoId)
    .maybeSingle();
  if (!cobro) throw new Error("No se ha encontrado el cobro.");

  let pareja: { id: number; documento_id: number } | null = null;
  if (cobro.metodo === "compensacion" && cobro.referencia) {
    const doc = Array.isArray(cobro.documentos) ? cobro.documentos[0] : cobro.documentos;
    const { data: otro } = await supabase
      .from("documentos")
      .select("id")
      .eq("numero_completo", cobro.referencia)
      .in("tipo", ["factura", "rectificativa"])
      .maybeSingle();
    if (otro && doc?.numero_completo) {
      const { data: candidatos } = await supabase
        .from("cobros")
        .select("id, documento_id")
        .eq("documento_id", otro.id)
        .eq("metodo", "compensacion")
        .eq("referencia", doc.numero_completo)
        .eq("importe", -Number(cobro.importe))
        .eq("fecha", cobro.fecha)
        .limit(1);
      pareja = candidatos?.[0] ?? null;
    }
  }

  const ids = pareja ? [cobro.id, pareja.id] : [cobro.id];
  const { error } = await supabase.from("cobros").delete().in("id", ids);
  if (error) throw new Error(error.message);

  refrescar(documentoId);
  if (pareja) refrescar(pareja.documento_id);
});

/**
 * Compensa una rectificativa (abono) con una factura emitida del mismo cliente: por defecto la
 * que rectifica. Crea dos cobros «Compensación» de signo opuesto; no toca los documentos.
 */
export const compensarRectificativa = accion(async (rectificativaId: number, facturaId?: number, fecha?: string) => {
  await exigirAdmin();
  if (fecha && !FECHA.test(fecha)) throw new Error("Fecha no válida.");
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("compensar_rectificativa", {
    p_rectificativa: rectificativaId,
    p_factura: facturaId ?? undefined,
    p_fecha: fecha || undefined,
  });
  if (error) throw new Error(error.message);

  refrescar(rectificativaId);
  if (facturaId) refrescar(facturaId);
  else {
    const { data: rect } = await supabase.from("documentos").select("documento_origen_id").eq("id", rectificativaId).maybeSingle();
    if (rect?.documento_origen_id) refrescar(rect.documento_origen_id);
  }
  return Number(data);
});

const ESTADOS_ANULABLES = ["emitido", "enviado", "aceptado", "rechazado", "caducado"];

/**
 * Anula un presupuesto o albarán emitido por error. Las facturas nunca se anulan:
 * se corrigen con una rectificativa.
 */
export const anularDocumento = accion(async (documentoId: number, motivo?: string) => {
  await exigirAdmin();
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documentos")
    .select("tipo, estado, numero_completo, notas_internas")
    .eq("id", documentoId)
    .maybeSingle();
  if (!doc) throw new Error("No se ha encontrado el documento.");
  if (doc.tipo === "factura" || doc.tipo === "rectificativa") {
    throw new Error("Una factura no se anula: se corrige con una rectificativa.");
  }
  if (doc.tipo !== "presupuesto" && doc.tipo !== "albaran") throw new Error("Este documento no se puede anular.");
  if (!ESTADOS_ANULABLES.includes(doc.estado)) {
    throw new Error(
      doc.estado === "borrador" ? "Un borrador no se anula: elimínalo." : `No se puede anular un documento ${doc.estado}.`,
    );
  }

  // Un borrador de factura o de versión nueva colgando de este documento lo «resucitaría» al emitirse.
  const { data: derivados } = await supabase
    .from("documentos")
    .select("id, tipo")
    .eq("documento_origen_id", documentoId)
    .eq("estado", "borrador");
  if ((derivados ?? []).length > 0) {
    throw new Error("Hay un borrador (factura o versión nueva) creado desde este documento: elimínalo antes de anular.");
  }

  const nota = `Anulado el ${new Date().toLocaleDateString("es-ES")}${motivo?.trim() ? `: ${motivo.trim()}` : "."}`;
  const { data: anulados, error } = await supabase
    .from("documentos")
    .update({ estado: "anulado", notas_internas: doc.notas_internas ? `${doc.notas_internas}\n${nota}` : nota })
    .eq("id", documentoId)
    .in("estado", ESTADOS_ANULABLES as ("emitido" | "enviado" | "aceptado" | "rechazado" | "caducado")[])
    .select("id");
  if (error) throw new Error(error.message);
  if (!anulados || anulados.length === 0) throw new Error("El documento ha cambiado entre medias: recarga la página.");

  refrescar(documentoId);
});

/** Cierra la revisión pendiente de un documento importado (no cambia ningún importe). */
export const marcarRevisado = accion(async (documentoId: number) => {
  await exigirAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documentos")
    .update({ revisar: false })
    .eq("id", documentoId)
    .eq("revisar", true)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Este documento ya estaba revisado.");

  refrescar(documentoId);
  revalidatePath("/admin", "layout");
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
