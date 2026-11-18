"use client";

import { useEffect, useRef, useState } from "react";
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

const ESPERA_PULSACION_MS = 550;
const TOLERANCIA_MOVIMIENTO_PX = 10;

function icono(color: string, tamano = 16, areaTactil = tamano) {
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${areaTactil}px;height:${areaTactil}px;touch-action:none"><span style="display:block;width:${tamano}px;height:${tamano}px;border-radius:50%;background:${color};border:2px solid ${colorMapa.contorno};box-shadow:0 1px 4px ${colorMapa.sombra}"></span></span>`,
    iconSize: [areaTactil, areaTactil],
    iconAnchor: [areaTactil / 2, areaTactil / 2],
    popupAnchor: [0, -tamano / 2],
  });
}
const ICONO_EXISTENTE = icono(colorMapa.estado.retirado, 16, 32);
const ICONO_NUEVO = icono(colorMapa.defecto, 22, 32);

// Centro por defecto: Málaga (zona habitual de trabajo de Creativa).
const CENTRO_DEFECTO: [number, number] = [36.7213, -4.4214];

function Clics({
  onElegir,
  ultimaPulsacionLargaRef,
  ultimoGestoRef,
}: {
  onElegir: (p: Posicion) => void;
  ultimaPulsacionLargaRef: React.MutableRefObject<number>;
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
      const ahora = Date.now();
      if (ahora - ultimaPulsacionLargaRef.current < 600) return;
      if (ahora - ultimoGestoRef.current < 320) return;
      const destino = e.originalEvent.target as HTMLElement | null;
      if (destino?.closest(".leaflet-marker-icon")) return;
      onElegir({ latitud: e.latlng.lat, longitud: e.latlng.lng });
    },
  });
  return null;
}

/**
 * Marcador de punto ya añadido. Soporta clic corto (editar detalles), arrastre (mover ubicación)
 * y pulsación larga / clic derecho (eliminar), sin interferir con el arrastre ni zoom del mapa.
 */
