// Etiquetas en castellano para los enums de documentos y cobros.

/** Suma días a una fecha AAAA-MM-DD. */
export function sumarDias(fecha: string, dias: number) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
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
  return validoHasta < hoy.toISOString().slice(0, 10);
}

export const ETIQUETA_COBRO: Record<string, string> = {
  cobrada: "Cobrada",
  pendiente: "Pendiente de cobro",
  parcial: "Cobro parcial",
  vencida: "Vencida",
  vencida_90: "Insoluta 90+ días",
};

export type TramoAging = "al_dia" | "vencida_30" | "vencida_60" | "critica_90";

export type ResultadoAging = {
  tramo: TramoAging;
  diasVencido: number;
  esCritica90: boolean;
};

/** Días transcurridos desde `fechaVencimiento` (AAAA-MM-DD) hasta `hoy`. Negativo o 0 si no ha vencido. */
export function diasDesdeVencimiento(fechaVencimiento: string | null | undefined, hoy = new Date()): number {
  if (!fechaVencimiento) return 0;
  const venc = new Date(`${fechaVencimiento.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(venc.getTime())) return 0;
  const hoyUtc = new Date(`${hoy.toISOString().slice(0, 10)}T12:00:00Z`);
  return Math.floor((hoyUtc.getTime() - venc.getTime()) / 86_400_000);
}

/** Clasifica una factura pendiente/parcial/vencida por su antigüedad desde el vencimiento (aging). */
export function clasificarAgingCobro(
  estadoCobro: string | null | undefined,
  fechaVencimiento: string | null | undefined,
  hoy = new Date(),
): ResultadoAging {
  if (!estadoCobro || estadoCobro === "cobrada") {
    return { tramo: "al_dia", diasVencido: 0, esCritica90: false };
  }
  const dias = diasDesdeVencimiento(fechaVencimiento, hoy);
  if (dias >= 90) {
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

/** Prefijo del nombre de archivo al guardar el PDF ("FAC 0139.26 Cliente"). */
export const PREFIJO_ARCHIVO: Record<string, string> = {
  factura: "FAC",
  rectificativa: "ABONO",
  presupuesto: "PRES",
  albaran: "ALB",
  recibo: "REC",
};
