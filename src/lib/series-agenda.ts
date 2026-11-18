import { sumarDiasIso } from "@/lib/series-panel";

export type PeriodoAgenda = "semana" | "mes";

export type AsignacionProyeccion = {
  fechaProgramada: string | null;
  estadoAsignacion: string | null;
  rolAsignacion: string | null;
};

export type BarraAgenda = {
  corto: string;
  etiqueta: string;
  hechas: number;
  pendientes: number;
  total: number;
  esHoy: boolean;
};

export type SerieAgenda = {
  total: number;
  totalTexto: string;
  subtitulo: string;
  nota: string;
  modoEtiquetas: "todas" | "extremos";
  barras: BarraAgenda[];
};

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function aFecha(iso: string) {
  return new Date(`${iso}T12:00:00Z`);
}

function aIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function pluralInstalaciones(n: number) {
  return `${n} ${n === 1 ? "instalación" : "instalaciones"}`;
}

function rangoSemanaActual(hoy: string) {
  const h = aFecha(hoy);
  const dia = h.getUTCDay();
  const desdeLunes = dia === 0 ? 6 : dia - 1;
  const inicio = sumarDiasIso(hoy, -desdeLunes);
  const fin = sumarDiasIso(inicio, 6);
  return { inicio, fin };
}

function rangoMesActual(hoy: string) {
  const h = aFecha(hoy);
  const anio = h.getUTCFullYear();
  const mes = h.getUTCMonth();
  const inicio = aIso(new Date(Date.UTC(anio, mes, 1, 12)));
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0, 12)).getUTCDate();
  const fin = aIso(new Date(Date.UTC(anio, mes, ultimoDia, 12)));
  return { inicio, fin, mes, ultimoDia };
}

/** Rango mínimo/máximo necesario para consultar completadas de la semana y el mes en curso. */
export function ventanaConsultaAgenda(hoy: string) {
  const s = rangoSemanaActual(hoy);
  const m = rangoMesActual(hoy);
  return {
    desde: s.inicio < m.inicio ? s.inicio : m.inicio,
    hasta: s.fin > m.fin ? s.fin : m.fin,
  };
}

function resumir(
  asignaciones: AsignacionProyeccion[],
  inicio: string,
  fin: string,
) {
  let hechas = 0;
  let pendientes = 0;
  let montajes = 0;
  let retiradas = 0;

  for (const a of asignaciones) {
    if (!a.fechaProgramada || a.fechaProgramada < inicio || a.fechaProgramada > fin) continue;
    if (a.estadoAsignacion === "completada") {
      hechas += 1;
    } else if (a.estadoAsignacion === "pendiente" || a.estadoAsignacion === "en_curso") {
      pendientes += 1;
    } else {
      continue;
    }
    if (a.rolAsignacion === "retirador") retiradas += 1;
    else montajes += 1;
  }

  return { hechas, pendientes, total: hechas + pendientes, montajes, retiradas };
}

function etiquetaRangoSemana(inicio: string, fin: string) {
  const dIni = aFecha(inicio);
  const dFin = aFecha(fin);
  const mIni = MESES_CORTOS[dIni.getUTCMonth()] ?? "";
  const mFin = MESES_CORTOS[dFin.getUTCMonth()] ?? "";
  if (dIni.getUTCMonth() === dFin.getUTCMonth()) {
    return `Semana ${dIni.getUTCDate()}–${dFin.getUTCDate()} ${mFin}`;
  }
  return `Semana ${dIni.getUTCDate()} ${mIni}–${dFin.getUTCDate()} ${mFin}`;
}

export function construirSeriesAgenda(
  asignaciones: AsignacionProyeccion[],
  hoy: string,
): Record<PeriodoAgenda, SerieAgenda> {
  const sem = rangoSemanaActual(hoy);
  const barrasSemana: BarraAgenda[] = Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDiasIso(sem.inicio, i);
    const d = aFecha(fecha);
    const diaNombre = DIAS_CORTOS[d.getUTCDay()] ?? "";
    const mesCorto = MESES_CORTOS[d.getUTCMonth()] ?? "";
    const r = resumir(asignaciones, fecha, fecha);
    const esHoy = fecha === hoy;
    return {
      corto: diaNombre,
      etiqueta: esHoy
        ? `Hoy · ${diaNombre} ${d.getUTCDate()}`
        : `${diaNombre} ${d.getUTCDate()} ${mesCorto}`,
      hechas: r.hechas,
      pendientes: r.pendientes,
      total: r.total,
      esHoy,
    };
  });
  const totSem = resumir(asignaciones, sem.inicio, sem.fin);

  const mes = rangoMesActual(hoy);
  const mesCorto = MESES_CORTOS[mes.mes] ?? "";
  const mesLargo = MESES_LARGOS[mes.mes] ?? "";
  const tam = Math.ceil(mes.ultimoDia / 6);
  const barrasMes: BarraAgenda[] = [];
  for (let desdeDia = 1; desdeDia <= mes.ultimoDia; desdeDia += tam) {
    const hastaDia = Math.min(mes.ultimoDia, desdeDia + tam - 1);
    const inicioIv = sumarDiasIso(mes.inicio, desdeDia - 1);
    const finIv = sumarDiasIso(mes.inicio, hastaDia - 1);
    const r = resumir(asignaciones, inicioIv, finIv);
    const corto = desdeDia === hastaDia ? `${desdeDia} ${mesCorto}` : `${desdeDia}–${hastaDia} ${mesCorto}`;
    const esHoy = hoy >= inicioIv && hoy <= finIv;
    barrasMes.push({
      corto,
      etiqueta: esHoy ? `${corto} (actual)` : corto,
      hechas: r.hechas,
      pendientes: r.pendientes,
      total: r.total,
      esHoy,
    });
  }
  const totMes = resumir(asignaciones, mes.inicio, mes.fin);

  const textoSub = (prefijo: string, r: ReturnType<typeof resumir>) =>
    `${prefijo} · ${r.hechas} ${r.hechas === 1 ? "hecha" : "hechas"}, ${r.pendientes} ${r.pendientes === 1 ? "pendiente" : "pendientes"}`;

  const textoNota = (r: ReturnType<typeof resumir>) =>
    `${r.montajes} ${r.montajes === 1 ? "montaje" : "montajes"} · ${r.retiradas} ${r.retiradas === 1 ? "retirada" : "retiradas"}`;

  return {
    semana: {
      total: totSem.total,
      totalTexto: pluralInstalaciones(totSem.total),
      subtitulo: textoSub(etiquetaRangoSemana(sem.inicio, sem.fin), totSem),
      nota: textoNota(totSem),
      modoEtiquetas: "todas",
      barras: barrasSemana,
    },
    mes: {
      total: totMes.total,
      totalTexto: pluralInstalaciones(totMes.total),
      subtitulo: textoSub(mesLargo, totMes),
      nota: textoNota(totMes),
      modoEtiquetas: "extremos",
      barras: barrasMes,
    },
  };
}
