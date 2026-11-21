"use client";

import { useEffect, useRef, useState } from "react";
import { Circle, GeoJSON, MapContainer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CapaBase } from "./capa-base";
import { ModalFotoMapa } from "./modal-foto-mapa";
import { colorMapa, fondo } from "@/design/tokens";
import { useSafeMap } from "@/components/shared/SafeMapContainer";
import {
  boundsDeCirculo,
  boundsDeGeometria,
  esGeometriaZona,
  etiquetaTipoUbicacion,
  type FotoMapa,
  type GeometriaZona,
  type TipoUbicacion,
} from "@/lib/mapa/zonas";

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
  direccion?: string | null;
  tipo_ubicacion?: TipoUbicacion;
  radio_metros?: number | null;
  geometria?: GeometriaZona | null;
  /** Punto/zona de contexto (p. ej. de la misma campaña pero no asignado a este miembro): se muestra en gris y no afecta al zoom por defecto. */
  inactivo?: boolean;
};

// Los colores salen de src/design/tokens.ts (el HTML de un icono de Leaflet no pasa por Tailwind).
const COLOR_POR_ESTADO: Record<string, string> = colorMapa.estado;
const COLOR_DEFECTO = colorMapa.defecto;
const COLOR_INACTIVO = colorMapa.estado.retirado;

function iconoPunto(color: string, tamano = 16, opacidad = 1) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:${tamano}px;height:${tamano}px;border-radius:50%;background:${color};opacity:${opacidad};border:2px solid ${colorMapa.contorno};box-shadow:0 1px 4px ${colorMapa.sombra}"></span>`,
    iconSize: [tamano, tamano],
    iconAnchor: [tamano / 2, tamano / 2],
    popupAnchor: [0, -tamano / 2],
  });
}

