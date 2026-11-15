"use client";

import { useEffect, useState } from "react";
import { TileLayer, useMap } from "react-leaflet";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  MAPA_ATRIBUCION,
  MAPA_ATRIBUCION_VECTORIAL,
  MAPA_ESTILO,
  MAPA_SUBDOMINIOS,
  MAPA_TESELAS,
} from "./config-mapa";

function hayWebGL() {
  try {
    const lienzo = document.createElement("canvas");
    return Boolean(lienzo.getContext("webgl2") ?? lienzo.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Mapa base de todos los mapas de la app. Se dibuja con MapLibre (vectorial) con el estilo "positron" de
 * OpenFreeMap: calles y nombres, sin los iconos de comercios, iglesias o museos que tapaban los puntos.
 *
 * Si el móvil no admite WebGL, o el estilo no se puede cargar, se usa el mapa de imágenes de OpenStreetMap
 * (con iconos, pero siempre funciona).
 */
export function CapaBase() {
  const mapa = useMap();
  const [alternativa, setAlternativa] = useState(false);

  useEffect(() => {
    if (!hayWebGL()) {
      setAlternativa(true);
      return;
    }
    // `attribution` es una opción de capa de Leaflet que los tipos de MapLibre no conocen.
    const capa = maplibreGL({ style: MAPA_ESTILO, attribution: MAPA_ATRIBUCION_VECTORIAL } as Parameters<typeof maplibreGL>[0]);
    capa.addTo(mapa);

    const gl = capa.getMaplibreMap();
    const fallo = () => {
      // Los errores sueltos de una tesela no importan; si el propio estilo no cargó, se cambia de mapa.
      if (!gl.isStyleLoaded()) setAlternativa(true);
    };
    gl.on("error", fallo);

    return () => {
      gl.off("error", fallo);
      mapa.removeLayer(capa);
    };
  }, [mapa]);

  return alternativa ? (
    <TileLayer attribution={MAPA_ATRIBUCION} url={MAPA_TESELAS} subdomains={MAPA_SUBDOMINIOS} maxZoom={19} />
  ) : null;
}
