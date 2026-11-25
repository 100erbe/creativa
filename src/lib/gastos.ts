import type { TonoInsignia } from "@/lib/tipos-ui";
import { redondearCentimos } from "@/lib/redondeo";

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

/** Formato de la ruta de un ticket: «<uuid de quien lo sube>/<archivo>.<ext>» (igual que el CHECK de la base de datos). */
const RUTA_TICKET = /^[0-9a-f-]{36}\/[A-Za-z0-9_-][A-Za-z0-9._-]*\.(webp|jpg|jpeg|png|pdf)$/;

/** ¿La ruta del ticket tiene el formato esperado (una sola carpeta, sin «..»)? */
export function rutaTicketConFormato(ruta: string): boolean {
  return RUTA_TICKET.test(ruta);
}

/**
 * ¿La ruta del ticket es válida y está en la carpeta de alguna de las personas indicadas?
 * Evita rutas con «..» que apunten a archivos de otra persona.
 */
export function rutaTicketValida(ruta: string, carpetasPermitidas: string[]): boolean {
  if (!RUTA_TICKET.test(ruta)) return false;
  const carpeta = ruta.slice(0, ruta.indexOf("/"));
  return carpetasPermitidas.includes(carpeta);
}

/** Retenciones IRPF habituales en facturas de profesionales (art. 101 LIRPF). */
export const TIPOS_RETENCION = [0, 7, 15, 19] as const;

/** Parte del IVA soportado deducible: 50 % es la presunción para turismos (art. 95.Tres LIVA). */
export const PCT_DEDUCIBLE_IVA = [100, 50, 0] as const;

/**
 * Conceptos de gasto del libro registro AEAT (formato electrónico común, pestaña
 * RECIBIDAS_GASTOS, columna "Concepto de Gasto"). Solo los que usa una actividad
 * como la nuestra; el resto de códigos del diseño siguen siendo válidos en la BD.
 */
export const CONCEPTOS_AEAT = [
  { codigo: "G01", etiqueta: "Compra de existencias / materiales" },
  { codigo: "G03", etiqueta: "Otros consumos de explotación" },
  { codigo: "G04", etiqueta: "Sueldos y salarios" },
  { codigo: "G05", etiqueta: "Seguridad Social a cargo de la empresa" },
  { codigo: "G45", etiqueta: "Seguridad Social del titular" },
  { codigo: "G08", etiqueta: "Dietas y viajes del personal" },
  { codigo: "G10", etiqueta: "Otros gastos de personal" },
  { codigo: "G12", etiqueta: "Arrendamientos y cánones (alquiler, renting)" },
  { codigo: "G13", etiqueta: "Reparaciones y conservación" },
  { codigo: "G14", etiqueta: "Suministro eléctrico" },
  { codigo: "G17", etiqueta: "Telefonía e internet" },
  { codigo: "G18", etiqueta: "Otros suministros" },
  { codigo: "G19", etiqueta: "Servicios de profesionales independientes" },
  { codigo: "G20", etiqueta: "Primas de seguros" },
  { codigo: "G22", etiqueta: "Otros servicios exteriores (transporte, publicidad, subcontratas…)" },
  { codigo: "G24", etiqueta: "Otros gastos financieros (comisiones bancarias)" },
  { codigo: "G26", etiqueta: "Otros tributos deducibles" },
  { codigo: "G37", etiqueta: "Otros conceptos fiscalmente deducibles" },
] as const;

export function etiquetaConceptoAeat(codigo: string | null | undefined) {
  if (!codigo) return null;
  const c = CONCEPTOS_AEAT.find((x) => x.codigo === codigo);
  return c ? `${c.codigo} · ${c.etiqueta}` : codigo;
}

/** Conceptos que no son facturas (nóminas, Seguridad Social): van al libro como "SF", sin IVA. */
export const CONCEPTOS_SIN_FACTURA = ["G04", "G05", "G45", "G10"] as const;

export const trimestreDe = (fecha: string) => Math.ceil(Number(fecha.slice(5, 7)) / 3);

/**
 * Fin del plazo de presentación del 303/130/111 de un trimestre: 20 de abril, julio y octubre;
 * el 4T, 30 de enero del año siguiente. Si cae en fin de semana o festivo la AEAT lo
 * traslada al siguiente día hábil: aquí solo se corre el fin de semana.
 */
export function plazoTrimestre(ejercicio: number, trimestre: number): Date {
  const fecha = trimestre === 4 ? new Date(Date.UTC(ejercicio + 1, 0, 30)) : new Date(Date.UTC(ejercicio, trimestre * 3, 20));
  while (fecha.getUTCDay() === 0 || fecha.getUTCDay() === 6) fecha.setUTCDate(fecha.getUTCDate() + 1);
  return fecha;
}

/** Cuota de IVA deducible de un gasto, según su % deducible. */
export const cuotaDeducible = (cuota: number | null | undefined, pct: number | null | undefined) =>
  redondear((Number(cuota) || 0) * (pct == null ? 100 : Number(pct)) / 100);

export const importeRetencion = (base: number | null | undefined, pct: number | null | undefined) =>
  redondear((Number(base) || 0) * (Number(pct) || 0) / 100);

const redondear = redondearCentimos;

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
