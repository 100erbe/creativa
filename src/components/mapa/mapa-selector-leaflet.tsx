"use client";

import { useEffect, useRef } from "react";
import { MapContainer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CapaBase } from "./capa-base";
import { colorMapa } from "@/design/tokens";

// Mapa para elegir la ubicación de un punto: clic en el mapa = nueva posición.
// Muestra también los puntos ya creados de la campaña.

export type PuntoExistente = {
  id: number;
  nombre: string;
  latitud: number;
  longitud: number;
  detalle?: string;
  estado?: string;
};
export type Posicion = { latitud: number; longitud: number };

function icono(color: string, tamano = 16, areaTactil = tamano) {
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${areaTactil}px;height:${areaTactil}px;cursor:pointer"><span style="display:block;width:${tamano}px;height:${tamano}px;border-radius:50%;background:${color};border:2px solid ${colorMapa.contorno};box-shadow:0 1px 4px ${colorMapa.sombra}"></span></span>`,
    iconSize: [areaTactil, areaTactil],
    iconAnchor: [areaTactil / 2, areaTactil / 2],
    popupAnchor: [0, -tamano / 2],
  });
}
const ICONO_EXISTENTE = icono(colorMapa.estado.retirado, 16, 44);
const ICONO_NUEVO = icono(colorMapa.defecto, 22, 44);

// Centro por defecto: Málaga (zona habitual de trabajo de Creativa).
const CENTRO_DEFECTO: [number, number] = [36.7213, -4.4214];

function Clics({
  onElegir,
  ultimoGestoRef,
}: {
  onElegir: (p: Posicion) => void;
  ultimoGestoRef: React.MutableRefObject<number>;
}) {
  const mapa = useMap();

  useEffect(() => {
    const contenedor = mapa.getContainer();
    const marcarMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) ultimoGestoRef.current = Date.now();
    };
    const marcarGesto = () => {
      ultimoGestoRef.current = Date.now();
    };
    contenedor.addEventListener("touchstart", marcarMultiTouch, { passive: true });
    contenedor.addEventListener("touchmove", marcarMultiTouch, { passive: true });
    mapa.on("movestart moveend zoomstart zoomend", marcarGesto);
    return () => {
      contenedor.removeEventListener("touchstart", marcarMultiTouch);
      contenedor.removeEventListener("touchmove", marcarMultiTouch);
      mapa.off("movestart moveend zoomstart zoomend", marcarGesto);
    };
  }, [mapa, ultimoGestoRef]);

  useMapEvents({
    click(e) {
      if (Date.now() - ultimoGestoRef.current < 320) return;
      const destino = e.originalEvent.target as HTMLElement | null;
      if (destino?.closest(".leaflet-marker-icon")) return;
      onElegir({ latitud: e.latlng.lat, longitud: e.latlng.lng });
    },
  });
  return null;
}

/**
 * Marcador de punto ya añadido. Soporta clic/toque corto (editar detalles) y arrastre (mover ubicación),
 * sin interferir con el arrastre ni zoom del mapa.
 */
function MarcadorExistente({
  punto,
  onClic,
  onMover,
  ultimoGestoRef,
}: {
  punto: PuntoExistente;
  onClic?: (p: PuntoExistente) => void;
  onMover?: (p: PuntoExistente, pos: Posicion) => void;
  ultimoGestoRef: React.MutableRefObject<number>;
}) {
  const onClicRef = useRef(onClic);
  onClicRef.current = onClic;
  const onMoverRef = useRef(onMover);
  onMoverRef.current = onMover;
  const puntoRef = useRef(punto);
  puntoRef.current = punto;
  const arrastrable = Boolean(onMover) && (!punto.estado || punto.estado === "pendiente");

  return (
    <Marker
      position={[punto.latitud, punto.longitud]}
      icon={ICONO_EXISTENTE}
      draggable={arrastrable}
      eventHandlers={{
        click() {
          if (Date.now() - ultimoGestoRef.current < 320) return;
          onClicRef.current?.(puntoRef.current);
        },
        dragstart() {
          ultimoGestoRef.current = Date.now();
        },
        dragend(e) {
          ultimoGestoRef.current = Date.now();
          const ll = (e.target as L.Marker).getLatLng();
          onMoverRef.current?.(puntoRef.current, { latitud: ll.lat, longitud: ll.lng });
        },
      }}
    >
      {!onClic && (
        <Popup>
          <strong>{punto.nombre}</strong>
          {punto.detalle ? (
            <>
              <br />
              {punto.detalle}
            </>
          ) : null}
        </Popup>
      )}
    </Marker>
  );
}

/**
 * Encuadra el mapa para incluir todos los puntos ya seleccionados al abrir/cargar el mapa.
 * Una vez que el usuario ha interactuado o movido la vista (o buscado una dirección), nunca reencuadra
 * automáticamente al añadir o mover puntos para conservar exactamente su vista actual.
 */
