export const UMBRAL_AUTO_SELECCION_METROS = 150;

export type PuntoActivoAgenda = {
  asignacionId: number;
  puntoId: number;
  punto: string;
  campana: string;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  rolAsignacion: string | null;
  fechaProgramada: string | null;
  esHoy: boolean;
  esAtrasado: boolean;
};

export type PuntoConDistancia = PuntoActivoAgenda & {
  distanciaMetros: number | null;
};

const RADIO_TIERRA_M = 6371000;

/** Distancia en línea recta (Haversine) en metros entre dos coordenadas WGS84. */
export function distanciaMetros(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatearDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(1).replace(".", ",")} km`;
}

function prioridadAgenda(p: PuntoActivoAgenda): number {
  if (p.esHoy) return 0;
  if (p.esAtrasado) return 1;
  if (p.fechaProgramada) return 2;
  return 3;
}

/**
 * Ordena los puntos activos por cercanía si hay GPS; si no, por prioridad de agenda
 * (Hoy → Atrasados → Próximos → Sin fecha). Sugiere el más cercano dentro de 150 m
 * (o el único punto disponible si solo hay uno).
 */
export function ordenarPuntosParaFoto(
  puntos: PuntoActivoAgenda[],
  gps: { lat: number; lng: number } | null,
): { lista: PuntoConDistancia[]; puntoSugeridoId: number | null } {
  const conDist: PuntoConDistancia[] = puntos.map((p) => ({
    ...p,
    distanciaMetros:
      gps && p.latitud != null && p.longitud != null
        ? distanciaMetros(gps, { lat: p.latitud, lng: p.longitud })
        : null,
  }));

  const lista = [...conDist].sort((a, b) => {
    if (a.distanciaMetros != null && b.distanciaMetros != null) {
      return a.distanciaMetros - b.distanciaMetros;
    }
    if (a.distanciaMetros != null) return -1;
    if (b.distanciaMetros != null) return 1;
    const pa = prioridadAgenda(a);
    const pb = prioridadAgenda(b);
    if (pa !== pb) return pa - pb;
    if (a.fechaProgramada && b.fechaProgramada && a.fechaProgramada !== b.fechaProgramada) {
      return a.fechaProgramada.localeCompare(b.fechaProgramada);
    }
    return a.punto.localeCompare(b.punto, "es");
  });

  if (lista.length === 1) {
    return { lista, puntoSugeridoId: lista[0]!.puntoId };
  }

  const primero = lista[0];
  const puntoSugeridoId =
    primero && primero.distanciaMetros != null && primero.distanciaMetros <= UMBRAL_AUTO_SELECCION_METROS
      ? primero.puntoId
      : null;

  return { lista, puntoSugeridoId };
}
