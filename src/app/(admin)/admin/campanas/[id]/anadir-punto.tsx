"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MapaPuntos, type PuntoMapa } from "@/components/mapa/mapa-puntos";
import { MapaSelector, type Posicion } from "@/components/mapa/mapa-selector";
import { BuscadorDireccion, type Sugerencia } from "@/components/mapa/buscador-direccion";
import { ALTURA_MAPA_MEDIA } from "@/components/mapa/config-mapa";
import { SafeMapContainer, useSafeMap } from "@/components/shared/SafeMapContainer";
import { Boton } from "@/components/ui/boton";
import { cn } from "@/lib/cn";
import { FormularioPunto, type ArticuloPunto, type PuntoEditable } from "./formulario-punto";

/**
 * Alta y edición de puntos con un único mapa: mientras el formulario está abierto,
 * el mapa general de la campaña pasa a "modo colocar" (clic = posición del punto)
 * y el formulario, ya sin mapa propio, aparece a su lado (o debajo en pantallas estrechas).
 */
type Modo = { tipo: "nuevo" } | { tipo: "editar"; punto: PuntoEditable };

type EstadoPunto = {
  modo: Modo | null;
  posicion: Posicion | null;
  /** Dirección propuesta tras elegir posición; `version` cambia en cada propuesta. */
  direccionSugerida: { texto: string; version: number } | null;
  nuevo: (posicion?: Posicion) => void;
  editar: (punto: PuntoEditable) => void;
  cerrar: () => void;
  elegirPosicion: (posicion: Posicion) => void;
  elegirBusqueda: (sugerencia: Sugerencia) => void;
  datos: DatosCampana;
};

type DatosCampana = {
  campanaId: number;
  articulos: ArticuloPunto[];
  fechasCampana: { inicio: string | null; fin: string | null };
  otrosPuntos: { id: number; nombre: string; latitud: number; longitud: number }[];
};

const PuntoContext = createContext<EstadoPunto | null>(null);

export function useAnadirPunto() {
  const ctx = useContext(PuntoContext);
  if (!ctx) throw new Error("useAnadirPunto fuera de ProveedorAnadirPunto");
  return ctx;
}

