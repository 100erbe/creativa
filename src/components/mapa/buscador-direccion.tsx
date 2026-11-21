"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icono } from "@/components/ui/iconos";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { cn } from "@/lib/cn";

// Búsqueda de direcciones con sugerencias mientras se escribe, con Photon (komoot): geocodificador de
// OpenStreetMap pensado para autocompletar, gratuito y sin clave. Nominatim (el que se usa para la búsqueda
// de un solo clic) lo prohíbe en su servicio público, por eso aquí no se usa.
//
// Es un servicio público sin garantías: si algún día hiciera falta más, basta con cambiar PHOTON_URL por un
// servicio propio o de pago compatible (Geoapify, MapTiler… devuelven el mismo formato GeoJSON).

const PHOTON_URL = "https://photon.komoot.io/api/";
const CENTRO_SESGO = { lat: 36.7213, lon: -4.4214 }; // Málaga: zona habitual de trabajo
const MIN_CARACTERES = 3;
const RETRASO_MS = 300;

export type Sugerencia = {
  latitud: number;
  longitud: number;
  /** Línea principal de la sugerencia ("Calle Larios 5"). */
  titulo: string;
  /** Resto de la dirección ("Málaga, 29005"). */
  detalle: string;
  /** Dirección completa para el campo "Dirección". */
  direccion: string;
  /** Metadatos de OpenStreetMap para recuperar polígonos de distritos/barrios/municipios. */
  osmId?: number;
  osmType?: "R" | "W" | "N";
  esZona?: boolean;
};

type Elemento = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    district?: string;
    county?: string;
    countrycode?: string;
  };
};

const VALORES_ZONA = new Set([
  "administrative",
  "suburb",
  "quarter",
  "neighbourhood",
  "city_district",
  "district",
  "borough",
  "city",
  "town",
  "village",
  "municipality",
]);

function aSugerencia(e: Elemento): Sugerencia | null {
  const p = e.properties;
  const c = e.geometry?.coordinates;
  if (!p || !c || p.countrycode?.toUpperCase() !== "ES") return null;

  const calle = p.street ? `${p.street}${p.housenumber ? ` ${p.housenumber}` : ""}` : null;
  // Un comercio o lugar con nombre propio ("Mercado de Atarazanas") se muestra por su nombre.
  const titulo = calle && p.name && p.name !== p.street ? `${p.name} · ${calle}` : (p.name ?? calle ?? "");
  if (!titulo) return null;

  const localidad = p.city ?? p.district ?? p.county ?? "";
  const detalle = [localidad, p.postcode].filter(Boolean).join(", ");
  const direccion = [calle ?? p.name, localidad].filter(Boolean).join(", ");
  const osmType = p.osm_type === "R" || p.osm_type === "W" || p.osm_type === "N" ? p.osm_type : undefined;
  const esZona = Boolean(
    !calle &&
      (osmType === "R" ||
        (p.osm_value && VALORES_ZONA.has(p.osm_value)) ||
        (p.type && VALORES_ZONA.has(p.type))),
  );
  return {
    latitud: c[1],
    longitud: c[0],
    titulo,
    detalle,
    direccion,
    osmId: typeof p.osm_id === "number" ? p.osm_id : undefined,
    osmType,
    esZona,
  };
}

