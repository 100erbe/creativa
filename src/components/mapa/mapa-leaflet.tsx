"use client";

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

// Mismos colores que supabase/LEEME.txt ↔ TONO_POR_ESTADO (ver insignia.tsx),
// pero en hexadecimal: el HTML de un icono de Leaflet no pasa por Tailwind.
const COLOR_POR_ESTADO: Record<string, string> = {
  pendiente: "#B45309", // aviso
  instalado: "#15803D", // éxito
  verificado: "#15803D", // éxito
  incidencia: "#B91C1C", // peligro
  retirado: "#78716C", // neutro
};
const COLOR_DEFECTO = "#C2410C"; // marca

function iconoPunto(color: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #FFFFFF;box-shadow:0 1px 4px rgba(28,25,23,0.45)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

export function MapaLeaflet({
  puntos,
  altura = 280,
}: {
  puntos: PuntoMapa[];
  altura?: number;
}) {
  if (puntos.length === 0) {
    return (
      <div
        style={{ height: altura }}
        className="flex items-center justify-center rounded-lg border border-dashed border-borde-fuerte bg-fondo-sutil text-sm text-texto-terciario"
      >
        No hay puntos con ubicación para mostrar.
      </div>
    );
  }

  const centro: [number, number] =
    puntos.length === 1
      ? [puntos[0].latitud, puntos[0].longitud]
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
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">colaboradores de OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
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
