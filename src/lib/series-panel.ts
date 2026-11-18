// Series históricas de las tarjetas KPI del Resumen. Lógica pura (sin acceso a datos) para poder
// comprobarla aparte. Todas las fechas son cadenas AAAA-MM-DD en hora de España.
//
// Periodos (decididos el 18/11/2026):
// - semana: los últimos 7 días, un punto por día
// - mes:    del día 1 a hoy, en hasta 6 intervalos (1–3, 4–6… como en Figma)
// - ano:    de enero a hoy, un punto por mes
//
// Cada KPI:
// - facturación (flujo): suma del total de las facturas y rectificativas emitidas en cada intervalo.
//   La cifra del periodo es la suma de todo el periodo.
// - pendiente de cobro (saldo): lo emitido hasta el cierre del intervalo menos lo cobrado hasta esa
//   fecha. Mismo cálculo que v_estado_cobro, así que el punto de hoy coincide con el Resumen.
// - vencido 90+ (saldo): la parte del saldo de facturas cuyo vencimiento es de 90 días o más antes
//   del cierre del intervalo. Sin fecha de vencimiento nunca cuenta.
// - campañas activas: campañas no canceladas cuyo periodo (inicio–fin) incluye el cierre del intervalo.

export type Periodo = "semana" | "mes" | "ano";
export const PERIODOS: Periodo[] = ["semana", "mes", "ano"];

export type Intervalo = { inicio: string; fin: string; etiqueta: string };

export type DocCobro = {
  id: number;
  fecha: string;
  fechaVencimiento: string | null;
  total: number;
};
export type Cobro = { documentoId: number; fecha: string; importe: number };
export type CampanaFechas = { estado: string; inicio: string | null; fin: string | null };

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function aFecha(iso: string) {
  return new Date(`${iso}T12:00:00Z`);
}
function aIso(d: Date) {
  return d.toISOString().slice(0, 10);
}
export function sumarDiasIso(iso: string, dias: number) {
  const d = aFecha(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return aIso(d);
}

/** Intervalos de un periodo que termina hoy. */
export function intervalos(periodo: Periodo, hoy: string): Intervalo[] {
  const h = aFecha(hoy);
  if (periodo === "semana") {
    return Array.from({ length: 7 }, (_, i) => {
      const dia = sumarDiasIso(hoy, i - 6);
      const d = aFecha(dia);
      return { inicio: dia, fin: dia, etiqueta: `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}` };
    });
  }
  if (periodo === "mes") {
    const diasTranscurridos = h.getUTCDate();
    const n = Math.min(6, diasTranscurridos);
    const tam = Math.ceil(diasTranscurridos / n);
    const mes = MESES[h.getUTCMonth()];
    const res: Intervalo[] = [];
    for (let desde = 1; desde <= diasTranscurridos; desde += tam) {
      const hasta = Math.min(diasTranscurridos, desde + tam - 1);
      const inicio = sumarDiasIso(hoy, desde - diasTranscurridos);
      const fin = sumarDiasIso(hoy, hasta - diasTranscurridos);
      res.push({ inicio, fin, etiqueta: desde === hasta ? `${desde} ${mes}` : `${desde}–${hasta} ${mes}` });
    }
    return res;
  }
  // año: de enero al mes actual
  return Array.from({ length: h.getUTCMonth() + 1 }, (_, m) => {
    const inicio = aIso(new Date(Date.UTC(h.getUTCFullYear(), m, 1, 12)));
    const finMes = aIso(new Date(Date.UTC(h.getUTCFullYear(), m + 1, 0, 12)));
    return { inicio, fin: finMes < hoy ? finMes : hoy, etiqueta: MESES[m] ?? "" };
  });
}

/** Facturación de un intervalo (flujo). */
export function facturado(docs: DocCobro[], inicio: string, fin: string) {
  return docs.reduce((s, d) => (d.fecha >= inicio && d.fecha <= fin ? s + d.total : s), 0);
}

/** Saldo pendiente de cada documento a una fecha (solo emitidos hasta esa fecha). */
function saldosA(docs: DocCobro[], cobradoA: (id: number) => number, fecha: string) {
  return docs.filter((d) => d.fecha <= fecha).map((d) => ({ doc: d, saldo: d.total - cobradoA(d.id) }));
}

export function crearCalculadora(docs: DocCobro[], cobros: Cobro[]) {
  const porDoc = new Map<number, Cobro[]>();
  for (const c of cobros) {
    const l = porDoc.get(c.documentoId) ?? [];
    l.push(c);
    porDoc.set(c.documentoId, l);
  }
  return {
    /** Pendiente de cobro al cierre de `fecha` (incluye abonos negativos, como el Resumen). */
    pendiente(fecha: string) {
      let total = 0;
      for (const { saldo } of saldosA(docs, (id) => cobradoHasta(porDoc.get(id), fecha), fecha)) {
        if (Math.abs(saldo) >= 0.01) total += saldo;
      }
      return total;
    },
    /** Saldo de facturas con 90+ días desde el vencimiento al cierre de `fecha`. */
    vencido90(fecha: string) {
      const limite = sumarDiasIso(fecha, -90);
      let total = 0;
      for (const { doc, saldo } of saldosA(docs, (id) => cobradoHasta(porDoc.get(id), fecha), fecha)) {
        if (saldo > 0.01 && doc.fechaVencimiento && doc.fechaVencimiento <= limite) total += saldo;
      }
      return total;
    },
  };
}

function cobradoHasta(lista: Cobro[] | undefined, fecha: string) {
  if (!lista) return 0;
  return lista.reduce((s, c) => (c.fecha <= fecha ? s + c.importe : s), 0);
}

/** Campañas activas en una fecha (por sus fechas de inicio y fin). */
export function campanasActivas(campanas: CampanaFechas[], fecha: string) {
  return campanas.filter(
    (c) => c.estado !== "cancelada" && c.inicio != null && c.inicio <= fecha && (c.fin == null || c.fin >= fecha),
  ).length;
}
