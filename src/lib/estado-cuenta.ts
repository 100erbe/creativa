// Estado de cuenta de un cliente: todas sus facturas emitidas con su situación de cobro,
// y cuáles están insolutas. Lógica pura, sin acceso a datos, para poder probarla aparte.
//
// Reglas (decididas con la empresa el 17/11/2026):
// - «Insoluta»: con saldo pendiente y más de 90 días desde su emisión (también si se pagó una parte).
//   No se mira la fecha de vencimiento: las facturas importadas no la tienen.
// - Un saldo de menos de 1 € (diferencias de céntimos de la importación) se da por cobrado.
// - Las rectificativas (abonos) ligadas a una factura se descuentan de su saldo: una factura
//   saldada con su abono no se reclama. Los abonos sueltos sin aplicar se descuentan del total.

/** Días desde la emisión a partir de los cuales una factura sin cobrar es insoluta. */
export const DIAS_PARA_INSOLUTA = 90;
/** Saldos por debajo de esto se ignoran (diferencias de céntimos). */
export const SALDO_MINIMO = 1;

export type EstadoLinea = "pagada" | "pendiente" | "parcial" | "insoluta" | "abono_aplicado" | "abono_pendiente";

export const ETIQUETA_ESTADO_LINEA: Record<EstadoLinea, string> = {
  pagada: "Pagada",
  pendiente: "Pendiente",
  parcial: "Pago parcial",
  insoluta: "Insoluta",
  abono_aplicado: "Abono aplicado",
  abono_pendiente: "Abono pendiente",
};

export type DocumentoCobro = {
  id: number;
  tipo: "factura" | "rectificativa";
  numero: string;
  fecha: string; // AAAA-MM-DD
  total: number;
  cobrado: number;
  pendiente: number;
  /** Factura que rectifica (solo rectificativas). */
  origenId: number | null;
  concepto: string | null;
};

export type LineaEstadoCuenta = DocumentoCobro & {
  estado: EstadoLinea;
  diasDesdeEmision: number;
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
  /** Lo insoluto que hay que pagar ya, descontados los abonos sin aplicar (nunca menos de 0). */
  totalAReclamar: number;
};

const redondear = (n: number) => Math.round(n * 100) / 100;
const CENTIMO = 0.01;

export function diasEntre(desde: string, hasta: string) {
  const a = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10));
  const b = Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** Fecha de hoy en España (AAAA-MM-DD), aunque el servidor esté en UTC. */
export function hoyEnEspana(ahora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(ahora);
}

/** Estado de algo que se debe (factura, o «abono» con importe positivo) según su saldo y antigüedad. */
function estadoDeuda(saldo: number, dias: number, algoCobrado: boolean): EstadoLinea {
  if (saldo < SALDO_MINIMO) return "pagada";
  if (dias > DIAS_PARA_INSOLUTA) return "insoluta";
  return algoCobrado ? "parcial" : "pendiente";
}

export function calcularEstadoCuenta(documentos: DocumentoCobro[], hoy: string): EstadoCuenta {
  const ordenados = [...documentos].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero.localeCompare(b.numero));
  const ids = new Set(ordenados.map((d) => d.id));
  const dias = (d: DocumentoCobro) => Math.max(0, diasEntre(d.fecha, hoy));

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
      diasDesdeEmision: dias(d),
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
        diasDesdeEmision: dias(d),
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
      diasDesdeEmision: dias(d),
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
