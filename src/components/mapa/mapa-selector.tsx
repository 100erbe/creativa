"use client";

import dynamic from "next/dynamic";
import type { BBoxVista, Posicion, PuntoExistente, ZonaPrevia } from "./mapa-selector-leaflet";
import type { DistritoOSM, FotoMapa } from "@/lib/mapa/zonas";

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

export type { BBoxVista, DistritoOSM, FotoMapa, Posicion, PuntoExistente, ZonaPrevia };

export function MapaSelector(props: {
  puntos: PuntoExistente[];
  fotos?: FotoMapa[];
  posicion: Posicion | null;
  vistaBuscada?: Posicion | null;
  zonaPrevia?: ZonaPrevia | null;
  distritos?: DistritoOSM[];
  creandoEn?: Posicion | null;
  onElegir: (p: Posicion) => void;
  onClicPunto?: (punto: PuntoExistente) => void;
  onMoverPunto?: (punto: PuntoExistente, pos: Posicion) => boolean | void | Promise<boolean | void>;
  onClicDistrito?: (distrito: DistritoOSM) => void;
  onCambioVista?: (bbox: BBoxVista) => void;
  centrarEn?: number;
  soloLectura?: boolean;
  zoomConRueda?: boolean;
  altura?: number | string;
}) {
  return <MapaSelectorLeaflet {...props} />;
}
