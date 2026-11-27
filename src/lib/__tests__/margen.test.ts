import { describe, expect, it } from "vitest";
import { calcularMargen, costeUnitarioCatalogo, formatoPct, margenLinea, nivelMargen, resumirMargen } from "@/lib/margen";

describe("margen bruto", () => {
  it("beneficio y % sobre el precio", () => {
    expect(calcularMargen(200, 120)).toEqual({ beneficio: 80, pct: 40 });
    expect(calcularMargen(225, 190)).toEqual({ beneficio: 35, pct: 15.6 });
    expect(calcularMargen(100, 130)).toEqual({ beneficio: -30, pct: -30 });
  });
  it("sin coste o sin precio no hay margen", () => {
    expect(calcularMargen(200, null)).toBeNull();
    expect(calcularMargen(null, 10)).toBeNull();
    expect(calcularMargen(0, 0)).toEqual({ beneficio: 0, pct: null });
  });
  it("rectificativas: base y coste negativos dan el mismo %", () => {
    expect(calcularMargen(-200, -120)).toEqual({ beneficio: -80, pct: 40 });
  });
  it("niveles: rojo < 20, ámbar 20–35, verde ≥ 35", () => {
    expect(nivelMargen(19.9)).toBe("bajo");
    expect(nivelMargen(20)).toBe("medio");
    expect(nivelMargen(34.9)).toBe("medio");
    expect(nivelMargen(35)).toBe("bueno");
    expect(nivelMargen(null)).toBeNull();
  });
  it("formato del %", () => {
    expect(formatoPct(40)).toBe("40 %");
    expect(formatoPct(15.6)).toBe("15,6 %");
  });
  it("coste de catálogo según alcance y formato", () => {
    const p = { costeFabricacion: 10, costeInstalacion: 4 };
    expect(costeUnitarioCatalogo(p, null, "fabricacion")).toBe(10);
    expect(costeUnitarioCatalogo(p, { costeFabricacion: 7 }, "fabricacion")).toBe(7);
    expect(costeUnitarioCatalogo(p, { costeFabricacion: null }, "fabricacion")).toBe(10);
    expect(costeUnitarioCatalogo(p, { costeFabricacion: 7 }, "instalacion")).toBe(4);
    expect(costeUnitarioCatalogo(p, { costeFabricacion: 7 }, "fabricacion_instalacion")).toBe(11);
    expect(costeUnitarioCatalogo({ costeFabricacion: 10, costeInstalacion: null }, null, "fabricacion_instalacion")).toBeNull();
  });
});

describe("margen del documento", () => {
  const lineas = [
    { importe: 200, cantidad: 10, coste_unitario: 12 },
    { importe: 225, cantidad: 50, coste_unitario: 3.8 },
    { importe: 60, cantidad: 1, coste_unitario: null },
  ];
  it("suma solo las líneas con coste y cuenta aparte las que no lo tienen", () => {
    expect(resumirMargen(lineas, 0)).toEqual({
      beneficio: 115,
      pct: 27.1,
      coste: 310,
      baseConCoste: 425,
      lineasSinCoste: 1,
      baseSinCoste: 60,
      hayDatos: true,
    });
  });
  it("aplica el descuento global a la base", () => {
    const r = resumirMargen(lineas, 10);
    expect(r.baseConCoste).toBe(382.5);
    expect(r.beneficio).toBe(72.5);
    expect(margenLinea(lineas[0]!, 10)).toEqual({ beneficio: 60, pct: 33.3, coste: 120 });
  });
  it("sin ninguna línea con coste no hay %", () => {
    const r = resumirMargen([{ importe: 60, cantidad: 1, coste_unitario: null }], 0);
    expect(r.hayDatos).toBe(false);
    expect(r.pct).toBeNull();
    expect(margenLinea({ importe: 60, cantidad: 1, coste_unitario: null }, 0)).toBeNull();
  });
});