export function BuscadorDireccion({
  onElegir,
  placeholder = "Buscar dirección o lugar: Calle Larios 5, Málaga",
  className,
  inputClassName,
}: {
  onElegir: (s: Sugerencia) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}) {
  const idLista = useId();
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<Sugerencia[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [activo, setActivo] = useState(-1);
  const cache = useRef(new Map<string, Sugerencia[]>());
  const contenedor = useRef<HTMLDivElement>(null);

  // Consulta con retraso (para no lanzar una petición por cada tecla) y cancelando la anterior.
  useEffect(() => {
    const q = texto.trim();
    if (q.length < MIN_CARACTERES) {
      setResultados([]);
      setMensaje(null);
      setCargando(false);
      return;
    }
    const guardado = cache.current.get(q.toLowerCase());
    if (guardado) {
      setResultados(guardado);
      setMensaje(guardado.length === 0 ? "Sin resultados. Prueba con otra dirección o marca el punto en el mapa." : null);
      setActivo(-1);
      return;
    }

    const control = new AbortController();
    const temporizador = setTimeout(async () => {
      setCargando(true);
      try {
        const url = `${PHOTON_URL}?q=${encodeURIComponent(q)}&limit=8&lang=default&lat=${CENTRO_SESGO.lat}&lon=${CENTRO_SESGO.lon}&location_bias_scale=0.4`;
        const r = await fetch(url, { signal: control.signal });
        if (!r.ok) throw new Error(String(r.status));
        const datos = (await r.json()) as { features?: Elemento[] };
        const lista = (datos.features ?? [])
          .map(aSugerencia)
          .filter((s): s is Sugerencia => s !== null)
          .slice(0, 5);
        cache.current.set(q.toLowerCase(), lista);
        setResultados(lista);
        setMensaje(lista.length === 0 ? "Sin resultados. Prueba con otra dirección o marca el punto en el mapa." : null);
        setActivo(-1);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setResultados([]);
        setMensaje("No se pudo buscar ahora. Marca el punto directamente en el mapa.");
      } finally {
        if (!control.signal.aborted) setCargando(false);
      }
    }, RETRASO_MS);

    return () => {
      clearTimeout(temporizador);
      control.abort();
    };
  }, [texto]);

  // Se cierra al tocar fuera.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [abierto]);

  function elegir(s: Sugerencia) {
    onElegir(s);
    setTexto("");
    setResultados([]);
    setAbierto(false);
    setMensaje(null);
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAbierto(true);
      setActivo((a) => Math.min(a + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      // Enter nunca envía el formulario del punto: elige la sugerencia marcada (o la primera).
      e.preventDefault();
      const s = resultados[activo >= 0 ? activo : 0];
      if (s) elegir(s);
      else e.currentTarget.blur();
    } else if (e.key === "Escape") {
      if (mostrarPanel) e.stopPropagation();
      setAbierto(false);
    }
  }

  const mostrarPanel = abierto && texto.trim().length >= MIN_CARACTERES && (resultados.length > 0 || mensaje || cargando);

  return (
    <div ref={contenedor} className={cn("relative", className)}>
      <div className="relative">
        <Icono
          nombre="buscar"
          size={16}
          className="pointer-events-none absolute left-esp3 top-1/2 -translate-y-1/2 text-icono-secundario"
        />
        <input
          type="search"
          role="combobox"
          aria-expanded={Boolean(mostrarPanel)}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={activo >= 0 ? `${idLista}-${activo}` : undefined}
          aria-label="Buscar dirección"
          autoComplete="off"
          enterKeyHint="search"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={alTeclear}
          placeholder={placeholder}
          className={cn(CAMPO, "pl-9", inputClassName)}
        />
      </div>

      {mostrarPanel && (
        <ul
          id={idLista}
          role="listbox"
          className="absolute inset-x-0 top-full z-[2000] mt-1 max-h-72 overflow-y-auto rounded-md border border-borde-default bg-fondo-superficie shadow-lg"
        >
          {resultados.map((s, i) => (
            <li
              key={`${s.latitud},${s.longitud},${i}`}
              id={`${idLista}-${i}`}
              role="option"
              aria-selected={i === activo}
              // pointerdown (no click): se elige antes de que el campo pierda el foco y cierre el panel.
              onPointerDown={(e) => {
                e.preventDefault();
                elegir(s);
              }}
              onMouseEnter={() => setActivo(i)}
              className={cn(
                "flex min-h-12 cursor-pointer flex-col justify-center border-b border-fondo-hover px-esp3 py-esp2 last:border-b-0",
                i === activo ? "bg-fondo-marca-sutil" : "hover:bg-fondo-sutil",
              )}
            >
              <div className="flex items-center justify-between gap-esp2">
                <span className="truncate text-sm text-texto-primario">{s.titulo}</span>
                {s.esZona && (
                  <span className="shrink-0 rounded bg-fondo-marca-sutil px-1.5 py-0.5 text-micro font-medium text-texto-marca">
                    Zona
                  </span>
                )}
              </div>
              {s.detalle && <span className="text-xs text-texto-terciario">{s.detalle}</span>}
            </li>
          ))}
          {resultados.length === 0 && (
            <li className="px-esp3 py-esp3 text-sm text-texto-terciario" role="status">
              {cargando ? "Buscando…" : mensaje}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
