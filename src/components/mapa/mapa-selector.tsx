"use client";

import dynamic from "next/dynamic";
import type { Posicion, PuntoExistente } from "./mapa-selector-leaflet";

// Leaflet necesita `window`: el mapa solo se carga en el navegador.
const MapaSelectorLeaflet = dynamic(
  () => import("./mapa-selector-leaflet").then((m) => m.MapaSelectorLeaflet),
  {
    ssr: false,
    loading: () => (
      <div
        style={{ height: "clamp(380px, 62vh, 640px)" }}
        className="flex items-center justify-center rounded-lg border border-borde-default bg-fondo-sutil text-sm text-texto-terciario"
      >
        Cargando mapa…
      </div>
    ),
  },
);

export type { Posicion, PuntoExistente };

export function MapaSelector(props: {
  puntos: PuntoExistente[];
  posicion: Posicion | null;
  onElegir: (p: Posicion) => void;
  altura?: number | string;
}) {
  return <MapaSelectorLeaflet {...props} />;
}
