import { redondearCentimos } from "@/lib/redondeo";
// Estado de cuenta de un cliente: todas sus facturas emitidas con su situación de cobro,
// y cuáles están vencidas. Lógica pura, sin acceso a datos, para poder probarla aparte.
//
// Reglas (decididas con la empresa el 24/11/2026, sustituyen a la de «+90 días desde la emisión»):
// - «Vencida»: con saldo pendiente y ya pasada su fecha de vencimiento (también si se pagó una parte).
//   El vencimiento es el de cada factura (plazo del cliente, de la forma de pago o puesto a mano); si una
//   factura no lo tiene, se usa la fecha de emisión + DIAS_VENCIMIENTO_DEFECTO.
// - Un saldo de menos de 1 € (diferencias de céntimos de la importación) se da por cobrado.
// - Las rectificativas (abonos) ligadas a una factura se descuentan de su saldo: una factura
//   saldada con su abono no se reclama. Los abonos sueltos sin aplicar se descuentan del total.

/** Vencimiento que se aplica a una factura que no tiene fecha de vencimiento (días desde la emisión). */
export const DIAS_VENCIMIENTO_DEFECTO = 30;
/** Días desde el vencimiento a partir de los cuales el saldo se considera en riesgo crítico (Panel, Cobros). */
export const DIAS_RIESGO_CRITICO = 90;
/** Saldos por debajo de esto se ignoran (diferencias de céntimos). */
export const SALDO_MINIMO = 1;

export type EstadoLinea = "pagada" | "pendiente" | "parcial" | "insoluta" | "abono_aplicado" | "abono_pendiente";

export const ETIQUETA_ESTADO_LINEA: Record<EstadoLinea, string> = {
  pagada: "Pagada",
  pendiente: "Pendiente",
  parcial: "Pago parcial",
  insoluta: "Vencida",
  abono_aplicado: "Abono aplicado",
  abono_pendiente: "Abono pendiente",
};

export type DocumentoCobro = {
  id: number;
  tipo: "factura" | "rectificativa";
  numero: string;
  fecha: string; // AAAA-MM-DD
  /** Fecha de vencimiento (AAAA-MM-DD); null = emisión + DIAS_VENCIMIENTO_DEFECTO. */
  fechaVencimiento: string | null;
  total: number;
  cobrado: number;
  pendiente: number;
  /** Factura que rectifica (solo rectificativas). */
  origenId: number | null;
  concepto: string | null;
};

export type LineaEstadoCuenta = DocumentoCobro & {
  estado: EstadoLinea;
  /** Vencimiento que se aplica (el de la factura o el de por defecto). */
  vencimiento: string;
  /** Días desde el vencimiento (0 si todavía no ha vencido). */
  diasVencida: number;
  /** Lo que queda por pagar después de aplicar los abonos ligados (en un abono: lo que queda a favor del cliente, en negativo). */
  saldo: number;
  /** Números de los abonos que se han descontado de esta factura. */
  abonos: string[];
  /** Saldo de céntimos que se ha dado por cobrado (0 si no hay). */
  centimosIgnorados: number;
};

export type EstadoCuenta = {
  fecha: string;
  lineas: LineaEstadoCuenta[];
  insolutas: LineaEstadoCuenta[];
  totalFacturado: number;
  totalPendiente: number;
  totalInsoluto: number;
  /** Abonos sueltos todavía sin aplicar (importe negativo). */
  abonosPendientes: number;
  /** Importe vencido a pagar ya, descontados los abonos sin aplicar (nunca menos de 0). */
  totalAReclamar: number;
};

const redondear = redondearCentimos;
const CENTIMO = 0.01;

export function diasEntre(desde: string, hasta: string) {
  const a = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10));
  const b = Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** Suma días a una fecha AAAA-MM-DD. */
