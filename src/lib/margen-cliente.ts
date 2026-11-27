import { agregarMargen, type ResumenMargen } from "@/lib/margen";

/**
 * Margen bruto de un cliente (ficha de cliente y, en la fase 5, Rentabilidad).
 * Reglas (PIANO_MARGEN_BRUTO.md):
 *  - Real = facturas + rectificativas emitidas (no borrador, no anuladas). Las rectificativas restan.
 *  - Previsto = presupuestos abiertos (emitido / enviado / aceptado). Los facturados ya cuentan en su factura.
 *  - Albaranes fuera (acaban en factura). Líneas sin coste fuera del %, contadas aparte.
 */

/** Fila de v_margen_lineas (más lo que hace falta para mostrarla). */
export type FilaMargen = {
  documento_id: number;
  tipo: string;
  estado: string;
  fecha: string;
  producto_id: number | null;
  descripcion: string;
  cantidad: number;
  unidad: string;
  base_neta: number;
  coste_total: number | null;
};

export type DocumentoMargen = {
  id: number;
  tipo: string;
  numero: string | null;
  fecha: string;
  previsto: boolean;
  resumen: ResumenMargen;
};

export type ProductoMargen = {
  clave: string;
  nombre: string;
  /** Concepto libre (sin producto del catálogo). */
  libre: boolean;
  cantidad: number;
  unidad: string;
  resumen: ResumenMargen;
};

export type MargenCliente = {
  real: ResumenMargen;
  previsto: ResumenMargen;
  /** Más recientes primero. */
  porDocumento: DocumentoMargen[];
  /** Solo margen real; de más a menos beneficio. */
  porProducto: ProductoMargen[];
};

const ESTADOS_PREVISTO = new Set(["emitido", "enviado", "aceptado"]);

export function esMargenReal(tipo: string, estado: string) {
  return (tipo === "factura" || tipo === "rectificativa") && estado !== "borrador" && estado !== "anulado";
}

export function esMargenPrevisto(tipo: string, estado: string) {
  return tipo === "presupuesto" && ESTADOS_PREVISTO.has(estado);
}

const item = (f: FilaMargen) => ({ base: f.base_neta, coste: f.coste_total });

export function calcularMargenCliente(
  filas: FilaMargen[],
  opciones: {
    /** Solo documentos de este año (fecha AAAA-MM-DD); undefined = todo. */
    anio?: number;
    numeros: Map<number, string | null>;
    nombresProducto: Map<number, string>;
  },
): MargenCliente {
  const prefijo = opciones.anio != null ? `${opciones.anio}-` : null;
  const delPeriodo = prefijo ? filas.filter((f) => f.fecha.startsWith(prefijo)) : filas;
  const reales = delPeriodo.filter((f) => esMargenReal(f.tipo, f.estado));
  const previstas = delPeriodo.filter((f) => esMargenPrevisto(f.tipo, f.estado));

  const porDoc = new Map<number, FilaMargen[]>();
  for (const f of [...reales, ...previstas]) porDoc.set(f.documento_id, [...(porDoc.get(f.documento_id) ?? []), f]);
  const porDocumento: DocumentoMargen[] = [...porDoc.entries()]
    .map(([id, lineas]) => {
      const primera = lineas[0]!;
      return {
        id,
        tipo: primera.tipo,
        numero: opciones.numeros.get(id) ?? null,
        fecha: primera.fecha,
        previsto: primera.tipo === "presupuesto",
        resumen: agregarMargen(lineas.map(item)),
      };
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);

  const porProd = new Map<string, { nombre: string; libre: boolean; unidad: string; lineas: FilaMargen[] }>();
  for (const f of reales) {
    const libre = f.producto_id == null;
    const clave = libre ? `libre:${f.descripcion.trim().toLowerCase()}` : `p:${f.producto_id}`;
    const nombre = libre ? f.descripcion.trim() : (opciones.nombresProducto.get(f.producto_id!) ?? f.descripcion);
    const g = porProd.get(clave) ?? { nombre, libre, unidad: f.unidad, lineas: [] };
    g.lineas.push(f);
    porProd.set(clave, g);
  }
  const porProducto: ProductoMargen[] = [...porProd.entries()]
    .map(([clave, g]) => ({
      clave,
      nombre: g.nombre,
      libre: g.libre,
      unidad: g.unidad,
      cantidad: Math.round(g.lineas.reduce((s, l) => s + l.cantidad, 0) * 1000) / 1000,
      resumen: agregarMargen(g.lineas.map(item)),
    }))
    .sort(
      (a, b) =>
        Number(b.resumen.hayDatos) - Number(a.resumen.hayDatos) ||
        b.resumen.beneficio - a.resumen.beneficio ||
        b.resumen.baseSinCoste + b.resumen.baseConCoste - (a.resumen.baseSinCoste + a.resumen.baseConCoste),
    );

  return {
    real: agregarMargen(reales.map(item)),
    previsto: agregarMargen(previstas.map(item)),
    porDocumento,
    porProducto,
  };
}
