import { agregarMargen, type ResumenMargen } from "@/lib/margen";
import { esMargenPrevisto, esMargenReal, type FilaMargen } from "@/lib/margen-cliente";

/**
 * Rentabilidad global (página Rentabilidad y tarjeta del Panel).
 * Mismas reglas que la ficha de cliente (ver margen-cliente.ts).
 */

export type FilaMargenGlobal = FilaMargen & { cliente_id: number };

export const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const item = (f: FilaMargen) => ({ base: f.base_neta, coste: f.coste_total });

export type MesMargen = { mes: number; etiqueta: string; real: ResumenMargen; previsto: ResumenMargen };

/** Los 12 meses del año (aunque estén vacíos), con margen real y previsto. */
export function margenPorMes(filas: FilaMargen[], anio: number): MesMargen[] {
  return MESES.map((etiqueta, i) => {
    const prefijo = `${anio}-${String(i + 1).padStart(2, "0")}-`;
    const delMes = filas.filter((f) => f.fecha.startsWith(prefijo));
    return {
      mes: i + 1,
      etiqueta,
      real: agregarMargen(delMes.filter((f) => esMargenReal(f.tipo, f.estado)).map(item)),
      previsto: agregarMargen(delMes.filter((f) => esMargenPrevisto(f.tipo, f.estado)).map(item)),
    };
  });
}

export type ClienteMargen = { clienteId: number; nombre: string; real: ResumenMargen; previsto: ResumenMargen };

/** Por cliente: primero los que tienen datos de coste, de más a menos beneficio; luego por facturado. */
export function margenPorCliente(filas: FilaMargenGlobal[], nombres: Map<number, string>): ClienteMargen[] {
  const grupos = new Map<number, FilaMargenGlobal[]>();
  for (const f of filas) {
    if (!esMargenReal(f.tipo, f.estado) && !esMargenPrevisto(f.tipo, f.estado)) continue;
    grupos.set(f.cliente_id, [...(grupos.get(f.cliente_id) ?? []), f]);
  }
  const facturado = (r: ResumenMargen) => r.baseConCoste + r.baseSinCoste;
  return [...grupos.entries()]
    .map(([clienteId, lineas]) => ({
      clienteId,
      nombre: nombres.get(clienteId) ?? `Cliente ${clienteId}`,
      real: agregarMargen(lineas.filter((f) => esMargenReal(f.tipo, f.estado)).map(item)),
      previsto: agregarMargen(lineas.filter((f) => esMargenPrevisto(f.tipo, f.estado)).map(item)),
    }))
    .sort(
      (a, b) =>
        Number(b.real.hayDatos) - Number(a.real.hayDatos) ||
        b.real.beneficio - a.real.beneficio ||
        facturado(b.real) - facturado(a.real),
    );
}
