/**
 * Margen bruto: cálculos compartidos (catálogo, creación de documentos, ficha de cliente, Rentabilidad).
 * Datos internos y aproximados: NUNCA se imprimen ni se envían al cliente.
 */

/** Por debajo de este % el margen se marca en rojo. */
export const MARGEN_BAJO_PCT = 20;
/** Desde el bajo hasta este % se marca en ámbar; a partir de aquí, en verde. */
export const MARGEN_BUENO_PCT = 35;

export type NivelMargen = "bajo" | "medio" | "bueno";

export type Margen = {
  /** € ganados = base − coste */
  beneficio: number;
  /** Margen bruto sobre la base (precio): beneficio / base × 100. null si la base es 0. */
  pct: number | null;
};

const redondear2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Margen de un importe frente a su coste. Devuelve null si falta alguno de los dos
 * (sin coste no hay margen: contarlo a coste 0 daría un falso 100 %).
 */
export function calcularMargen(base: number | null | undefined, coste: number | null | undefined): Margen | null {
  if (base == null || coste == null || !Number.isFinite(base) || !Number.isFinite(coste)) return null;
  const beneficio = redondear2(base - coste);
  const pct = base === 0 ? null : Math.round((beneficio / base) * 1000) / 10;
  return { beneficio, pct };
}

export function nivelMargen(pct: number | null | undefined): NivelMargen | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  if (pct < MARGEN_BAJO_PCT) return "bajo";
  if (pct < MARGEN_BUENO_PCT) return "medio";
  return "bueno";
}

/** "40 %", "16,5 %" */
export function formatoPct(pct: number) {
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(pct)} %`;
}

type CostesCatalogo = {
  costeFabricacion: number | null;
  costeInstalacion: number | null;
};

/**
 * Coste unitario de catálogo según el alcance de la línea, como el precio:
 * fabricación → coste de fabricación (del formato si lo tiene, si no del producto);
 * instalación → coste de instalación del producto (único por artículo);
 * ambos → la suma. Devuelve null si falta alguna parte necesaria.
 */
export function costeUnitarioCatalogo(
  producto: CostesCatalogo,
  formato: { costeFabricacion: number | null } | null | undefined,
  alcance: "fabricacion" | "instalacion" | "fabricacion_instalacion",
): number | null {
  const fab = formato?.costeFabricacion ?? producto.costeFabricacion;
  const inst = producto.costeInstalacion;
  if (alcance === "fabricacion") return fab;
  if (alcance === "instalacion") return inst;
  if (fab == null || inst == null) return null;
  return Math.round((fab + inst) * 10000) / 10000;
}

export type LineaConCoste = {
  /** Importe de la línea tras su descuento, sin IVA (lineas_documento.importe). */
  importe: number;
  cantidad: number;
  coste_unitario: number | null;
};

/** Base de la línea tras el descuento global del documento (como v_margen_lineas). */
export function baseNetaLinea(importe: number, descuentoGlobalPct: number) {
  return redondear2(importe * (1 - (descuentoGlobalPct || 0) / 100));
}

/** Margen de una línea; null si no tiene coste. */
export function margenLinea(l: LineaConCoste, descuentoGlobalPct: number): (Margen & { coste: number }) | null {
  if (l.coste_unitario == null) return null;
  const coste = redondear2(l.cantidad * l.coste_unitario);
  const m = calcularMargen(baseNetaLinea(l.importe, descuentoGlobalPct), coste);
  return m ? { ...m, coste } : null;
}

export type ResumenMargen = Margen & {
  coste: number;
  /** Base de las líneas con coste (la que entra en el %). */
  baseConCoste: number;
  lineasSinCoste: number;
  baseSinCoste: number;
  /** Hay al menos una línea con coste. */
  hayDatos: boolean;
};

/** Suma bases y costes ya calculados (líneas sin coste: coste null, cuentan aparte). */
export function agregarMargen(items: { base: number; coste: number | null }[]): ResumenMargen {
  let baseConCoste = 0;
  let coste = 0;
  let lineasSinCoste = 0;
  let baseSinCoste = 0;
  for (const it of items) {
    if (it.coste == null) {
      lineasSinCoste++;
      baseSinCoste += it.base;
    } else {
      baseConCoste += it.base;
      coste += it.coste;
    }
  }
  baseConCoste = redondear2(baseConCoste);
  coste = redondear2(coste);
  const hayDatos = items.length > lineasSinCoste;
  const m = calcularMargen(baseConCoste, coste) ?? { beneficio: 0, pct: null };
  return {
    ...m,
    pct: hayDatos ? m.pct : null,
    coste,
    baseConCoste,
    lineasSinCoste,
    baseSinCoste: redondear2(baseSinCoste),
    hayDatos,
  };
}

/** Margen del documento sumando las líneas con coste (las que no lo tienen se cuentan aparte). */
export function resumirMargen(lineas: LineaConCoste[], descuentoGlobalPct: number): ResumenMargen {
  return agregarMargen(
    lineas.map((l) => ({
      base: baseNetaLinea(l.importe, descuentoGlobalPct),
      coste: l.coste_unitario == null ? null : redondear2(l.cantidad * l.coste_unitario),
    })),
  );
}
