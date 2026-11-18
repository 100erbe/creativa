"use client";

import { useEffect, useRef, useState } from "react";
import { BuscadorDireccion, type Sugerencia } from "@/components/mapa/buscador-direccion";
import { MapaSelector, type Posicion, type PuntoExistente } from "@/components/mapa/mapa-selector";
import { SafeMapContainer, useSafeMap } from "@/components/shared/SafeMapContainer";
import { confirmar } from "@/components/ui/dialogos";
import { direccionDe, nombreVisiblePunto } from "@/lib/mapa/geocodificacion";
import { useAccion } from "@/lib/use-accion";

/**
 * Mapa interactivo unificado (wizard de documentos y ficha de campaña):
 * - Vista previa compacta con CTA primario "Añadir o modificar puntos" en ambos breakpoints.
 * - Modal a tamaño máximo de viewport con buscador, microanimación en clic vacío, edición por clic y drag optimista con confirmación.
 */
export function MapaInteractivoCampana<T extends PuntoExistente>({
  tituloModal,
  puntos,
  onCrearPunto,
  onMoverPunto,
  onAbrirPunto,
  onActualizarDireccionTardia,
}: {
  tituloModal: string;
  puntos: T[];
  onCrearPunto: (datos: { pos: Posicion; direccionInicial: string }) => Promise<T>;
  onMoverPunto: (punto: T, nuevaPos: Posicion, direccion?: string) => Promise<void>;
  onAbrirPunto: (punto: T) => void;
  onActualizarDireccionTardia?: (punto: T, direccion: string) => void;
}) {
  const { pendiente, error, setError, ejecutar } = useAccion({ refrescar: true });
  const [modalAbierto, setModalAbierto] = useState(false);
  const [vistaBuscada, setVistaBuscada] = useState<Posicion | null>(null);
  const [centrarEn, setCentrarEn] = useState(0);
  const [creandoPos, setCreandoPos] = useState<Posicion | null>(null);
  const [movimientosPendientes, setMovimientosPendientes] = useState<Record<number, Posicion>>({});
  const creandoRef = useRef(false);

  // Limpia coordenadas optimistas cuando el servidor ya refleja la posición actualizada.
  useEffect(() => {
    setMovimientosPendientes((prev) => {
      const ids = Object.keys(prev);
      if (ids.length === 0) return prev;
      let cambio = false;
      const siguiente = { ...prev };
      for (const idStr of ids) {
        const id = Number(idStr);
        const pos = prev[id];
        const srv = puntos.find((p) => p.id === id);
        if (
          !srv ||
          !pos ||
          (Math.abs(srv.latitud - pos.latitud) < 1e-6 && Math.abs(srv.longitud - pos.longitud) < 1e-6)
        ) {
          delete siguiente[id];
          cambio = true;
        }
      }
      return cambio ? siguiente : prev;
    });
  }, [puntos]);

  function elegirBusqueda(sugerencia: Sugerencia) {
    setVistaBuscada({ latitud: sugerencia.latitud, longitud: sugerencia.longitud });
    setCentrarEn((n) => n + 1);
    setError(null);
  }

  function elegirEnMapa(p: Posicion) {
    if (!modalAbierto || pendiente || creandoRef.current) return;
    creandoRef.current = true;
    setError(null);
    setCreandoPos(p);
    const promesaDireccion = direccionDe(p);
    const pausaAnimacion = new Promise<void>((r) => setTimeout(r, 450));

    ejecutar(async () => {
      try {
        const dirInicial = await Promise.race([
          promesaDireccion,
          new Promise<string>((r) => setTimeout(() => r(""), 420)),
        ]);
        const [creado] = await Promise.all([
          onCrearPunto({ pos: p, direccionInicial: dirInicial }),
          pausaAnimacion,
        ]);
        setCreandoPos(null);
        onAbrirPunto(creado);
        if (!dirInicial && onActualizarDireccionTardia) {
          void promesaDireccion.then((dirTardia) => {
            if (!dirTardia) return;
            onActualizarDireccionTardia(creado, dirTardia);
          });
        }
      } finally {
        setCreandoPos(null);
        creandoRef.current = false;
      }
    });
  }

  function clicEnPuntoExistente(punto: PuntoExistente) {
    const encontrado = puntos.find((x) => x.id === punto.id);
    if (encontrado) onAbrirPunto(encontrado);
  }

  async function moverPuntoEnMapa(punto: PuntoExistente, nuevaPos: Posicion): Promise<boolean> {
    if (pendiente || creandoRef.current) return false;
    const original = puntos.find((x) => x.id === punto.id);
    if (!original) return false;

    setMovimientosPendientes((prev) => ({ ...prev, [punto.id]: nuevaPos }));
    if (!(await confirmar(`¿Mover «${nombreVisiblePunto(punto.nombre)}» a esta nueva ubicación?`))) {
      setMovimientosPendientes((prev) => {
        const copia = { ...prev };
        delete copia[punto.id];
        return copia;
      });
      return false;
    }

    setError(null);
    const promesaDir = direccionDe(nuevaPos);
    ejecutar(async () => {
      try {
        const dir = await Promise.race([
          promesaDir,
          new Promise<string>((r) => setTimeout(() => r(""), 650)),
        ]);
        await onMoverPunto(original, nuevaPos, dir || undefined);
      } catch (err) {
        setMovimientosPendientes((prev) => {
          const copia = { ...prev };
          delete copia[punto.id];
          return copia;
        });
        throw err;
      }
    });
    return true;
  }

  const puntosMapa: PuntoExistente[] = puntos.map((p) => {
    const pos = movimientosPendientes[p.id];
    return {
      id: p.id,
      nombre: nombreVisiblePunto(p.nombre),
      latitud: pos ? pos.latitud : p.latitud,
      longitud: pos ? pos.longitud : p.longitud,
      detalle: p.detalle,
      estado: p.estado,
    };
  });

  return (
    <div className="flex flex-col gap-esp3">
      <SafeMapContainer
        modalSiempre
        tamanoMaximo
        varianteTrigger="primario"
        exploreIcon="ubicacion"
        title={tituloModal}
        exploreLabel="Añadir o modificar puntos"
        open={modalAbierto}
        onOpenChange={setModalAbierto}
      >
        <ContenidoMapaCampana
          puntosMapa={puntosMapa}
          vistaBuscada={vistaBuscada}
          creandoPos={creandoPos}
          centrarEn={centrarEn}
          pendiente={pendiente}
          onElegir={elegirEnMapa}
          onClicPunto={clicEnPuntoExistente}
          onMoverPunto={moverPuntoEnMapa}
          onElegirBusqueda={elegirBusqueda}
        />
      </SafeMapContainer>

      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}

function ContenidoMapaCampana({
  puntosMapa,
  vistaBuscada,
  creandoPos,
  centrarEn,
  pendiente,
  onElegir,
  onClicPunto,
  onMoverPunto,
  onElegirBusqueda,
}: {
  puntosMapa: PuntoExistente[];
  vistaBuscada: Posicion | null;
  creandoPos: Posicion | null;
  centrarEn: number;
  pendiente: boolean;
  onElegir: (p: Posicion) => void;
  onClicPunto: (p: PuntoExistente) => void;
  onMoverPunto: (p: PuntoExistente, pos: Posicion) => Promise<boolean>;
  onElegirBusqueda: (s: Sugerencia) => void;
}) {
  const { enModal } = useSafeMap();

  return (
    <div className="relative h-full [&>*:first-child]:!h-full">
      <MapaSelector
        puntos={puntosMapa}
        posicion={null}
        vistaBuscada={vistaBuscada}
        creandoEn={enModal ? creandoPos : null}
        onElegir={onElegir}
        onClicPunto={onClicPunto}
        onMoverPunto={onMoverPunto}
        centrarEn={centrarEn}
        soloLectura={!enModal}
        zoomConRueda={enModal}
      />

      {enModal && (
        <>
          <div className="pointer-events-none absolute left-14 right-esp3 top-esp3 z-[1000] flex items-start justify-start">
            <div className="pointer-events-auto min-w-0 w-full max-w-md">
              <BuscadorDireccion
                onElegir={onElegirBusqueda}
                placeholder="Buscar dirección o lugar…"
                inputClassName="shadow-elevado"
              />
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-esp3 bottom-esp3 z-[1000] flex justify-center">
            <p className="rounded-lg border border-borde-default bg-fondo-superficie px-esp3 py-esp1 text-center text-meta font-medium text-texto-secundario shadow-elevado">
              {creandoPos || pendiente
                ? "Guardando punto en la campaña…"
                : "Toca el mapa para añadir un punto, o pulsa y arrastra uno para moverlo."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
