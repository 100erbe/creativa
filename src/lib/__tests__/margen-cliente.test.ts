import { describe, expect, it } from "vitest";
import { calcularMargenCliente, esMargenPrevisto, esMargenReal, type FilaMargen } from "@/lib/margen-cliente";

const fila = (f: Partial<FilaMargen>): FilaMargen => ({
  documento_id: 1,
  tipo: "factura",
  estado: "emitido",
  fecha: "2026-05-10",
  producto_id: 7,
  descripcion: "Lona",
  cantidad: 10,
  unidad: "m2",
  base_neta: 200,
  coste_total: 120,
  ...f,
});

const opciones = {
  numeros: new Map<number, string | null>([
    [1, "FAC-0001/26"],
    [2, "AB-0001/26"],
    [3, "PTO-0001/26"],
    [4, "FAC-0002/25"],
  ]),
  nombresProducto: new Map([[7, "Lona Frontlit"]]),
};

const filas: FilaMargen[] = [
  fila({}),
  fila({ descripcion: "Diseño", producto_id: null, cantidad: 1, unidad: "ud", base_neta: 60, coste_total: null }),
  // Rectificativa que devuelve la mitad de la lona
  fila({ documento_id: 2, tipo: "rectificativa", cantidad: -5, base_neta: -100, coste_total: -60 }),
  // Presupuesto abierto: margen previsto
  fila({ documento_id: 3, tipo: "presupuesto", estado: "enviado", base_neta: 300, coste_total: 150 }),
  // Factura del año pasado
  fila({ documento_id: 4, fecha: "2025-12-01", base_neta: 100, coste_total: 90 }),
];

describe("qué cuenta como margen real o previsto", () => {
  it("real: facturas y rectificativas emitidas", () => {
    expect(esMargenReal("factura", "emitido")).toBe(true);
    expect(esMargenReal("rectificativa", "enviado")).toBe(true);
    expect(esMargenReal("factura", "borrador")).toBe(false);
    expect(esMargenReal("factura", "anulado")).toBe(false);
    expect(esMargenReal("albaran", "emitido")).toBe(false);
  });
  it("previsto: presupuestos abiertos", () => {
    expect(esMargenPrevisto("presupuesto", "aceptado")).toBe(true);
    expect(esMargenPrevisto("presupuesto", "facturado")).toBe(false);
    expect(esMargenPrevisto("presupuesto", "rechazado")).toBe(false);
    expect(esMargenPrevisto("presupuesto", "borrador")).toBe(false);
  });
});

describe("margen del cliente", () => {
  it("todo: suma facturas, resta rectificativas y separa lo previsto", () => {
    const m = calcularMargenCliente(filas, opciones);
    // 200 − 100 + 100 = 200 de base con coste; coste 120 − 60 + 90 = 150
    expect(m.real.baseConCoste).toBe(200);
    expect(m.real.coste).toBe(150);
    expect(m.real.beneficio).toBe(50);
    expect(m.real.pct).toBe(25);
    expect(m.real.lineasSinCoste).toBe(1);
    expect(m.real.baseSinCoste).toBe(60);
    expect(m.previsto.beneficio).toBe(150);
    expect(m.previsto.pct).toBe(50);
  });
  it("filtra por año", () => {
    const m = calcularMargenCliente(filas, { ...opciones, anio: 2026 });
    expect(m.real.beneficio).toBe(40);
    expect(m.porDocumento.map((d) => d.id)).not.toContain(4);
  });
  it("por documento: más recientes primero, con número y si es previsto", () => {
    const m = calcularMargenCliente(filas, opciones);
    expect(m.porDocumento.map((d) => d.id)).toEqual([3, 2, 1, 4]);
    expect(m.porDocumento[0]).toMatchObject({ numero: "PTO-0001/26", previsto: true });
    expect(m.porDocumento.find((d) => d.id === 1)?.resumen).toMatchObject({ beneficio: 80, lineasSinCoste: 1 });
  });
  it("por producto: agrupa por catálogo, conceptos libres aparte, sin presupuestos", () => {
    const m = calcularMargenCliente(filas, opciones);
    expect(m.porProducto).toHaveLength(2);
    expect(m.porProducto[0]).toMatchObject({ nombre: "Lona Frontlit", libre: false, cantidad: 15 });
    expect(m.porProducto[0]!.resumen.beneficio).toBe(50);
    expect(m.porProducto[1]).toMatchObject({ nombre: "Diseño", libre: true });
    expect(m.porProducto[1]!.resumen.hayDatos).toBe(false);
  });
});
