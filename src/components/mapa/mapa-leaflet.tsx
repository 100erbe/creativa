"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CapaBase } from "./capa-base";
import { colorMapa } from "@/design/tokens";
import { useSafeMap } from "@/components/shared/SafeMapContainer";

// Mapa con OpenStreetMap (gratuito, sin clave de API) a través de Leaflet.
// No usamos los iconos PNG por defecto de Leaflet (dan problemas de rutas
// con el empaquetado de Next.js); en su lugar dibujamos un punto de color
// con un pequeño SVG inline, coloreado según el estado del punto.

export type PuntoMapa = {
  id: number;
  nombre: string;
  latitud: number;
  longitud: number;
  estado?: string;
  detalle?: string;
};

// Los colores salen de src/design/tokens.ts (el HTML de un icono de Leaflet no pasa por Tailwind).
const COLOR_POR_ESTADO: Record<string, string> = colorMapa.estado;
const COLOR_DEFECTO = colorMapa.defecto;

function iconoPunto(color: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${color};border:2px solid ${colorMapa.contorno};box-shadow:0 1px 4px ${colorMapa.sombra}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

/** Con varios puntos, el mapa se encuadra para que se vean todos (antes se usaba un zoom fijo). */
function Encuadrar({ puntos }: { puntos: PuntoMapa[] }) {
  const mapa = useMap();
  useEffect(() => {
    if (puntos.length < 2) return;
    mapa.fitBounds(L.latLngBounds(puntos.map((p) => [p.latitud, p.longitud] as [number, number])), {
      padding: [40, 40],
      maxZoom: 17,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puntos.map((p) => `${p.latitud},${p.longitud}`).join("|")]);
  return null;
}

/** Recalcula el tamaño del mapa cuando cambia su contenedor (tarjeta mobile o modal fullscreen). */
function AutoResize() {
  const mapa = useMap();
  useEffect(() => {
    const t = setTimeout(() => mapa.invalidateSize(), 100);
    const contenedor = mapa.getContainer();
    if (typeof ResizeObserver === "undefined") {
      return () => clearTimeout(t);
    }
    const observer = new ResizeObserver(() => {
      mapa.invalidateSize();
    });
    observer.observe(contenedor);
    return () => {
      clearTimeout(t);
      observer.disconnect();
    };
  }, [mapa]);
  return null;
}

export type PosicionMapa = { latitud: number; longitud: number };

const ESPERA_PULSACION_MS = 550;
const TOLERANCIA_MOVIMIENTO_PX = 10;

/**
 * Pulsación larga (táctil) o clic derecho (ratón) sobre el mapa: abre una burbuja
 * con "Añadir punto aquí". Se detecta a mano porque Safari en iPhone no emite
 * `contextmenu` al mantener pulsado.
 */
function PulsacionLarga({ onAnadirPunto }: { onAnadirPunto: (p: PosicionMapa) => void }) {
  const mapa = useMap();
  const { cerrar } = useSafeMap();
  const [elegida, setElegida] = useState<PosicionMapa | null>(null);
  const abiertaEn = useRef(0);

  function abrir(lat: number, lng: number) {
    abiertaEn.current = Date.now();
    setElegida({ latitud: lat, longitud: lng });
  }

  useEffect(() => {
    const contenedor = mapa.getContainer();
    contenedor.style.setProperty("-webkit-touch-callout", "none");
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    let inicio: { x: number; y: number } | null = null;
    const activos = new Set<number>();

    const cancelar = () => {
      if (temporizador) clearTimeout(temporizador);
      temporizador = null;
      inicio = null;
    };
    const alPulsar = (e: PointerEvent) => {
      activos.add(e.pointerId);
      if (e.pointerType === "mouse" || activos.size > 1) return cancelar();
      const destino = e.target as HTMLElement | null;
      if (destino?.closest(".leaflet-marker-icon, .leaflet-popup, .leaflet-control")) return;
      inicio = { x: e.clientX, y: e.clientY };
      const punto = mapa.mouseEventToLatLng(e);
      temporizador = setTimeout(() => {
        temporizador = null;
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(15);
        abrir(punto.lat, punto.lng);
      }, ESPERA_PULSACION_MS);
    };
    const alMover = (e: PointerEvent) => {
      if (!inicio) return;
      if (Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > TOLERANCIA_MOVIMIENTO_PX) cancelar();
    };
    const alSoltar = (e: PointerEvent) => {
      activos.delete(e.pointerId);
      cancelar();
    };

    contenedor.addEventListener("pointerdown", alPulsar);
    contenedor.addEventListener("pointermove", alMover);
    contenedor.addEventListener("pointerup", alSoltar);
    contenedor.addEventListener("pointercancel", alSoltar);
    mapa.on("movestart zoomstart", cancelar);
    return () => {
      cancelar();
      contenedor.removeEventListener("pointerdown", alPulsar);
      contenedor.removeEventListener("pointermove", alMover);
      contenedor.removeEventListener("pointerup", alSoltar);
      contenedor.removeEventListener("pointercancel", alSoltar);
      mapa.off("movestart zoomstart", cancelar);
    };
  }, [mapa]);

  useMapEvents({
    contextmenu(e) {
      e.originalEvent.preventDefault();
      abrir(e.latlng.lat, e.latlng.lng);
    },
    click() {
      // El clic que sigue a soltar el dedo no debe cerrar la burbuja recién abierta.
      if (Date.now() - abiertaEn.current > 400) setElegida(null);
    },
  });

  if (!elegida) return null;
  return (
    <Popup
      position={[elegida.latitud, elegida.longitud]}
      closeOnClick={false}
      autoClose={false}
      eventHandlers={{ remove: () => setElegida(null) }}
    >
      <button
        type="button"
        onClick={() => {
          onAnadirPunto(elegida);
          setElegida(null);
          cerrar();
        }}
        className="inline-flex min-h-11 items-center gap-esp2 rounded-md bg-fondo-marca px-esp3 text-xs font-semibold text-texto-sobre-marca transition-colors hover:bg-fondo-marca-hover"
      >
        Añadir punto aquí
      </button>
    </Popup>
  );
}

export function MapaLeaflet({
  puntos,
  altura = "clamp(280px, 45vh, 520px)",
  onAnadirPunto,
}: {
  puntos: PuntoMapa[];
  /** Si viene, la pulsación larga / clic derecho ofrece añadir un punto en esa posición. */
  onAnadirPunto?: (p: PosicionMapa) => void;
  /** Número de píxeles o cualquier medida CSS (p. ej. "clamp(380px, 66vh, 720px)"). */
  altura?: number | string;
}) {
  if (puntos.length === 0) {
    return (
      <div
        style={{ height: altura }}
        className="flex items-center justify-center rounded-lg border border-dashed border-borde-campo bg-fondo-sutil text-sm text-texto-terciario"
      >
        No hay puntos con ubicación para mostrar.
      </div>
    );
  }

  const unico = puntos[0];
  const centro: [number, number] =
    puntos.length === 1 && unico
      ? [unico.latitud, unico.longitud]
      : [
          puntos.reduce((suma, p) => suma + p.latitud, 0) / puntos.length,
          puntos.reduce((suma, p) => suma + p.longitud, 0) / puntos.length,
        ];

  return (
    <div
      style={{ height: altura }}
      className="overflow-hidden rounded-lg border border-borde-default"
    >
      <MapContainer
        center={centro}
        zoom={puntos.length === 1 ? 16 : 12}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <AutoResize />
        <Encuadrar puntos={puntos} />
        <CapaBase />
        {onAnadirPunto && <PulsacionLarga onAnadirPunto={onAnadirPunto} />}
        {puntos.map((p) => (
          <Marker
            key={p.id}
            position={[p.latitud, p.longitud]}
            icon={iconoPunto(
              (p.estado && COLOR_POR_ESTADO[p.estado]) || COLOR_DEFECTO,
            )}
          >
            <Popup>
              <strong>{p.nombre}</strong>
              {p.detalle ? (
                <>
                  <br />
                  {p.detalle}
                </>
              ) : null}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
