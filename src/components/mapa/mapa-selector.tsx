"use client";

import dynamic from "next/dynamic";
import type { Posicion, PuntoExistente } from "./mapa-selector-leaflet";

// Leaflet necesita `window`: el mapa solo se carga en el navegador.
const MapaSelectorLeaflet = dynamic(
  () => import("./mapa-selector-leaflet").then((m) => m.MapaSelectorLeaflet),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] items-center justify-center rounded-lg border border-borde-default bg-fondo-sutil text-sm text-texto-terciario">
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
  altura?: number;
}) {
  return <MapaSelectorLeaflet {...props} />;
}
