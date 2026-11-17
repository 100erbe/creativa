"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { MapaPuntos, type PosicionMapa, type PuntoMapa } from "@/components/mapa/mapa-puntos";
import { SafeMapContainer } from "@/components/shared/SafeMapContainer";

/**
 * Une el mapa general de la campaña con el formulario "Nuevo punto": la pulsación
 * larga en el mapa abre el formulario ya colocado en esa posición.
 */
type EstadoAnadirPunto = {
  abierto: boolean;
  /** Posición elegida en el mapa; `version` cambia en cada elección aunque se repita la posición. */
  desdeMapa: { posicion: PosicionMapa; version: number } | null;
  abrir: (posicion?: PosicionMapa) => void;
  cerrar: () => void;
};

const AnadirPuntoContext = createContext<EstadoAnadirPunto | null>(null);

export function useAnadirPunto() {
  const ctx = useContext(AnadirPuntoContext);
  if (!ctx) throw new Error("useAnadirPunto fuera de ProveedorAnadirPunto");
  return ctx;
}

export function ProveedorAnadirPunto({ children }: { children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const [desdeMapa, setDesdeMapa] = useState<EstadoAnadirPunto["desdeMapa"]>(null);

  const abrir = useCallback((posicion?: PosicionMapa) => {
    if (posicion) setDesdeMapa((prev) => ({ posicion, version: (prev?.version ?? 0) + 1 }));
    setAbierto(true);
  }, []);
  const cerrar = useCallback(() => {
    setAbierto(false);
    setDesdeMapa(null);
  }, []);

  const valor = useMemo(() => ({ abierto, desdeMapa, abrir, cerrar }), [abierto, desdeMapa, abrir, cerrar]);
  return <AnadirPuntoContext.Provider value={valor}>{children}</AnadirPuntoContext.Provider>;
}

/** Mapa general de la campaña (tarjeta en móvil, modal al tocarla). */
export function MapaCampana({ titulo, puntos, altura }: { titulo: string; puntos: PuntoMapa[]; altura: string }) {
  const { abrir } = useAnadirPunto();
  return (
    <SafeMapContainer title={titulo}>
      <MapaPuntos altura={altura} puntos={puntos} onAnadirPunto={abrir} />
    </SafeMapContainer>
  );
}
