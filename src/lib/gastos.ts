import type { TonoInsignia } from "@/components/ui/insignia";

export const TIPOS_GASTO = ["deducible", "menor"] as const;
export type TipoGasto = (typeof TIPOS_GASTO)[number];

export const ESTADOS_GASTO = ["pendiente", "aprobado", "reembolsado", "rechazado"] as const;
export type EstadoGasto = (typeof ESTADOS_GASTO)[number];

export const FORMAS_PAGO_GASTO = ["efectivo", "tarjeta_empresa", "caja_chica", "transferencia"] as const;
export type FormaPagoGasto = (typeof FORMAS_PAGO_GASTO)[number];

/**
 * Tipos de IVA del modelo v11 (21 %, 10 %, 4 %) más el 0 %: operaciones no sujetas
 * (nóminas, art. 7.5 Ley 37/1992) o exentas (seguros, art. 20.Uno.16º).
 */
export const TIPOS_IVA = [21, 10, 4, 0] as const;

export function etiquetaTipoIva(pct: number) {
  return pct === 0 ? "0 % (no sujeto / exento)" : `${pct} %`;
}

export const ETIQUETA_TIPO_GASTO: Record<TipoGasto, string> = {
  deducible: "Deducible",
  menor: "Gasto menor",
};

export const ETIQUETA_ESTADO_GASTO: Record<EstadoGasto, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  reembolsado: "Reembolsado",
  rechazado: "Rechazado",
};

export const TONO_ESTADO_GASTO: Record<EstadoGasto, TonoInsignia> = {
  pendiente: "aviso",
  aprobado: "info",
  reembolsado: "exito",
  rechazado: "peligro",
};

export const ETIQUETA_FORMA_PAGO_GASTO: Record<FormaPagoGasto, string> = {
  efectivo: "Efectivo",
  tarjeta_empresa: "Tarjeta empresa",
  caja_chica: "Caja chica",
  transferencia: "Transferencia",
};

export const BUCKET_TICKETS = "tickets-gastos";

const redondear = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** A partir del total con IVA incluido: base = total / (1 + iva), cuota = total − base. */
export function calcularIva(total: number, ivaPct: number) {
  const base = redondear(total / (1 + ivaPct / 100));
  return { base, cuota: redondear(total - base) };
}

/** "145,20" o "145.20" → 145.2; null si no es un número. */
export function aNumero(texto: string | null | undefined): number | null {
  if (texto == null || texto.trim() === "") return null;
  const n = Number(texto.trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
