"use client";

import dynamic from "next/dynamic";
import type { PosicionMapa, PuntoMapa } from "./mapa-leaflet";
import type { FotoMapa } from "@/lib/mapa/zonas";

// Leaflet necesita `window` al cargarse, así que el mapa real solo se
// carga en el navegador (ssr: false). Mientras carga se muestra un
// placeholder del mismo tamaño para evitar saltos de layout.
const MapaLeaflet = dynamic(
  () => import("./mapa-leaflet").then((mod) => mod.MapaLeaflet),
  {
    ssr: false,
    loading: () => (
      <div
        style={{ height: "clamp(280px, 45vh, 520px)" }}
        className="flex items-center justify-center rounded-lg border border-borde-default bg-fondo-sutil text-sm text-texto-terciario"
      >
        Cargando mapa…
      </div>
    ),
  },
);

export type { FotoMapa, PosicionMapa, PuntoMapa };

export function MapaPuntos({
  puntos,
  fotos,
  altura,
  onAnadirPunto,
}: {
  puntos: PuntoMapa[];
  fotos?: FotoMapa[];
  altura?: number | string;
  onAnadirPunto?: (p: PosicionMapa) => void;
}) {
  return <MapaLeaflet puntos={puntos} fotos={fotos} altura={altura} onAnadirPunto={onAnadirPunto} />;
}