/** Puntito discreto para cada foto realizada con GPS/EXIF: más pequeño y menos llamativo que un punto de campaña. */
const ICONO_FOTO = L.divIcon({
  className: "",
  html: `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;cursor:pointer"><span style="display:block;width:9px;height:9px;border-radius:50%;background:${fondo.inverso};opacity:0.78;border:1.5px solid ${colorMapa.contorno};box-shadow:0 1px 2px ${colorMapa.sombra}"></span></span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

/** Encuadra el mapa con el máximo zoom posible manteniendo visibles todos los puntos, zonas y fotos. */
function Encuadrar({ puntos, fotos }: { puntos: PuntoMapa[]; fotos: FotoMapa[] }) {
  const mapa = useMap();
  const puntosRef = useRef(puntos);
  puntosRef.current = puntos;
  const fotosRef = useRef(fotos);
  fotosRef.current = fotos;
  const ultimoTamanoRef = useRef({ w: 0, h: 0 });

  const clave = [
    ...puntos
      .filter((p) => !p.inactivo)
      .map((p) => `${p.id}:${p.latitud},${p.longitud},${p.tipo_ubicacion ?? "punto"},${p.radio_metros ?? ""}`),
    ...fotos.map((f) => `${f.latitud},${f.longitud}`),
  ].join("|");

  useEffect(() => {
    const encuadrar = (forzar = false) => {
      const contenedor = mapa.getContainer();
      const w = contenedor.clientWidth;
      const h = contenedor.clientHeight;
      if (w === 0 || h === 0) return;

      const prev = ultimoTamanoRef.current;
      const cambioTamano = Math.abs(w - prev.w) > 20 || Math.abs(h - prev.h) > 20;
      if (!forzar && !cambioTamano) return;

      mapa.invalidateSize({ animate: false });
      const activos = puntosRef.current.filter((p) => !p.inactivo);
      const fuenteEncuadre = activos.length > 0 ? activos : puntosRef.current;
      const esquinas: [number, number][] = [];
      for (const p of fuenteEncuadre) {
        if (p.tipo_ubicacion === "poligono" && esGeometriaZona(p.geometria)) {
          const b = boundsDeGeometria(p.geometria);
          if (b) esquinas.push(b[0], b[1]);
          else esquinas.push([p.latitud, p.longitud]);
        } else if (p.tipo_ubicacion === "radio" && p.radio_metros) {
          const b = boundsDeCirculo(p.latitud, p.longitud, p.radio_metros);
          esquinas.push(b[0], b[1]);
        } else {
          esquinas.push([p.latitud, p.longitud]);
        }
      }
      for (const f of fotosRef.current) {
        esquinas.push([f.latitud, f.longitud]);
      }

      if (esquinas.length >= 2) {
        mapa.fitBounds(L.latLngBounds(esquinas), {
          padding: [28, 28],
          maxZoom: 18,
          animate: false,
        });
      } else if (esquinas.length === 1) {
        mapa.setView(esquinas[0]!, 17, { animate: false });
      }
      ultimoTamanoRef.current = { w, h };
    };

    encuadrar(true);
    const t = setTimeout(() => encuadrar(true), 120);
    const contenedor = mapa.getContainer();
    if (typeof ResizeObserver === "undefined") {
      return () => clearTimeout(t);
    }
    const observer = new ResizeObserver(() => encuadrar(false));
    observer.observe(contenedor);
    return () => {
      clearTimeout(t);
      observer.disconnect();
    };
  }, [mapa, clave]);
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
  fotos = [],
  altura = "clamp(280px, 45vh, 520px)",
  onAnadirPunto,
}: {
  puntos: PuntoMapa[];
  /** Fotos realizadas con coordenadas (GPS/EXIF): se muestran como puntitos discretos clicables. */
  fotos?: FotoMapa[];
  /** Si viene, la pulsación larga / clic derecho ofrece añadir un punto en esa posición. */
  onAnadirPunto?: (p: PosicionMapa) => void;
  /** Número de píxeles o cualquier medida CSS (p. ej. "clamp(380px, 66vh, 720px)"). */
  altura?: number | string;
}) {
  const [fotoActiva, setFotoActiva] = useState<FotoMapa | null>(null);

  if (puntos.length === 0 && fotos.length === 0) {
    return (
      <div
        style={{ height: altura }}
        className="flex items-center justify-center rounded-lg border border-dashed border-borde-campo bg-fondo-sutil text-sm text-texto-terciario"
      >
        No hay puntos con ubicación para mostrar.
      </div>
    );
  }

  const activos = puntos.filter((p) => !p.inactivo);
  const baseCentro = activos.length > 0 ? activos : puntos.length > 0 ? puntos : fotos;
  const unico = baseCentro[0];
  const centro: [number, number] =
    baseCentro.length === 1 && unico
      ? [unico.latitud, unico.longitud]
      : [
          baseCentro.reduce((suma, p) => suma + p.latitud, 0) / baseCentro.length,
          baseCentro.reduce((suma, p) => suma + p.longitud, 0) / baseCentro.length,
        ];

  return (
    <>
      <div
        style={{ height: altura }}
        className="overflow-hidden rounded-lg border border-borde-default"
      >
        <MapContainer
          center={centro}
          zoom={baseCentro.length === 1 ? 17 : 12}
          zoomSnap={0.25}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <AutoResize />
          <Encuadrar puntos={puntos} fotos={fotos} />
          <CapaBase />
          {onAnadirPunto && <PulsacionLarga onAnadirPunto={onAnadirPunto} />}

          {puntos.map((p) => {
            const inactivo = Boolean(p.inactivo);
            const color = inactivo
              ? COLOR_INACTIVO
              : (p.estado && COLOR_POR_ESTADO[p.estado]) || COLOR_DEFECTO;
            const etiquetaZona = etiquetaTipoUbicacion(p.tipo_ubicacion, p.radio_metros, p.direccion);
            const contenidoPopup = (
              <Popup>
                <strong>{p.nombre}</strong>
                {etiquetaZona ? (
                  <>
                    <br />
                    <span>{etiquetaZona}</span>
                  </>
                ) : null}
                {p.detalle ? (
                  <>
                    <br />
                    {p.detalle}
                  </>
                ) : null}
              </Popup>
            );

            if (p.tipo_ubicacion === "poligono" && esGeometriaZona(p.geometria)) {
              return (
                <GeoJSON
                  key={`poly-${inactivo ? "ctx-" : ""}${p.id}`}
                  data={p.geometria}
                  style={{
                    color,
                    weight: inactivo ? 1.5 : 2,
                    dashArray: inactivo ? "4 4" : undefined,
                    opacity: inactivo ? 0.65 : 1,
                    fillColor: color,
                    fillOpacity: inactivo ? 0.06 : 0.14,
                  }}
                >
                  {contenidoPopup}
                </GeoJSON>
              );
            }

            if (p.tipo_ubicacion === "radio" && p.radio_metros) {
              return (
                <Circle
                  key={`radio-${inactivo ? "ctx-" : ""}${p.id}-${p.radio_metros}`}
                  center={[p.latitud, p.longitud]}
                  radius={p.radio_metros}
                  pathOptions={{
                    color,
                    weight: inactivo ? 1.5 : 2,
                    dashArray: inactivo ? "4 4" : "6 4",
                    opacity: inactivo ? 0.65 : 1,
                    fillColor: color,
                    fillOpacity: inactivo ? 0.06 : 0.14,
                  }}
                >
                  {contenidoPopup}
                </Circle>
              );
            }

            return (
              <Marker
                key={`${inactivo ? "ctx-" : ""}${p.id}`}
                position={[p.latitud, p.longitud]}
                icon={iconoPunto(color, inactivo ? 13 : 16, inactivo ? 0.62 : 1)}
                zIndexOffset={inactivo ? -20 : 100}
              >
                {contenidoPopup}
              </Marker>
            );
          })}

          {fotos.map((f, idx) => (
            <Marker
              key={`foto-${f.id ?? f.url}-${idx}`}
              position={[f.latitud, f.longitud]}
              icon={ICONO_FOTO}
              zIndexOffset={-50}
              eventHandlers={{
                click() {
                  setFotoActiva(f);
                },
              }}
            />
          ))}
        </MapContainer>
      </div>

      <ModalFotoMapa foto={fotoActiva} onCerrar={() => setFotoActiva(null)} />
    </>
  );
}
