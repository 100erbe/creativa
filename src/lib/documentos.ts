// Etiquetas en castellano para los enums de documentos y cobros.

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
  anulado: "Anulado",
};

export const ETIQUETA_COBRO: Record<string, string> = {
  cobrada: "Cobrada",
  pendiente: "Pendiente de cobro",
  parcial: "Cobro parcial",
  vencida: "Vencida",
};

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
