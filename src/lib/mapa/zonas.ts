export type TipoUbicacion = "punto" | "radio" | "poligono";

export type GeometriaZona =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

export type FotoMapa = {
  id?: number | string;
  puntoId?: number;
  puntoNombre?: string;
  url: string;
  latitud: number;
  longitud: number;
  tomadaEn?: string | null;
  tipo?: string | null;
  origenUbicacion?: string | null;
};

export type DistritoOSM = {
  id: string;
  nombre: string;
  detalle?: string;
  centro: { latitud: number; longitud: number };
  geometria: GeometriaZona;
};

export const RADIOS_ZONA = [250, 500, 1000, 2000] as const;
export const RADIO_DEFECTO_METROS = 500;

export function formatoRadio(metros: number): string {
  if (metros >= 1000) {
    const km = metros / 1000;
    return `${Number.isInteger(km) ? km : km.toFixed(1).replace(".", ",")} km`;
  }
  return `${Math.round(metros)} m`;
}

export function nombreZonaDeDireccion(direccion?: string | null): string | null {
  const limpia = direccion?.trim();
  if (!limpia) return null;
  const primero = limpia.split(",")[0]?.trim();
  return primero || null;
}

export function etiquetaTipoUbicacion(
  tipo?: string | null,
  radioMetros?: number | null,
  direccion?: string | null,
): string | null {
  if (tipo === "radio") {
    return radioMetros ? `Zona · ${formatoRadio(radioMetros)}` : "Zona";
  }
  if (tipo === "poligono") {
    const nombreZona = nombreZonaDeDireccion(direccion);
    return nombreZona ? `Zona · ${nombreZona}` : "Zona · Distrito";
  }
  return null;
}

export function esTipoUbicacion(v: unknown): v is TipoUbicacion {
  return v === "punto" || v === "radio" || v === "poligono";
}

function esAnilloValido(anillo: unknown): anillo is number[][] {
  return (
    Array.isArray(anillo) &&
    anillo.length >= 4 &&
    anillo.every(
      (pt) =>
        Array.isArray(pt) &&
        pt.length >= 2 &&
        typeof pt[0] === "number" &&
        Number.isFinite(pt[0]) &&
        typeof pt[1] === "number" &&
        Number.isFinite(pt[1]),
    )
  );
}

export function esGeometriaZona(g: unknown): g is GeometriaZona {
  if (!g || typeof g !== "object") return false;
  const obj = g as { type?: unknown; coordinates?: unknown };
  if (obj.type === "Polygon") {
    return (
      Array.isArray(obj.coordinates) &&
      obj.coordinates.length > 0 &&
      obj.coordinates.every(esAnilloValido)
    );
  }
  if (obj.type === "MultiPolygon") {
    return (
      Array.isArray(obj.coordinates) &&
      obj.coordinates.length > 0 &&
      obj.coordinates.every(
        (poly) => Array.isArray(poly) && poly.length > 0 && poly.every(esAnilloValido),
      )
    );
  }
  return false;
}

/** Simplificación uniforme de un anillo GeoJSON para mantener ligera la geometría en BD y Leaflet. */
function simplificarAnillo(anillo: number[][], maxPuntos: number): number[][] {
  const redondeado = anillo.map((p) => [
    Math.round(p[0]! * 1e5) / 1e5,
    Math.round(p[1]! * 1e5) / 1e5,
  ]);
  if (redondeado.length <= maxPuntos) return redondeado;
  const paso = (redondeado.length - 1) / (maxPuntos - 1);
  const salida: number[][] = [];
  for (let i = 0; i < maxPuntos - 1; i++) {
    salida.push(redondeado[Math.round(i * paso)]!);
  }
  salida.push(salida[0]!);
  return salida;
}

export function simplificarGeometria(
  g: GeometriaZona,
  maxPuntosPorAnillo = 120,
): GeometriaZona {
  if (g.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: g.coordinates.map((anillo) => simplificarAnillo(anillo, maxPuntosPorAnillo)),
    };
  }
  return {
    type: "MultiPolygon",
    coordinates: g.coordinates.map((poly) =>
      poly.map((anillo) => simplificarAnillo(anillo, Math.max(40, Math.floor(maxPuntosPorAnillo / 2)))),
    ),
  };
}

