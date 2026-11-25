import { describe, expect, it } from "vitest";
import { hoyEnEspana, redondearCentimos } from "@/lib/redondeo";
import { aNumero, calcularIva, cuotaDeducible, importeRetencion, rutaTicketConFormato, rutaTicketValida, trimestreDe } from "@/lib/gastos";
import { celda, aCsv } from "@/lib/csv";

describe("redondearCentimos", () => {
  it("redondea la mitad lejos de cero, como round(x, 2) de PostgreSQL", () => {
    expect(redondearCentimos(1.005)).toBe(1.01);
    expect(redondearCentimos(-1.005)).toBe(-1.01);
    expect(redondearCentimos(2.675)).toBe(2.68);
    expect(redondearCentimos(0.1 + 0.2)).toBe(0.3);
  });
  it("no devuelve -0 ni NaN", () => {
    expect(Object.is(redondearCentimos(-0.001), 0)).toBe(true);
    expect(redondearCentimos(Number.NaN)).toBe(0);
  });
});

describe("hoyEnEspana", () => {
  it("usa la hora de Madrid, no la UTC", () => {
    // 23:30 UTC del 31/12 ya es 1 de enero en España (UTC+1 en invierno).
    expect(hoyEnEspana(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    // 22:30 UTC en verano (UTC+2) también es el día siguiente.
    expect(hoyEnEspana(new Date("2026-07-14T22:30:00Z"))).toBe("2026-07-15");
  });
});

describe("IVA y retenciones de gastos", () => {
  it("desglosa base y cuota a partir del total con IVA", () => {
    expect(calcularIva(121, 21)).toEqual({ base: 100, cuota: 21 });
    expect(calcularIva(110, 10)).toEqual({ base: 100, cuota: 10 });
    expect(calcularIva(50, 0)).toEqual({ base: 50, cuota: 0 });
    const { base, cuota } = calcularIva(99.99, 21);
    expect(redondearCentimos(base + cuota)).toBe(99.99);
  });
  it("aplica el % de IVA deducible (turismos al 50 %)", () => {
    expect(cuotaDeducible(21, 100)).toBe(21);
    expect(cuotaDeducible(21, 50)).toBe(10.5);
    expect(cuotaDeducible(21.01, 50)).toBe(10.51);
    expect(cuotaDeducible(21, 0)).toBe(0);
    expect(cuotaDeducible(21, null)).toBe(21);
  });
  it("calcula la retención IRPF sobre la base", () => {
    expect(importeRetencion(1000, 15)).toBe(150);
    expect(importeRetencion(333.33, 7)).toBe(23.33);
    expect(importeRetencion(null, 15)).toBe(0);
  });
  it("asigna el trimestre por la fecha", () => {
    expect(trimestreDe("2026-01-01")).toBe(1);
    expect(trimestreDe("2026-03-31")).toBe(1);
    expect(trimestreDe("2026-04-01")).toBe(2);
    expect(trimestreDe("2026-12-31")).toBe(4);
  });
  it("lee importes con coma o punto", () => {
    expect(aNumero("145,20")).toBe(145.2);
    expect(aNumero(" 1 234.5 ")).toBe(1234.5);
    expect(aNumero("")).toBeNull();
    expect(aNumero("abc")).toBeNull();
  });
});

describe("rutas de tickets (C-03)", () => {
  const yo = "11111111-2222-3333-4444-555555555555";
  const otro = "99999999-8888-7777-6666-555555555555";
  it("acepta rutas propias con formato válido", () => {
    expect(rutaTicketValida(`${yo}/abc-123.pdf`, [yo])).toBe(true);
    expect(rutaTicketValida(`${yo}/foto.webp`, [yo])).toBe(true);
  });
  it("rechaza saltos de carpeta, carpetas ajenas y extensiones raras", () => {
    expect(rutaTicketValida(`${yo}/../${otro}/factura.pdf`, [yo])).toBe(false);
    expect(rutaTicketValida(`${otro}/factura.pdf`, [yo])).toBe(false);
    expect(rutaTicketValida(`${yo}/script.html`, [yo])).toBe(false);
    expect(rutaTicketValida(`${yo}/..pdf`, [yo])).toBe(false);
    expect(rutaTicketConFormato(`${yo}/sub/archivo.pdf`)).toBe(false);
  });
});

describe("CSV para Excel", () => {
  it("neutraliza fórmulas, también con espacios delante", () => {
    expect(celda("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(celda("  +1+1")).toBe("'  +1+1");
    expect(celda("@SUM(A1)")).toBe("'@SUM(A1)");
  });
  it("usa coma decimal, comillas cuando hace falta y BOM", () => {
    expect(celda(12.5)).toBe("12,5");
    expect(celda('a;b"c')).toBe('"a;b""c"');
    expect(celda(null)).toBe("");
    expect(aCsv(["A", "B"], [[1, "x"]]).startsWith("﻿A;B\r\n1;x")).toBe(true);
  });
});
