"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CapaBase } from "./capa-base";
import { colorMapa } from "@/design/tokens";

// Mapa para elegir la ubicación de un punto: clic en el mapa = nueva posición.
// Muestra también los puntos ya creados de la campaña.

export type PuntoExistente = { id: number; nombre: string; latitud: number; longitud: number; detalle?: string };
export type Posicion = { latitud: number; longitud: number };

function icono(color: string, tamano = 16) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:${tamano}px;height:${tamano}px;border-radius:50%;background:${color};border:2px solid ${colorMapa.contorno};box-shadow:0 1px 4px ${colorMapa.sombra}"></span>`,
    iconSize: [tamano, tamano],
    iconAnchor: [tamano / 2, tamano / 2],
    popupAnchor: [0, -tamano / 2],
  });
}
const ICONO_EXISTENTE = icono(colorMapa.estado.retirado);
const ICONO_NUEVO = icono(colorMapa.defecto, 22);

// Centro por defecto: Málaga (zona habitual de trabajo de Creativa).
const CENTRO_DEFECTO: [number, number] = [36.7213, -4.4214];

function Clics({ onElegir }: { onElegir: (p: Posicion) => void }) {
  useMapEvents({
    click(e) {
      onElegir({ latitud: e.latlng.lat, longitud: e.latlng.lng });
    },
  });
  return null;
}

/** Recentra el mapa cuando la posición elegida cambia desde fuera (búsqueda de dirección). */
function Seguir({ posicion }: { posicion: Posicion | null }) {
  const mapa = useMap();
  useEffect(() => {
    if (posicion) mapa.setView([posicion.latitud, posicion.longitud], Math.max(mapa.getZoom(), 16));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posicion?.latitud, posicion?.longitud]);
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
  onElegir,
  altura = "clamp(380px, 62vh, 640px)",
}: {
  puntos: PuntoExistente[];
  posicion: Posicion | null;
  onElegir: (p: Posicion) => void;
  altura?: number | string;
}) {
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
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", cursor: "crosshair" }}
      >
        <AutoResize />
        <CapaBase />
        <Clics onElegir={onElegir} />
        <Seguir posicion={posicion} />
        {puntos.map((p) => (
          <Marker key={p.id} position={[p.latitud, p.longitud]} icon={ICONO_EXISTENTE}>
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
