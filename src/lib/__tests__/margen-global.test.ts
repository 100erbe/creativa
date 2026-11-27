import { describe, expect, it } from "vitest";
import { margenPorCliente, margenPorMes, type FilaMargenGlobal } from "@/lib/margen-global";

const fila = (f: Partial<FilaMargenGlobal>): FilaMargenGlobal => ({
  documento_id: 1,
  cliente_id: 10,
  tipo: "factura",
  estado: "emitido",
  fecha: "2026-03-10",
  producto_id: 7,
  descripcion: "Lona",
  cantidad: 1,
  unidad: "ud",
  base_neta: 100,
  coste_total: 60,
  ...f,
});

const filas = [
  fila({}),
  fila({ documento_id: 2, fecha: "2026-03-20", base_neta: 200, coste_total: 180 }),
  fila({ documento_id: 3, cliente_id: 20, fecha: "2026-11-02", base_neta: 500, coste_total: 200 }),
  fila({ documento_id: 4, cliente_id: 20, tipo: "presupuesto", estado: "enviado", fecha: "2026-11-05", base_neta: 300, coste_total: 100 }),
  fila({ documento_id: 5, cliente_id: 30, fecha: "2026-11-06", base_neta: 900, coste_total: null }),
  // Albarán: no cuenta
  fila({ documento_id: 6, tipo: "albaran", fecha: "2026-11-07", base_neta: 999, coste_total: 1 }),
];

describe("margen por mes", () => {
  it("devuelve los 12 meses y separa real y previsto", () => {
    const meses = margenPorMes(filas, 2026);
    expect(meses).toHaveLength(12);
    expect(meses[2]!.real).toMatchObject({ baseConCoste: 300, coste: 240, beneficio: 60, pct: 20 });
    expect(meses[10]!.real).toMatchObject({ beneficio: 300, pct: 60, lineasSinCoste: 1, baseSinCoste: 900 });
    expect(meses[10]!.previsto).toMatchObject({ beneficio: 200 });
    expect(meses[0]!.real.hayDatos).toBe(false);
  });
});

describe("margen por cliente", () => {
  it("ordena por beneficio real y deja al final los que no tienen coste", () => {
    const r = margenPorCliente(filas, new Map([[10, "Uno"], [20, "Dos"]]));
    expect(r.map((c) => c.clienteId)).toEqual([20, 10, 30]);
    expect(r[0]).toMatchObject({ nombre: "Dos" });
    expect(r[0]!.previsto.beneficio).toBe(200);
    expect(r[2]).toMatchObject({ nombre: "Cliente 30" });
    expect(r[2]!.real.hayDatos).toBe(false);
  });
});