export function iterarCoordenadasGeometria(g: GeometriaZona): [number, number][] {
  const coords: [number, number][] = [];
  if (g.type === "Polygon") {
    for (const anillo of g.coordinates) {
      for (const pt of anillo) coords.push([pt[1]!, pt[0]!]);
    }
  } else {
    for (const poly of g.coordinates) {
      for (const anillo of poly) {
        for (const pt of anillo) coords.push([pt[1]!, pt[0]!]);
      }
    }
  }
  return coords;
}

export function boundsDeGeometria(g: GeometriaZona): [[number, number], [number, number]] | null {
  const coords = iterarCoordenadasGeometria(g);
  if (coords.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of coords) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

export function boundsDeCirculo(
  lat: number,
  lng: number,
  radioMetros: number,
): [[number, number], [number, number]] {
  const dLat = radioMetros / 111320;
  const dLng = radioMetros / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return [
    [lat - dLat, lng - dLng],
    [lat + dLat, lng + dLng],
  ];
}

export function centroideDeGeometria(g: GeometriaZona): { latitud: number; longitud: number } {
  const b = boundsDeGeometria(g);
  if (!b) return { latitud: 36.7213, longitud: -4.4214 };
  return {
    latitud: Math.round(((b[0][0] + b[1][0]) / 2) * 1e7) / 1e7,
    longitud: Math.round(((b[0][1] + b[1][1]) / 2) * 1e7) / 1e7,
  };
}

// ---------------------------------------------------------------------
//  OpenStreetMap: polígonos de distritos/barrios (Nominatim + Overpass)
// ---------------------------------------------------------------------

const cachePoligonoOSM = new Map<
  string,
  { geometria: GeometriaZona; centro: { latitud: number; longitud: number } } | null
>();

/**
 * Obtiene el polígono GeoJSON real de un lugar de OpenStreetMap (barrio, distrito, municipio…)
 * usando Nominatim `lookup` con `polygon_geojson=1`. Solo se llama al elegir un resultado.
 */
export async function obtenerPoligonoOSM(
  osmType: "R" | "W" | "N",
  osmId: number,
): Promise<{ geometria: GeometriaZona; centro: { latitud: number; longitud: number } } | null> {
  const clave = `${osmType}${osmId}`;
  if (cachePoligonoOSM.has(clave)) return cachePoligonoOSM.get(clave) ?? null;

  try {
    const url = `https://nominatim.openstreetmap.org/lookup?osm_ids=${encodeURIComponent(clave)}&format=json&polygon_geojson=1&polygon_threshold=0.0004&accept-language=es`;
    const r = await fetch(url);
    if (!r.ok) {
      cachePoligonoOSM.set(clave, null);
      return null;
    }
    const lista = (await r.json()) as Array<{
      lat?: string;
      lon?: string;
      geojson?: unknown;
    }>;
    const primero = lista[0];
    if (!primero || !esGeometriaZona(primero.geojson)) {
      cachePoligonoOSM.set(clave, null);
      return null;
    }
    const geometria = simplificarGeometria(primero.geojson);
    const centro =
      primero.lat && primero.lon && Number.isFinite(Number(primero.lat)) && Number.isFinite(Number(primero.lon))
        ? { latitud: Number(primero.lat), longitud: Number(primero.lon) }
        : centroideDeGeometria(geometria);
    const res = { geometria, centro };
    cachePoligonoOSM.set(clave, res);
    return res;
  } catch {
    return null;
  }
}

type OverpassMember = {
  type?: string;
  role?: string;
  geometry?: Array<{ lat: number; lon: number }>;
};

type OverpassElement = {
  id: number;
  tags?: Record<string, string>;
  members?: OverpassMember[];
};

/** Une los segmentos `outer` de una relación OSM en anillos cerrados GeoJSON [lon, lat]. */
function unirSegmentosEnAnillos(segmentos: number[][][]): number[][][] {
  const pendientes = segmentos
    .filter((s) => s.length >= 2)
    .map((s) => s.slice());
  const anillos: number[][][] = [];
  const cerca = (a: number[], b: number[]) =>
    Math.abs(a[0]! - b[0]!) < 1e-5 && Math.abs(a[1]! - b[1]!) < 1e-5;

  while (pendientes.length > 0) {
    const actual = pendientes.shift()!;
    let cambio = true;
    while (cambio && !cerca(actual[0]!, actual[actual.length - 1]!)) {
      cambio = false;
      const fin = actual[actual.length - 1]!;
      const ini = actual[0]!;
      for (let i = 0; i < pendientes.length; i++) {
        const seg = pendientes[i]!;
        if (cerca(fin, seg[0]!)) {
          actual.push(...seg.slice(1));
          pendientes.splice(i, 1);
          cambio = true;
          break;
        }
        if (cerca(fin, seg[seg.length - 1]!)) {
          actual.push(...seg.slice(0, -1).reverse());
          pendientes.splice(i, 1);
          cambio = true;
          break;
        }
        if (cerca(ini, seg[seg.length - 1]!)) {
          actual.unshift(...seg.slice(0, -1));
          pendientes.splice(i, 1);
          cambio = true;
          break;
        }
        if (cerca(ini, seg[0]!)) {
          actual.unshift(...seg.slice(1).reverse());
          pendientes.splice(i, 1);
          cambio = true;
          break;
        }
      }
    }
    if (actual.length >= 4) {
      if (!cerca(actual[0]!, actual[actual.length - 1]!)) {
        actual.push(actual[0]!);
      }
      anillos.push(actual);
    }
  }
  return anillos;
}

const cacheDistritosVista = new Map<string, DistritoOSM[]>();

/**
 * Carga distritos y barrios con límites poligonales en el área visible del mapa
 * desde Overpass (OpenStreetMap). Se cachea por cuadrícula para evitar peticiones repetidas.
 */
export async function obtenerDistritosEnVista(bbox: {
  sur: number;
  oeste: number;
  norte: number;
  este: number;
}): Promise<DistritoOSM[]> {
  // Evita consultas gigantes si el zoom es demasiado lejano (> ~40 km de lado).
  if (Math.abs(bbox.norte - bbox.sur) > 0.35 || Math.abs(bbox.este - bbox.oeste) > 0.45) {
    throw new Error("Acerca un poco el mapa para cargar los distritos de esta zona.");
  }

  const r = (n: number) => Math.round(n * 25) / 25;
  const clave = `${r(bbox.sur)},${r(bbox.oeste)},${r(bbox.norte)},${r(bbox.este)}`;
  const cacheado = cacheDistritosVista.get(clave);
  if (cacheado) return cacheado;

  const caja = `${bbox.sur.toFixed(4)},${bbox.oeste.toFixed(4)},${bbox.norte.toFixed(4)},${bbox.este.toFixed(4)}`;
  const consulta = `[out:json][timeout:10];(relation["boundary"="administrative"]["admin_level"~"^(9|10)$"](${caja});relation["place"~"^(suburb|quarter|district)$"](${caja}););out geom;`;

  const control = new AbortController();
  const timeout = setTimeout(() => control.abort(), 11000);
  try {
    const resp = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: `data=${encodeURIComponent(consulta)}`,
      signal: control.signal,
    });
    if (!resp.ok) throw new Error("No se pudieron cargar los distritos ahora.");
    const datos = (await resp.json()) as { elements?: OverpassElement[] };
    const distritos: DistritoOSM[] = [];
    const nombresVistos = new Set<string>();

    for (const el of datos.elements ?? []) {
      const nombre = el.tags?.["name:es"] ?? el.tags?.name;
      if (!nombre || !el.members?.length) continue;
      const claveNombre = nombre.trim().toLowerCase();
      if (nombresVistos.has(claveNombre)) continue;

      const segmentosOuter: number[][][] = [];
      for (const m of el.members) {
        if (m.type === "way" && m.role !== "inner" && m.geometry && m.geometry.length >= 2) {
          segmentosOuter.push(m.geometry.map((pt) => [pt.lon, pt.lat]));
        }
      }
      const anillos = unirSegmentosEnAnillos(segmentosOuter);
      if (anillos.length === 0) continue;

      const geometriaCruda: GeometriaZona =
        anillos.length === 1
          ? { type: "Polygon", coordinates: [anillos[0]!] }
          : { type: "MultiPolygon", coordinates: anillos.map((a) => [a]) };
      const geometria = simplificarGeometria(geometriaCruda, 100);
      const centro = centroideDeGeometria(geometria);
      nombresVistos.add(claveNombre);
      distritos.push({
        id: `R${el.id}`,
        nombre: nombre.trim(),
        detalle: el.tags?.["addr:city"] ?? el.tags?.is_in?.split(",")[0]?.trim(),
        centro,
        geometria,
      });
    }

    cacheDistritosVista.set(clave, distritos);
    return distritos;
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new Error("OpenStreetMap tardó demasiado en responder. Inténtalo de nuevo o busca el barrio arriba.");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