function MarcadorExistente({
  punto,
  onClic,
  onMover,
  onPulsacionLarga,
  ultimaPulsacionLargaRef,
  ultimoGestoRef,
}: {
  punto: PuntoExistente;
  onClic?: (p: PuntoExistente) => void;
  onMover?: (p: PuntoExistente, pos: Posicion) => void;
  onPulsacionLarga?: (p: PuntoExistente) => void;
  ultimaPulsacionLargaRef: React.MutableRefObject<number>;
  ultimoGestoRef: React.MutableRefObject<number>;
}) {
  const mapa = useMap();
  const markerRef = useRef<L.Marker>(null);
  const [elemento, setElemento] = useState<HTMLElement | null>(null);
  const onClicRef = useRef(onClic);
  onClicRef.current = onClic;
  const onMoverRef = useRef(onMover);
  onMoverRef.current = onMover;
  const callbackRef = useRef(onPulsacionLarga);
  callbackRef.current = onPulsacionLarga;
  const puntoRef = useRef(punto);
  puntoRef.current = punto;
  const disparadoEnRef = useRef(0);
  const habilitado = Boolean(onPulsacionLarga);
  const arrastrable = Boolean(onMover) && (!punto.estado || punto.estado === "pendiente");

  useEffect(() => {
    setElemento(markerRef.current?.getElement() ?? null);
  }, [punto.id, punto.latitud, punto.longitud]);

  useEffect(() => {
    if (!elemento || !habilitado) return;

    elemento.style.setProperty("-webkit-touch-callout", "none");
    elemento.style.setProperty("user-select", "none");
    elemento.style.setProperty("touch-action", "none");

    let temporizador: ReturnType<typeof setTimeout> | null = null;
    let inicio: { x: number; y: number } | null = null;
    let activoPointerId: number | null = null;

    const limpiarEscuchasVentana = () => {
      window.removeEventListener("pointermove", alMover);
      window.removeEventListener("pointerup", alSoltar);
      window.removeEventListener("pointercancel", alSoltar);
    };

    const cancelar = () => {
      if (temporizador) clearTimeout(temporizador);
      temporizador = null;
      inicio = null;
      activoPointerId = null;
      limpiarEscuchasVentana();
    };

    const disparar = () => {
      const ahora = Date.now();
      disparadoEnRef.current = ahora;
      ultimaPulsacionLargaRef.current = ahora;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(15);
      markerRef.current?.closePopup();
      callbackRef.current?.(puntoRef.current);
    };

    function alMover(e: PointerEvent) {
      if (!inicio || e.pointerId !== activoPointerId) return;
      if (Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > TOLERANCIA_MOVIMIENTO_PX) {
        cancelar();
      }
    }

    function alSoltar(e: PointerEvent) {
      if (e.pointerId !== activoPointerId) return;
      cancelar();
    }

    const alPulsar = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      cancelar();
      inicio = { x: e.clientX, y: e.clientY };
      activoPointerId = e.pointerId;
      window.addEventListener("pointermove", alMover);
      window.addEventListener("pointerup", alSoltar);
      window.addEventListener("pointercancel", alSoltar);
      temporizador = setTimeout(() => {
        temporizador = null;
        inicio = null;
        activoPointerId = null;
        limpiarEscuchasVentana();
        disparar();
      }, ESPERA_PULSACION_MS);
    };

    const alClic = (e: MouseEvent) => {
      if (Date.now() - disparadoEnRef.current < 600) {
        e.preventDefault();
        e.stopPropagation();
        markerRef.current?.closePopup();
      }
    };

    const alMenuContextual = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      cancelar();
      disparar();
    };

    elemento.addEventListener("pointerdown", alPulsar);
    elemento.addEventListener("click", alClic, true);
    elemento.addEventListener("contextmenu", alMenuContextual);
    mapa.on("movestart zoomstart", cancelar);

    return () => {
      cancelar();
      elemento.removeEventListener("pointerdown", alPulsar);
      elemento.removeEventListener("click", alClic, true);
      elemento.removeEventListener("contextmenu", alMenuContextual);
      mapa.off("movestart zoomstart", cancelar);
    };
  }, [elemento, mapa, habilitado, ultimaPulsacionLargaRef]);

  return (
    <Marker
      ref={markerRef}
      position={[punto.latitud, punto.longitud]}
      icon={ICONO_EXISTENTE}
      draggable={arrastrable}
      eventHandlers={{
        add(e) {
          setElemento((e.target as L.Marker).getElement() ?? null);
        },
        click() {
          if (Date.now() - disparadoEnRef.current < 600) return;
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
  onPulsacionLargaPunto,
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
  /** Si se pasa, una pulsación larga (o clic derecho) sobre un punto existente llama a esta acción. */
  onPulsacionLargaPunto?: (punto: PuntoExistente) => void;
  /** Incrementar solo al elegir una dirección en el buscador para centrar el mapa en ella. */
  centrarEn?: number;
  /** En modo solo lectura muestra los puntos ya seleccionados sin permitir colocar uno nuevo al hacer clic. */
  soloLectura?: boolean;
  altura?: number | string;
}) {
  const ultimaPulsacionLargaRef = useRef(0);
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
        {!soloLectura && (
          <Clics
            onElegir={onElegir}
            ultimaPulsacionLargaRef={ultimaPulsacionLargaRef}
            ultimoGestoRef={ultimoGestoRef}
          />
        )}
        <Seguir posicion={vistaBuscada ?? posicion} centrarEn={centrarEn} />
        {puntos.map((p) => (
          <MarcadorExistente
            key={p.id}
            punto={p}
            onClic={onClicPunto}
            onMover={onMoverPunto}
            onPulsacionLarga={onPulsacionLargaPunto}
            ultimaPulsacionLargaRef={ultimaPulsacionLargaRef}
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
