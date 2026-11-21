"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { MapaInteractivoCampana } from "@/components/mapa/mapa-interactivo-campana";
import {
  ModalDetallesPunto,
  type ArticuloModalData,
  type PuntoModalData,
} from "@/components/mapa/modal-detalles-punto";
import { TarjetaDeslizablePunto } from "@/components/mapa/tarjeta-deslizable-punto";
import { desenvolver } from "@/lib/accion";
import { ETIQUETA_SOPORTE } from "@/lib/etiquetas";
import { nombreVisiblePunto } from "@/lib/mapa/geocodificacion";
import type { FotoMapa } from "@/lib/mapa/zonas";
import { anadirPuntoCampana, eliminarPuntoCampana, guardarPunto, moverPuntoCampana } from "./acciones";

export type ArticuloPunto = ArticuloModalData & {
  documento: string;
  repartidas: number;
};

export type PuntoCampanaData = PuntoModalData & {
  estado: string;
  tieneFotos: boolean;
};

type EstadoPunto = {
  editar: (punto: PuntoCampanaData) => void;
  editarPorId: (puntoId: number) => void;
  swipeAbiertoId: number | null;
  abrirSwipe: (puntoId: number) => void;
  cerrarSwipe: (puntoId: number) => void;
  datos: {
    campanaId: number;
    articulos: ArticuloPunto[];
    fechasCampana: { inicio: string | null; fin: string | null };
    puntos: PuntoCampanaData[];
    fotos: FotoMapa[];
  };
};

const PuntoContext = createContext<EstadoPunto | null>(null);

export function useAnadirPunto() {
  const ctx = useContext(PuntoContext);
  if (!ctx) throw new Error("useAnadirPunto fuera de ProveedorAnadirPunto");
  return ctx;
}

function esEliminable(p: PuntoCampanaData) {
  return (p.estado === "pendiente" || p.estado === "incidencia") && !p.tieneFotos;
}

export function ProveedorAnadirPunto({
  campanaId,
  articulos,
  fechasCampana,
  puntos,
  fotos = [],
  children,
}: {
  campanaId: number;
  articulos: ArticuloPunto[];
  fechasCampana: { inicio: string | null; fin: string | null };
  puntos: PuntoCampanaData[];
  fotos?: FotoMapa[];
  children: React.ReactNode;
}) {
  const [puntoModal, setPuntoModal] = useState<PuntoCampanaData | null>(null);
  const [swipeAbiertoId, setSwipeAbiertoId] = useState<number | null>(null);

  const editar = useCallback((punto: PuntoCampanaData) => {
    setSwipeAbiertoId(null);
    setPuntoModal(punto);
  }, []);

  const editarPorId = useCallback(
    (puntoId: number) => {
      const encontrado = puntos.find((p) => p.id === puntoId);
      if (encontrado) {
        setSwipeAbiertoId(null);
        setPuntoModal(encontrado);
      }
    },
    [puntos],
  );

  const abrirSwipe = useCallback((puntoId: number) => setSwipeAbiertoId(puntoId), []);
  const cerrarSwipe = useCallback(
    (puntoId: number) => setSwipeAbiertoId((actual) => (actual === puntoId ? null : actual)),
    [],
  );

  const puntoModalActual = puntoModal ? (puntos.find((x) => x.id === puntoModal.id) ?? puntoModal) : null;

  const valor = useMemo<EstadoPunto>(
    () => ({
      editar,
      editarPorId,
      swipeAbiertoId,
      abrirSwipe,
      cerrarSwipe,
      datos: { campanaId, articulos, fechasCampana, puntos, fotos },
    }),
    [editar, editarPorId, swipeAbiertoId, abrirSwipe, cerrarSwipe, campanaId, articulos, fechasCampana, puntos, fotos],
  );

  return (
    <PuntoContext.Provider value={valor}>
      {children}
      {puntoModalActual && (
        <ModalDetallesPunto
          punto={puntoModalActual}
          articulos={articulos}
          puntos={puntos}
          permitirSoporteLibre
          onGuardar={(datos) =>
            desenvolver(
              guardarPunto(campanaId, puntoModalActual.id, {
                tipoSoporte: datos.tipoSoporte,
                lineaId: datos.lineaId,
                direccion: datos.direccion,
                latitud: puntoModalActual.latitud,
                longitud: puntoModalActual.longitud,
                piezas: datos.piezas,
                fechaColocacion: datos.fecha_colocacion_prevista,
                fechaRetirada: datos.fecha_retirada_prevista,
                instrucciones: datos.notas,
                radioMetros: datos.radioMetros,
              }),
            )
          }
          onEliminar={
            esEliminable(puntoModalActual)
              ? () => desenvolver(eliminarPuntoCampana(campanaId, puntoModalActual.id))
              : undefined
          }
          onCerrar={() => setPuntoModal(null)}
        />
      )}
    </PuntoContext.Provider>
  );
}

/**
 * Bloque del mapa de la campaña a ancho completo.
 * Usa exactamente la misma experiencia de mapa a pantalla completa que el wizard.
 */
export function ZonaMapaCampana({ titulo }: { titulo: string }) {
  const { editar, datos } = useAnadirPunto();
  const { campanaId, fechasCampana, puntos, fotos } = datos;

  return (
    <MapaInteractivoCampana
      tituloModal={titulo}
      puntos={puntos.map((p) => ({
        ...p,
        detalle: ETIQUETA_SOPORTE[p.tipo_soporte],
      }))}
      fotos={fotos}
      onCrearPunto={async ({ pos, direccionInicial, tipoUbicacion, radioMetros, geometria }) => {
        const creado = await desenvolver(
          anadirPuntoCampana(campanaId, {
            direccion: direccionInicial,
            latitud: pos.latitud,
            longitud: pos.longitud,
            fechaColocacion: fechasCampana.inicio ?? "",
            fechaRetirada: fechasCampana.fin ?? "",
            tipoUbicacion,
            radioMetros,
            geometria,
          }),
        );
        return {
          ...creado,
          tieneFotos: false,
          detalle: ETIQUETA_SOPORTE[creado.tipo_soporte],
        };
      }}
      onMoverPunto={(p, nuevaPos, dir) =>
        desenvolver(moverPuntoCampana(campanaId, p.id, nuevaPos.latitud, nuevaPos.longitud, dir))
      }
      onAbrirPunto={(p) => editar(p)}
      onActualizarDireccionTardia={(creado, dirTardia) => {
        void moverPuntoCampana(campanaId, creado.id, creado.latitud, creado.longitud, dirTardia);
      }}
    />
  );
}

/** Envuelve cada fila de punto de la ficha de campaña con clic-para-editar y swipe-para-eliminar. */
export function TarjetaPuntoCampana({
  punto,
  className,
  children,
}: {
  punto: PuntoCampanaData;
  className?: string;
  children: React.ReactNode;
}) {
  const { editar, swipeAbiertoId, abrirSwipe, cerrarSwipe, datos } = useAnadirPunto();

  return (
    <TarjetaDeslizablePunto
      nombreVisible={nombreVisiblePunto(punto.nombre)}
      eliminable={esEliminable(punto)}
      swipeAbierto={swipeAbiertoId === punto.id}
      onAbrirSwipe={() => abrirSwipe(punto.id)}
      onCerrarSwipe={() => cerrarSwipe(punto.id)}
      onAbrirModal={() => editar(punto)}
      onEliminar={() => desenvolver(eliminarPuntoCampana(datos.campanaId, punto.id))}
      className={className}
    >
      {children}
    </TarjetaDeslizablePunto>
  );
}
