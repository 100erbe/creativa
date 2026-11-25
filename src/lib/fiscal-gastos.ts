import { CONCEPTOS_SIN_FACTURA, cuotaDeducible, trimestreDe } from "@/lib/gastos";
import { redondearCentimos } from "@/lib/redondeo";

/** Campos de un gasto que usa la lectura fiscal por trimestre. */
export type GastoFiscal = {
  id: number;
  fecha: string;
  tipo: "deducible" | "menor";
  estado: "pendiente" | "aprobado" | "reembolsado" | "rechazado";
  total: number | string;
  base_imponible: number | string | null;
  cuota_iva: number | string | null;
  iva_pct: number | string | null;
  pct_deducible_iva: number | string;
  bien_inversion: boolean;
  retencion_pct: number | string;
  importe_retencion: number | string;
  proveedor: string | null;
  nif_proveedor: string | null;
  numero_factura: string | null;
  ticket_path: string | null;
  concepto_aeat: string | null;
};

const n = (v: number | string | null | undefined) => Number(v) || 0;
const r2 = redondearCentimos;

/** Cuenta para impuestos: deducible ya aprobado o reembolsado (lo mismo que v_gastos_iva_trimestral). */
export const cuentaParaImpuestos = (g: GastoFiscal) =>
  g.tipo === "deducible" && (g.estado === "aprobado" || g.estado === "reembolsado");

/** Nóminas y Seguridad Social: no son facturas, no llevan IVA ni NIF de expedidor en el libro. */
export const esSinFactura = (g: Pick<GastoFiscal, "concepto_aeat">) =>
  !!g.concepto_aeat && (CONCEPTOS_SIN_FACTURA as readonly string[]).includes(g.concepto_aeat);

export const sinNumero = (g: Pick<GastoFiscal, "numero_factura">) =>
  !g.numero_factura || /^s\s*\/?\s*n$/i.test(g.numero_factura.trim());

/** Gasto fiscalmente deducible en el IRPF: base + IVA no deducible. Los bienes de inversión se amortizan aparte. */
export const gastoDeducibleIrpf = (g: GastoFiscal) =>
  g.bien_inversion ? 0 : r2(n(g.base_imponible) + n(g.cuota_iva) - cuotaDeducible(n(g.cuota_iva), n(g.pct_deducible_iva)));

export type FilaIva = { iva_pct: number; base: number; cuota: number; deducible: number; n: number };

export type ResumenTrimestre = {
  ejercicio: number;
  trimestre: number;
  /** IVA soportado por tipo, separado en operaciones corrientes y bienes de inversión. */
  corrientes: FilaIva[];
  inversion: FilaIva[];
  /** Casillas 28–31 del 303 (base de la parte deducible y cuota deducible). */
  casillas: { c28: number; c29: number; c30: number; c31: number };
  /** Modelo 111: retenciones practicadas a profesionales en el trimestre. */
  retenciones: { perceptores: number; base: number; importe: number };
  /** Gasto deducible para el 130: del trimestre y acumulado desde el 1 de enero. */
  gastoIrpf: { trimestre: number; acumulado: number };
  gastosMenores: number;
  nFiscales: number;
};