export function sumarDias(fecha: string, dias: number) {
  const t = Date.UTC(+fecha.slice(0, 4), +fecha.slice(5, 7) - 1, +fecha.slice(8, 10)) + dias * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Vencimiento que se aplica a un documento: el suyo o, si no tiene, la emisión + DIAS_VENCIMIENTO_DEFECTO. */
export function vencimientoEfectivo(fecha: string, fechaVencimiento: string | null | undefined) {
  const v = fechaVencimiento?.slice(0, 10);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : sumarDias(fecha.slice(0, 10), DIAS_VENCIMIENTO_DEFECTO);
}

/** Fecha de hoy en España (AAAA-MM-DD): una sola implementación, en lib/redondeo.ts. */
export { hoyEnEspana } from "@/lib/redondeo";

/** Estado de algo que se debe (factura, o «abono» con importe positivo) según su saldo y los días desde su vencimiento. */
function estadoDeuda(saldo: number, diasVencida: number, algoCobrado: boolean): EstadoLinea {
  if (saldo < SALDO_MINIMO) return "pagada";
  if (diasVencida > 0) return "insoluta";
  return algoCobrado ? "parcial" : "pendiente";
}

export function calcularEstadoCuenta(documentos: DocumentoCobro[], hoy: string): EstadoCuenta {
  const ordenados = [...documentos].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero.localeCompare(b.numero));
  const ids = new Set(ordenados.map((d) => d.id));
  const venc = (d: DocumentoCobro) => vencimientoEfectivo(d.fecha, d.fechaVencimiento);
  const dias = (d: DocumentoCobro) => Math.max(0, diasEntre(venc(d), hoy));

  // Abonos ligados a una factura de la lista.
  const abonosPorFactura = new Map<number, DocumentoCobro[]>();
  for (const d of ordenados) {
    if (d.tipo === "rectificativa" && d.origenId != null && ids.has(d.origenId)) {
      abonosPorFactura.set(d.origenId, [...(abonosPorFactura.get(d.origenId) ?? []), d]);
    }
  }
  // Lo que cada abono ligado no ha podido descontar (si supera el saldo de su factura).
  const sobranteAbono = new Map<number, number>();

  const lineas: LineaEstadoCuenta[] = [];
  const porId = new Map<number, LineaEstadoCuenta>();
  for (const d of ordenados) {
    if (d.tipo !== "factura") continue;
    let saldo = d.pendiente;
    const aplicados: string[] = [];
    for (const abono of abonosPorFactura.get(d.id) ?? []) {
      if (abono.pendiente >= -CENTIMO) continue; // ya compensado o devuelto
      const usado = Math.min(-abono.pendiente, Math.max(saldo, 0));
      saldo -= usado;
      if (usado > CENTIMO) aplicados.push(abono.numero);
      sobranteAbono.set(abono.id, redondear(abono.pendiente + usado));
    }
    saldo = Math.max(redondear(saldo), 0);
    const estado = estadoDeuda(saldo, dias(d), d.cobrado > CENTIMO || aplicados.length > 0);
    const centimos = estado === "pagada" && saldo > CENTIMO ? saldo : 0;
    porId.set(d.id, {
      ...d,
      estado,
      vencimiento: venc(d),
      diasVencida: dias(d),
      saldo: estado === "pagada" ? 0 : saldo,
      abonos: aplicados,
      centimosIgnorados: centimos,
    });
  }

  for (const d of ordenados) {
    const factura = porId.get(d.id);
    if (factura) {
      lineas.push(factura);
      continue;
    }
    // Rectificativa: lo que le queda sin aplicar, en negativo (a favor del cliente).
    const ligada = d.origenId != null && ids.has(d.origenId);
    const saldo = redondear(ligada ? (sobranteAbono.get(d.id) ?? d.pendiente) : d.pendiente);
    if (saldo > CENTIMO) {
      // Un «abono» con importe positivo (dato raro de la importación) se trata como una factura más.
      const estado = estadoDeuda(saldo, dias(d), d.cobrado > CENTIMO);
      lineas.push({
        ...d,
        estado,
        vencimiento: venc(d),
      diasVencida: dias(d),
        saldo: estado === "pagada" ? 0 : saldo,
        abonos: [],
        centimosIgnorados: estado === "pagada" ? saldo : 0,
      });
      continue;
    }
    const pendienteAbono = saldo <= -SALDO_MINIMO;
    lineas.push({
      ...d,
      estado: pendienteAbono ? "abono_pendiente" : "abono_aplicado",
      vencimiento: venc(d),
      diasVencida: dias(d),
      saldo: pendienteAbono ? saldo : 0,
      abonos: [],
      centimosIgnorados: pendienteAbono ? 0 : Math.abs(saldo),
    });
  }

  const insolutas = lineas.filter((l) => l.estado === "insoluta");
  const suma = (xs: number[]) => redondear(xs.reduce((s, x) => s + x, 0));
  const totalInsoluto = suma(insolutas.map((l) => l.saldo));
  const abonosPendientes = suma(lineas.filter((l) => l.estado === "abono_pendiente").map((l) => l.saldo));
  return {
    fecha: hoy,
    lineas,
    insolutas,
    totalFacturado: suma(lineas.map((l) => l.total)),
    totalPendiente: suma(lineas.map((l) => l.saldo)),
    totalInsoluto,
    abonosPendientes,
    totalAReclamar: Math.max(0, redondear(totalInsoluto + abonosPendientes)),
  };
}