function Encuadrar({ puntos, posicion }: { puntos: PuntoExistente[]; posicion: Posicion | null }) {
  const mapa = useMap();
  const puntosRef = useRef(puntos);
  puntosRef.current = puntos;
  const posicionRef = useRef(posicion);
  posicionRef.current = posicion;
  const ultimoTamanoRef = useRef({ w: 0, h: 0 });
  const movidoManualRef = useRef(false);

  useEffect(() => {
    const marcar = () => {
      movidoManualRef.current = true;
    };
    mapa.on("dragstart zoomstart", marcar);
    return () => {
      mapa.off("dragstart zoomstart", marcar);
    };
  }, [mapa]);

  useEffect(() => {
    const encuadrar = () => {
      if (movidoManualRef.current) return;
      const contenedor = mapa.getContainer();
      const w = contenedor.clientWidth;
      const h = contenedor.clientHeight;
      if (w === 0 || h === 0) return;

      const prev = ultimoTamanoRef.current;
      const cambioTamano = Math.abs(w - prev.w) > 20 || Math.abs(h - prev.h) > 20;
      if (!cambioTamano) return;

      mapa.invalidateSize({ animate: false });
      const coords: [number, number][] = puntosRef.current.map((p) => [p.latitud, p.longitud]);
      if (posicionRef.current) {
        coords.push([posicionRef.current.latitud, posicionRef.current.longitud]);
      }

      if (coords.length >= 2) {
        mapa.fitBounds(L.latLngBounds(coords), {
          padding: [40, 40],
          maxZoom: 16,
          animate: false,
        });
      } else if (coords.length === 1) {
        mapa.setView(coords[0]!, 15, { animate: false });
      }
      ultimoTamanoRef.current = { w, h };
    };

    encuadrar();
    const t = setTimeout(encuadrar, 120);
    const contenedor = mapa.getContainer();
    if (typeof ResizeObserver === "undefined") {
      return () => clearTimeout(t);
    }
    const observer = new ResizeObserver(encuadrar);
    observer.observe(contenedor);
    return () => {
      clearTimeout(t);
      observer.disconnect();
    };
  }, [mapa]);

  return null;
}

/** Recentra el mapa solo cuando la posición cambia desde la búsqueda de dirección. */
function Seguir({ posicion, centrarEn }: { posicion: Posicion | null; centrarEn?: number }) {
  const mapa = useMap();
  useEffect(() => {
    if (centrarEn && posicion) {
      mapa.setView([posicion.latitud, posicion.longitud], Math.max(mapa.getZoom(), 16));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centrarEn]);
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

export function MapaSelectorLeaflet({
  puntos,
  posicion,
  vistaBuscada,
  onElegir,
  onClicPunto,
  onMoverPunto,
  centrarEn,
  soloLectura = false,
  altura = "clamp(380px, 62vh, 640px)",
}: {
  puntos: PuntoExistente[];
  posicion: Posicion | null;
  /** Posición a enfocar desde el buscador sin colocar marcador. */
  vistaBuscada?: Posicion | null;
  onElegir: (p: Posicion) => void;
  /** Clic corto sobre un punto ya añadido. */
  onClicPunto?: (punto: PuntoExistente) => void;
  /** Al terminar de arrastrar un punto ya añadido a otra ubicación. */
  onMoverPunto?: (punto: PuntoExistente, pos: Posicion) => void;
  /** Incrementar solo al elegir una dirección en el buscador para centrar el mapa en ella. */
  centrarEn?: number;
  /** En modo solo lectura muestra los puntos ya seleccionados sin permitir colocar uno nuevo al hacer clic. */
  soloLectura?: boolean;
  altura?: number | string;
}) {
  const ultimoGestoRef = useRef(0);
  const centro: [number, number] =
    puntos.length > 0
      ? [
          puntos.reduce((s, p) => s + p.latitud, 0) / puntos.length,
          puntos.reduce((s, p) => s + p.longitud, 0) / puntos.length,
        ]
      : CENTRO_DEFECTO;

  return (
    <div style={{ height: altura }} className="overflow-hidden rounded-lg border border-borde-default">
      <MapContainer
        center={centro}
        zoom={puntos.length > 0 ? 13 : 12}
        dragging
        touchZoom
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", cursor: soloLectura ? "grab" : "crosshair" }}
      >
        <AutoResize />
        <Encuadrar puntos={puntos} posicion={posicion} />
        <CapaBase />
        {!soloLectura && <Clics onElegir={onElegir} ultimoGestoRef={ultimoGestoRef} />}
        <Seguir posicion={vistaBuscada ?? posicion} centrarEn={centrarEn} />
        {puntos.map((p) => (
          <MarcadorExistente
            key={p.id}
            punto={p}
            onClic={onClicPunto}
            onMover={onMoverPunto}
            ultimoGestoRef={ultimoGestoRef}
          />
        ))}
        {posicion && (
          <Marker
            position={[posicion.latitud, posicion.longitud]}
            icon={ICONO_NUEVO}
            draggable
            eventHandlers={{
              dragend(e) {
                const ll = (e.target as L.Marker).getLatLng();
                onElegir({ latitud: ll.lat, longitud: ll.lng });
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
