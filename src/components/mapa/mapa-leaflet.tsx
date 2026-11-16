"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CapaBase } from "./capa-base";
import { colorMapa } from "@/design/tokens";

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

export function MapaLeaflet({
  puntos,
  altura = "clamp(280px, 45vh, 520px)",
}: {
  puntos: PuntoMapa[];
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
        <Encuadrar puntos={puntos} />
        <CapaBase />
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
