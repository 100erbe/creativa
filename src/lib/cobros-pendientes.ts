import { clasificarAgingCobro, type ResultadoAging } from "./documentos";
import { SALDO_MINIMO } from "./estado-cuenta";

export type FilaEstadoCobro = {
  id: number | null;
  tipo: string | null;
  fecha: string | null;
  fecha_vencimiento: string | null;
  pendiente: number | string | null;
  estado_cobro: string | null;
};

export type MetaDocumentoCobro = {
  id: number;
  estado: string;
  documento_origen_id: number | null;
};

export type FilaConSaldo<T extends FilaEstadoCobro> = T & {
  id: number;
  pendienteNum: number;
  saldoNeto: number;
  aging: ResultadoAging;
  sinVencimiento: boolean;
};

const ESTADOS_ABIERTOS = new Set(["pendiente", "parcial", "vencida"]);
const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Resume los cobros abiertos aplicando las reglas acordadas por la empresa:
 * - Excluye documentos anulados.
 * - Descuenta las rectificativas (abonos) ligadas mediante `documento_origen_id` del saldo de su factura.
 * - Evalúa 90+ días desde `fecha_vencimiento`, o desde `fecha` de emisión cuando no hay vencimiento.
 * - Ignora saldos por debajo de `SALDO_MINIMO` (1 €) para la clasificación de riesgo / vencidas (+90 días).
 */
export function resumirCobrosPendientes<T extends FilaEstadoCobro>(
  filas: T[],
  metaDocs: MetaDocumentoCobro[],
  hoy = new Date(),
) {
  const metaPorId = new Map(metaDocs.map((d) => [d.id, d]));

  const vigentes = filas.filter((d) => {
    if (d.id == null || !d.fecha) return false;
    const meta = metaPorId.get(d.id);
    return meta?.estado !== "anulado";
  });

  const abiertos = vigentes.filter((d) => ESTADOS_ABIERTOS.has(d.estado_cobro ?? ""));
  const totalPendiente = redondear(abiertos.reduce((s, d) => s + Number(d.pendiente ?? 0), 0));

  // Abonos abiertos ligados a una factura concreta: se descuentan del saldo de esa factura.
  const abonoPorOrigen = new Map<number, number>();
  for (const d of abiertos) {
    if (d.tipo !== "rectificativa" || d.id == null) continue;
    const pend = Number(d.pendiente ?? 0);
    if (pend >= -0.01) continue;
    const origenId = metaPorId.get(d.id)?.documento_origen_id;
    if (origenId != null) {
      abonoPorOrigen.set(origenId, redondear((abonoPorOrigen.get(origenId) ?? 0) + -pend));
    }
  }

  const conSaldo: FilaConSaldo<T>[] = [];
  for (const d of abiertos) {
    const id = d.id as number;
    const pendienteNum = Number(d.pendiente ?? 0);
    if (pendienteNum <= 0.01) continue;

    const abono = d.tipo === "factura" ? (abonoPorOrigen.get(id) ?? 0) : 0;
    const saldoNeto = Math.max(0, redondear(pendienteNum - Math.min(abono, pendienteNum)));
    if (saldoNeto <= 0.01) continue;

    conSaldo.push({
      ...d,
      id,
      pendienteNum,
      saldoNeto,
      aging: clasificarAgingCobro(d.estado_cobro, d.fecha_vencimiento, hoy, d.fecha),
      sinVencimiento: d.tipo === "factura" && !d.fecha_vencimiento,
    });
  }

  const criticas90 = conSaldo
    .filter((d) => d.saldoNeto >= SALDO_MINIMO && d.aging.tramo === "critica_90")
    .sort((a, b) => b.aging.diasVencido - a.aging.diasVencido || b.saldoNeto - a.saldoNeto);

  const vencidas = conSaldo.filter((d) => d.saldoNeto >= SALDO_MINIMO && d.aging.tramo !== "al_dia");
  const sinVencimiento = conSaldo.filter((d) => d.sinVencimiento);
  const sumaSaldo = (lista: FilaConSaldo<T>[]) => redondear(lista.reduce((s, d) => s + d.saldoNeto, 0));
  const sumaCriticas90 = sumaSaldo(criticas90);
  const abonosSinAplicar = redondear(totalPendiente - sumaSaldo(conSaldo));

  return {
    vigentes,
    abiertos,
    totalPendiente,
    conSaldo,
    criticas90,
    vencidas,
    sinVencimiento,
    sumaSaldo,
    sumaCriticas90,
    abonosSinAplicar,
  };
}