export function resumirTrimestre(gastosAnio: GastoFiscal[], ejercicio: number, trimestre: number): ResumenTrimestre {
  const delAnio = gastosAnio.filter((g) => g.fecha.startsWith(String(ejercicio)));
  const delTrimestre = delAnio.filter((g) => trimestreDe(g.fecha) === trimestre);
  const fiscales = delTrimestre.filter(cuentaParaImpuestos);

  const agrupar = (filas: GastoFiscal[]) => {
    const mapa = new Map<number, FilaIva>();
    for (const g of filas) {
      if (esSinFactura(g)) continue; // las nóminas no son IVA soportado
      const pct = n(g.iva_pct);
      const fila = mapa.get(pct) ?? { iva_pct: pct, base: 0, cuota: 0, deducible: 0, n: 0 };
      fila.base = r2(fila.base + n(g.base_imponible));
      fila.cuota = r2(fila.cuota + n(g.cuota_iva));
      fila.deducible = r2(fila.deducible + cuotaDeducible(n(g.cuota_iva), n(g.pct_deducible_iva)));
      fila.n += 1;
      mapa.set(pct, fila);
    }
    return [...mapa.values()].sort((a, b) => b.iva_pct - a.iva_pct);
  };
  const corrientes = agrupar(fiscales.filter((g) => !g.bien_inversion));
  const inversion = agrupar(fiscales.filter((g) => g.bien_inversion));

  // Casilla de base: la base que corresponde a la parte deducible (p. ej. el 50 % en un turismo).
  const baseDeducible = (filas: GastoFiscal[]) =>
    r2(
      filas
        .filter((g) => !esSinFactura(g) && n(g.cuota_iva) > 0)
        .reduce((s, g) => s + (n(g.base_imponible) * n(g.pct_deducible_iva)) / 100, 0),
    );
  const sumaDeducible = (filas: FilaIva[]) => r2(filas.reduce((s, f) => s + f.deducible, 0));

  const conRetencion = fiscales.filter((g) => n(g.importe_retencion) > 0);
  const hastaFin = delAnio.filter((g) => trimestreDe(g.fecha) <= trimestre && cuentaParaImpuestos(g));

  return {
    ejercicio,
    trimestre,
    corrientes,
    inversion,
    casillas: {
      c28: baseDeducible(fiscales.filter((g) => !g.bien_inversion)),
      c29: sumaDeducible(corrientes),
      c30: baseDeducible(fiscales.filter((g) => g.bien_inversion)),
      c31: sumaDeducible(inversion),
    },
    retenciones: {
      perceptores: new Set(conRetencion.map((g) => (g.nif_proveedor || g.proveedor || "").trim().toUpperCase())).size,
      base: r2(conRetencion.reduce((s, g) => s + n(g.base_imponible), 0)),
      importe: r2(conRetencion.reduce((s, g) => s + n(g.importe_retencion), 0)),
    },
    gastoIrpf: {
      trimestre: r2(fiscales.reduce((s, g) => s + gastoDeducibleIrpf(g), 0)),
      acumulado: r2(hastaFin.reduce((s, g) => s + gastoDeducibleIrpf(g), 0)),
    },
    gastosMenores: r2(
      delTrimestre
        .filter((g) => g.tipo === "menor" && (g.estado === "aprobado" || g.estado === "reembolsado"))
        .reduce((s, g) => s + n(g.total), 0),
    ),
    nFiscales: fiscales.length,
  };
}

/** Problemas que conviene resolver antes de presentar el trimestre. La clave es el filtro ?revision= del listado. */
export const REVISIONES = {
  pendiente: "Pendientes de aprobar (no cuentan para impuestos)",
  sin_ticket: "Deducibles sin factura adjunta",
  sin_nif: "Facturas sin NIF del proveedor",
  sin_numero: "Facturas sin número (S/N)",
  sin_concepto: "Sin concepto fiscal (libro AEAT)",
} as const;
export type Revision = keyof typeof REVISIONES;

export function cumpleRevision(g: GastoFiscal, r: Revision): boolean {
  if (g.tipo !== "deducible" || g.estado === "rechazado") return false;
  switch (r) {
    case "pendiente":
      return g.estado === "pendiente";
    case "sin_ticket":
      return !g.ticket_path;
    case "sin_nif":
      return !esSinFactura(g) && !g.nif_proveedor?.trim();
    case "sin_numero":
      return !esSinFactura(g) && sinNumero(g);
    case "sin_concepto":
      return !g.bien_inversion && !g.concepto_aeat;
  }
}

export function contarRevisiones(gastos: GastoFiscal[]) {
  return (Object.keys(REVISIONES) as Revision[]).map((clave) => ({
    clave,
    etiqueta: REVISIONES[clave],
    n: gastos.filter((g) => cumpleRevision(g, clave)).length,
  }));
}
