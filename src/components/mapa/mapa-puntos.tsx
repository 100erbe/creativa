"use client";

import dynamic from "next/dynamic";
import type { PuntoMapa } from "./mapa-leaflet";

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

export type { PuntoMapa };

export function MapaPuntos({
  puntos,
  altura,
}: {
  puntos: PuntoMapa[];
  altura?: number | string;
}) {
  return <MapaLeaflet puntos={puntos} altura={altura} />;
}
