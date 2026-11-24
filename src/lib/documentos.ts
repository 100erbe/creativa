// Etiquetas en castellano para los enums de documentos y cobros.

import { DIAS_RIESGO_CRITICO, diasEntre, hoyEnEspana, vencimientoEfectivo } from "./estado-cuenta";

/** Suma días a una fecha AAAA-MM-DD. */
export function sumarDias(fecha: string, dias: number) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Opciones rápidas de vencimiento en días para la ficha del cliente. */
export const PLAZOS_VENCIMIENTO_PRESET = [0, 15, 30, 60, 90] as const;

export type OrigenVencimiento = "cliente" | "forma_pago" | "general";

/**
 * Resuelve el vencimiento por defecto cuando el borrador no fija plazo ni fecha manual.
 * Misma prioridad que `emitir_documento` en SQL: ficha del cliente > forma de pago > ajuste general.
 */
export function resolverVencimientoDefecto(args: {
  diasCliente: number | null | undefined;
  diasFormaPago: number | null | undefined;
  diasGeneral: number;
}): { dias: number; origen: OrigenVencimiento } {
  if (args.diasCliente != null) return { dias: args.diasCliente, origen: "cliente" };
  if (args.diasFormaPago != null) return { dias: args.diasFormaPago, origen: "forma_pago" };
  return { dias: args.diasGeneral, origen: "general" };
}

export function etiquetaDiasVencimiento(dias: number): string {
  if (dias === 0) return "Al contado (0 días)";
  return `${dias} ${dias === 1 ? "día" : "días"}`;
}

/**
 * Texto de pago de un documento: la plantilla de la forma de pago, con «{plazo}» sustituido por
 * «a N días fecha factura» (plazo elegido) o «antes del dd/mm/aaaa» (fecha puesta a mano).
 * Es el mismo cálculo que hace la base de datos al emitir; aquí sirve para ver cómo quedará en el borrador.
 */
export function textoFormaPago(plantilla: string, plazoDias: number | null, vencimiento: string) {
  const [a, m, d] = vencimiento.split("-");
  return plantilla.replace("{plazo}", plazoDias ? `a ${plazoDias} días fecha factura` : `antes del ${d}/${m}/${a}`);
}

export const ETIQUETA_TIPO: Record<string, string> = {
  presupuesto: "Presupuesto",
  albaran: "Albarán",
  factura: "Factura",
  rectificativa: "Rectificativa",
  recibo: "Recibo",
};

export const ETIQUETA_ESTADO_DOC: Record<string, string> = {
  borrador: "Borrador",
  emitido: "Emitido",
  enviado: "Enviado",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
  caducado: "Caducado",
  facturado: "Facturado",
  sustituido: "Sustituido",
  anulado: "Anulado",
};

/**
 * Presupuesto emitido o enviado cuyo «válido hasta» ya pasó y nadie ha marcado aún como aceptado,
 * rechazado o caducado. Se calcula al vuelo (no cambia el estado guardado).
 */
export function validezVencida(tipo: string, estado: string, validoHasta: string | null, hoy = new Date()) {
  if (tipo !== "presupuesto" || !validoHasta || (estado !== "emitido" && estado !== "enviado")) return false;
  return validoHasta < hoyEnEspana(hoy);
}

export const ETIQUETA_COBRO: Record<string, string> = {
  cobrada: "Cobrada",
  pendiente: "Pendiente de cobro",
  parcial: "Cobro parcial",
  vencida: "Vencida",
  vencida_90: "Vencida 90+ días",
};

export type TramoAging = "al_dia" | "vencida_30" | "vencida_60" | "critica_90";

export type ResultadoAging = {
  tramo: TramoAging;
  diasVencido: number;
  esCritica90: boolean;
};

/** Días transcurridos desde `fechaReferencia` (AAAA-MM-DD) hasta `hoy` en hora de España. Negativo o 0 si no ha llegado. */
export function diasDesdeVencimiento(fechaVencimiento: string | null | undefined, hoy = new Date()): number {
  if (!fechaVencimiento) return 0;
  const iso = fechaVencimiento.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 0;
  return diasEntre(iso, hoyEnEspana(hoy));
}

/**
 * Clasifica una factura o abono positivo pendiente por los días desde su vencimiento (1–30, 31–90, >90).
 * Sin `fechaVencimiento` se usa la emisión + DIAS_VENCIMIENTO_DEFECTO (misma regla que el estado de cuenta).
 */
export function clasificarAgingCobro(
  estadoCobro: string | null | undefined,
  fechaVencimiento: string | null | undefined,
  hoy = new Date(),
  fechaEmision?: string | null,
): ResultadoAging {
  if (!estadoCobro || estadoCobro === "cobrada") {
    return { tramo: "al_dia", diasVencido: 0, esCritica90: false };
  }
  const vencimiento = fechaVencimiento || (fechaEmision ? vencimientoEfectivo(fechaEmision, null) : null);
  if (vencimiento) {
    const dias = diasDesdeVencimiento(vencimiento, hoy);
    if (dias > DIAS_RIESGO_CRITICO) {
      return { tramo: "critica_90", diasVencido: dias, esCritica90: true };
    }
    if (dias >= 31) {
      return { tramo: "vencida_60", diasVencido: dias, esCritica90: false };
    }
    if (dias >= 1 || estadoCobro === "vencida") {
      return { tramo: "vencida_30", diasVencido: Math.max(1, dias), esCritica90: false };
    }
    return { tramo: "al_dia", diasVencido: 0, esCritica90: false };
  }
  return { tramo: "al_dia", diasVencido: 0, esCritica90: false };
}

export const METODOS_COBRO = [
  { valor: "transferencia", etiqueta: "Transferencia" },
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "tarjeta", etiqueta: "Tarjeta" },
  { valor: "bizum", etiqueta: "Bizum" },
  { valor: "compensacion", etiqueta: "Compensación" },
  { valor: "otro", etiqueta: "Otro" },
] as const;

export type MetodoCobro = (typeof METODOS_COBRO)[number]["valor"];

/** Alcance de una línea, tal como se escribe en las facturas de Creativa. */
export const ETIQUETA_ALCANCE: Record<string, string> = {
  fabricacion: "Fabricación",
  instalacion: "Instalación",
  fabricacion_instalacion: "Fabr. & Instal.",
};

/** Etiqueta corta de unidad de venta para listados y fichas. */
export const ETIQUETA_UNIDAD: Record<string, string> = {
  ud: "ud",
  m2: "m²",
  ml: "ml",
  millar: "millar",
  mes: "mes",
  servicio: "serv.",
  km: "km",
};

/** Prefijo del nombre de archivo al guardar el PDF ("FAC 0139.26 Cliente"). */
export const PREFIJO_ARCHIVO: Record<string, string> = {
  factura: "FAC",
  rectificativa: "ABONO",
  presupuesto: "PRES",
  albaran: "ALB",
  recibo: "REC",
};
