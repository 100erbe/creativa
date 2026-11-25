import { describe, expect, it } from "vitest";
import { resumirCobrosPendientes, type FilaEstadoCobro } from "@/lib/cobros-pendientes";
import { aplicarReglaVencimiento, clasificarAgingCobro, diaDelMesSiguiente, resolverVencimientoDefecto } from "@/lib/documentos";

const HOY = new Date("2026-11-25T12:00:00Z");

describe("vencimientos", () => {
  it("día N del mes siguiente, o el último si no existe (igual que en SQL)", () => {
    expect(diaDelMesSiguiente("2026-01-15", 30)).toBe("2026-02-28");
    expect(diaDelMesSiguiente("2028-01-15", 30)).toBe("2028-02-29");
    expect(diaDelMesSiguiente("2026-11-30", 30)).toBe("2026-12-30");
    expect(diaDelMesSiguiente("2026-12-05", 10)).toBe("2027-01-10");
  });
  it("aplica días o día del mes", () => {
    expect(aplicarReglaVencimiento("2026-11-01", { dias: 30 })).toBe("2026-12-01");
    expect(aplicarReglaVencimiento("2026-11-01", { diaMes: 30 })).toBe("2026-12-30");
  });
  it("prioridad: cliente > forma de pago > ajuste general", () => {
    const general = { dias: 30 };
    expect(resolverVencimientoDefecto({ cliente: { dias: 60 }, diasFormaPago: 15, general }).origen).toBe("cliente");
    expect(resolverVencimientoDefecto({ cliente: null, diasFormaPago: 15, general }).regla).toEqual({ dias: 15 });
    expect(resolverVencimientoDefecto({ cliente: null, diasFormaPago: null, general }).origen).toBe("general");
  });
});

describe("antigüedad de la deuda", () => {
  it("clasifica por días desde el vencimiento", () => {
    expect(clasificarAgingCobro("pendiente", "2026-11-30", HOY).tramo).toBe("al_dia");
    expect(clasificarAgingCobro("pendiente", "2026-11-20", HOY).tramo).toBe("vencida_30");
    expect(clasificarAgingCobro("pendiente", "2026-10-01", HOY).tramo).toBe("vencida_60");
    expect(clasificarAgingCobro("pendiente", "2026-07-01", HOY).esCritica90).toBe(true);
    expect(clasificarAgingCobro("cobrada", "2026-01-01", HOY).tramo).toBe("al_dia");
  });
});

describe("resumirCobrosPendientes (C-07)", () => {
  const fila = (id: number, tipo: string, pendiente: number, vence: string, estado = "pendiente"): FilaEstadoCobro => ({
    id,
    tipo,
    fecha: "2026-01-10",
    fecha_vencimiento: vence,
    pendiente,
    estado_cobro: estado,
  });

  it("descuenta el abono de su factura y excluye los anulados", () => {
    const filas = [
      fila(1, "factura", 1000, "2026-02-10"),
      fila(2, "rectificativa", -400, "2026-02-10"),
      fila(3, "factura", 500, "2026-02-10"),
    ];
    const meta = [
      { id: 1, estado: "emitido", documento_origen_id: null },
      { id: 2, estado: "emitido", documento_origen_id: 1 },
      { id: 3, estado: "anulado", documento_origen_id: null },
    ];
    const r = resumirCobrosPendientes(filas, meta, HOY);
    expect(r.totalPendiente).toBe(600);
    expect(r.conSaldo.map((d) => [d.id, d.saldoNeto])).toEqual([[1, 600]]);
    expect(r.criticas90.map((d) => d.id)).toEqual([1]);
  });

  it("ignora saldos de menos de 1 € para el riesgo", () => {
    const r = resumirCobrosPendientes([fila(1, "factura", 0.5, "2026-01-01")], [{ id: 1, estado: "emitido", documento_origen_id: null }], HOY);
    expect(r.criticas90).toHaveLength(0);
    expect(r.vencidas).toHaveLength(0);
  });
});