async function direccionDe(p: Posicion) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&accept-language=es&lat=${p.latitud}&lon=${p.longitud}`,
    );
    const d = (await r.json()) as { display_name?: string; address?: Record<string, string> };
    const a = d.address ?? {};
    const calle = [a.road ?? a.pedestrian ?? a.square, a.house_number].filter(Boolean).join(" ");
    const ciudad = a.city ?? a.town ?? a.village ?? a.municipality;
    return [calle, ciudad].filter(Boolean).join(", ") || d.display_name || "";
  } catch {
    return "";
  }
}

export function ProveedorAnadirPunto({ children, ...datos }: DatosCampana & { children: React.ReactNode }) {
  const [modo, setModo] = useState<Modo | null>(null);
  const [posicion, setPosicion] = useState<Posicion | null>(null);
  const [direccionSugerida, setDireccionSugerida] = useState<EstadoPunto["direccionSugerida"]>(null);
  // Solo vale la última búsqueda de dirección (si se mueve el punto varias veces seguidas).
  const ultimaConsulta = useRef(0);

  const proponer = useCallback((texto: string) => {
    setDireccionSugerida((prev) => ({ texto, version: (prev?.version ?? 0) + 1 }));
  }, []);

  const elegirPosicion = useCallback(
    (p: Posicion) => {
      setPosicion(p);
      const consulta = ++ultimaConsulta.current;
      void direccionDe(p).then((d) => {
        if (d && consulta === ultimaConsulta.current) proponer(d);
      });
    },
    [proponer],
  );

  const elegirBusqueda = useCallback(
    (s: Sugerencia) => {
      ultimaConsulta.current++;
      setPosicion({ latitud: s.latitud, longitud: s.longitud });
      proponer(s.direccion);
    },
    [proponer],
  );

  const nuevo = useCallback(
    (p?: Posicion) => {
      ultimaConsulta.current++;
      setModo({ tipo: "nuevo" });
      setPosicion(null);
      setDireccionSugerida(null);
      if (p) elegirPosicion(p);
    },
    [elegirPosicion],
  );

  const editar = useCallback((punto: PuntoEditable) => {
    ultimaConsulta.current++;
    setModo({ tipo: "editar", punto });
    setPosicion({ latitud: punto.latitud, longitud: punto.longitud });
    setDireccionSugerida(null);
  }, []);

  const cerrar = useCallback(() => {
    ultimaConsulta.current++;
    setModo(null);
    setPosicion(null);
    setDireccionSugerida(null);
  }, []);

  const valor = useMemo(
    () => ({ modo, posicion, direccionSugerida, nuevo, editar, cerrar, elegirPosicion, elegirBusqueda, datos }),
    // `datos` llega del servidor y solo cambia al refrescar la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modo, posicion, direccionSugerida, nuevo, editar, cerrar, elegirPosicion, elegirBusqueda, JSON.stringify(datos)],
  );
  return <PuntoContext.Provider value={valor}>{children}</PuntoContext.Provider>;
}

function nombreVisible(nombre: string) {
  const limpio = nombre.trim();
  return /^\d+$/.test(limpio) ? `Punto ${limpio}` : limpio;
}

/** Mapa de selección dentro de SafeMapContainer (tarjeta o modal móvil). */
function MapaColocar() {
  const { enModal, cerrar: cerrarModal } = useSafeMap();
  const { modo, posicion, elegirPosicion, datos } = useAnadirPunto();
  const excluido = modo?.tipo === "editar" ? modo.punto.id : null;
  return (
    <div className="relative h-full max-md:[&>*:first-child]:!h-full">
      <MapaSelector
        puntos={datos.otrosPuntos.filter((p) => p.id !== excluido).map((p) => ({ ...p, nombre: nombreVisible(p.nombre) }))}
        posicion={posicion}
        onElegir={elegirPosicion}
        altura={enModal ? "100%" : ALTURA_MAPA_MEDIA}
      />
      {enModal && posicion && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] flex justify-center p-esp4 pb-esp6">
          <Boton type="button" className="pointer-events-auto min-h-11 shadow-md" onClick={cerrarModal}>
            Usar esta ubicación
          </Boton>
        </div>
      )}
    </div>
  );
}

/**
 * Bloque del mapa de la campaña. En reposo: mapa general + `resumen` al lado.
 * Con el formulario abierto: buscador + mapa en modo colocar + formulario al lado.
 */
export function ZonaMapaCampana({
  titulo,
  puntos,
  altura,
  resumen,
}: {
  titulo: string;
  puntos: PuntoMapa[];
  altura: string;
  resumen?: React.ReactNode;
}) {
  const { modo, posicion, nuevo, cerrar, elegirBusqueda } = useAnadirPunto();
  const zona = useRef<HTMLDivElement>(null);
  const claveModo = modo ? (modo.tipo === "nuevo" ? "nuevo" : `editar-${modo.punto.id}`) : null;

  // Al abrir el formulario (desde el botón, la lista o el propio mapa) se lleva el bloque a la vista.
  useEffect(() => {
    if (!claveModo) return;
    const t = setTimeout(() => zona.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    return () => clearTimeout(t);
  }, [claveModo]);

  const nombreEditado = modo?.tipo === "editar" ? nombreVisible(modo.punto.nombre) : null;

  return (
    <div
      ref={zona}
      className={cn(
        "scroll-mt-esp3",
        modo
          ? "grid grid-cols-1 gap-esp4 xl:grid-cols-[1fr_360px]"
          : resumen
            ? "grid grid-cols-1 gap-esp4 xl:grid-cols-[1fr_320px]"
            : "",
      )}
    >
      <div className="flex min-w-0 flex-col gap-esp2">
        {modo && (
          <>
            <BuscadorDireccion onElegir={elegirBusqueda} />
            <div className="flex items-center justify-between gap-esp3 rounded-md border border-borde-foco bg-fondo-sutil px-esp3 py-esp2">
              <p className="text-xs text-texto-primario">
                {nombreEditado ? <strong className="font-semibold">{nombreEditado}: </strong> : null}
                {posicion
                  ? "Toca el mapa o arrastra el punto para ajustarlo."
                  : "Toca el mapa para colocar el punto."}
              </p>
              <button
                type="button"
                onClick={cerrar}
                className="inline-flex min-h-11 shrink-0 items-center rounded-md px-esp2 text-xs font-medium text-texto-secundario hover:text-texto-primario md:min-h-8"
              >
                Cancelar
              </button>
            </div>
          </>
        )}
        <SafeMapContainer
          title={modo ? (nombreEditado ? `Ubicación · ${nombreEditado}` : "Elige la ubicación del punto") : titulo}
          exploreLabel={modo ? (posicion ? "Ajustar en el mapa" : "Colocar en el mapa") : undefined}
        >
          {modo ? <MapaColocar /> : <MapaPuntos altura={altura} puntos={puntos} onAnadirPunto={nuevo} />}
        </SafeMapContainer>
      </div>

      {modo ? <FormularioPunto key={claveModo} /> : resumen}
    </div>
  );
}
