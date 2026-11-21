"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BuscadorDireccion, type Sugerencia } from "@/components/mapa/buscador-direccion";
import {
  MapaSelector,
  type BBoxVista,
  type Posicion,
  type PuntoExistente,
  type ZonaPrevia,
} from "@/components/mapa/mapa-selector";
import { SafeMapContainer, useSafeMap } from "@/components/shared/SafeMapContainer";
import { confirmar } from "@/components/ui/dialogos";
import { direccionDe, nombreVisiblePunto } from "@/lib/mapa/geocodificacion";
import {
  RADIO_DEFECTO_METROS,
  obtenerDistritosEnVista,
  obtenerPoligonoOSM,
  type DistritoOSM,
  type FotoMapa,
  type GeometriaZona,
  type TipoUbicacion,
} from "@/lib/mapa/zonas";
import { useAccion } from "@/lib/use-accion";

export type DatosCreacionMapa = {
  pos: Posicion;
  direccionInicial: string;
  tipoUbicacion: TipoUbicacion;
  radioMetros: number | null;
  geometria: GeometriaZona | null;
};

type ModoSeleccion = "punto" | "zona";

/**
 * Mapa interactivo unificado (wizard de documentos y ficha de campaña):
 * - Vista previa compacta con CTA primario "Añadir o modificar puntos" en ambos breakpoints.
 * - Modal a tamaño máximo de viewport con buscador, modo Punto / Zona (polígonos OSM + radio),
 *   capa opcional de distritos clicables, edición por clic, drag optimista y puntitos de fotos realizadas.
 */
export function MapaInteractivoCampana<T extends PuntoExistente>({
  tituloModal,
  puntos,
  fotos = [],
  onCrearPunto,
  onMoverPunto,
  onAbrirPunto,
  onActualizarDireccionTardia,
}: {
  tituloModal: string;
  puntos: T[];
  fotos?: FotoMapa[];
  onCrearPunto: (datos: DatosCreacionMapa) => Promise<T>;
  onMoverPunto: (punto: T, nuevaPos: Posicion, direccion?: string) => Promise<void>;
  onAbrirPunto: (punto: T) => void;
  onActualizarDireccionTardia?: (punto: T, direccion: string) => void;
}) {
  const { pendiente, error, setError, ejecutar } = useAccion({ refrescar: true });
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modo, setModo] = useState<ModoSeleccion>("punto");
  const [vistaBuscada, setVistaBuscada] = useState<Posicion | null>(null);
  const [zonaPrevia, setZonaPrevia] = useState<ZonaPrevia | null>(null);
  const [buscandoPoligono, setBuscandoPoligono] = useState(false);
  const [mostrarDistritos, setMostrarDistritos] = useState(false);
  const [distritos, setDistritos] = useState<DistritoOSM[]>([]);
  const [cargandoDistritos, setCargandoDistritos] = useState(false);
  const [avisoZona, setAvisoZona] = useState<string | null>(null);
  const [centrarEn, setCentrarEn] = useState(0);
  const [creandoPos, setCreandoPos] = useState<Posicion | null>(null);
  const [movimientosPendientes, setMovimientosPendientes] = useState<Record<number, Posicion>>({});
  const creandoRef = useRef(false);
  const bboxActualRef = useRef<BBoxVista | null>(null);

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

  // Limpia previsualizaciones al cerrar el modal o volver a modo punto.
  useEffect(() => {
    if (!modalAbierto) {
      setZonaPrevia(null);
      setAvisoZona(null);
    }
  }, [modalAbierto]);

  const cargarDistritosParaBbox = useCallback(async (bbox: BBoxVista) => {
    setCargandoDistritos(true);
    setAvisoZona(null);
    try {
      const lista = await obtenerDistritosEnVista(bbox);
      setDistritos(lista);
      if (lista.length === 0) {
        setAvisoZona("No se encontraron distritos delimitados aquí. Busca un barrio arriba o toca el mapa.");
      }
    } catch (e) {
      setAvisoZona((e as Error).message || "No se pudieron cargar los distritos ahora.");
    } finally {
      setCargandoDistritos(false);
    }
  }, []);

  const alCambiarVista = useCallback(
    (bbox: BBoxVista) => {
      bboxActualRef.current = bbox;
      if (mostrarDistritos && modo === "zona") {
        void cargarDistritosParaBbox(bbox);
      }
    },
    [mostrarDistritos, modo, cargarDistritosParaBbox],
  );

  function cambiarModo(nuevo: ModoSeleccion) {
    setModo(nuevo);
    setZonaPrevia(null);
    setAvisoZona(null);
    if (nuevo === "punto") {
      setMostrarDistritos(false);
    }
  }

  function alternarDistritos() {
    const siguiente = !mostrarDistritos;
    setMostrarDistritos(siguiente);
    setAvisoZona(null);
    if (siguiente && bboxActualRef.current) {
      void cargarDistritosParaBbox(bboxActualRef.current);
    } else if (!siguiente) {
      setDistritos([]);
    }
  }

  async function elegirBusqueda(sugerencia: Sugerencia) {
    setError(null);
    setAvisoZona(null);

    if (modo === "zona" && sugerencia.esZona && sugerencia.osmId && sugerencia.osmType) {
      setBuscandoPoligono(true);
      setVistaBuscada({ latitud: sugerencia.latitud, longitud: sugerencia.longitud });
      setCentrarEn((n) => n + 1);
      try {
        const res = await obtenerPoligonoOSM(sugerencia.osmType, sugerencia.osmId);
        if (res) {
          setZonaPrevia({
            id: `${sugerencia.osmType}${sugerencia.osmId}`,
            nombre: sugerencia.titulo,
            direccion: sugerencia.direccion || sugerencia.titulo,
            centro: res.centro,
            geometria: res.geometria,
          });
          setCentrarEn((n) => n + 1);
        } else {
          setZonaPrevia(null);
          setAvisoZona(
            `OpenStreetMap no tiene límites exactos de «${sugerencia.titulo}». Toca el mapa para crear una zona con radio.`,
          );
        }
      } finally {
        setBuscandoPoligono(false);
      }
      return;
    }

    setZonaPrevia(null);
    setVistaBuscada({ latitud: sugerencia.latitud, longitud: sugerencia.longitud });
    setCentrarEn((n) => n + 1);
  }

  function seleccionarDistrito(d: DistritoOSM) {
    setError(null);
    setAvisoZona(null);
    const direccion = d.detalle ? `${d.nombre}, ${d.detalle}` : d.nombre;
    setZonaPrevia({
      id: d.id,
      nombre: d.nombre,
      direccion,
      centro: d.centro,
      geometria: d.geometria,
    });
  }

  function confirmarZonaPrevia() {
    if (!zonaPrevia || !modalAbierto || pendiente || creandoRef.current) return;
    const elegida = zonaPrevia;
    creandoRef.current = true;
    setError(null);
    setZonaPrevia(null);
    setCreandoPos(elegida.centro);

    ejecutar(async () => {
      try {
        const creado = await onCrearPunto({
          pos: elegida.centro,
          direccionInicial: elegida.direccion,
          tipoUbicacion: "poligono",
          radioMetros: null,
          geometria: elegida.geometria,
        });
        setCreandoPos(null);
        onAbrirPunto(creado);
      } finally {
        setCreandoPos(null);
        creandoRef.current = false;
      }
    });
  }

  function elegirEnMapa(p: Posicion) {
    if (!modalAbierto || pendiente || creandoRef.current) return;
    // Si hay una zona previsualizada abierta, tocar fuera la descarta sin crear otra encima.
    if (zonaPrevia) {
      setZonaPrevia(null);
      return;
    }
    creandoRef.current = true;
    setError(null);
    setAvisoZona(null);
    setCreandoPos(p);
    const esZonaRadio = modo === "zona";
    const promesaDireccion = direccionDe(p);
    const pausaAnimacion = new Promise<void>((r) => setTimeout(r, 450));

    ejecutar(async () => {
      try {
        const dirInicial = await Promise.race([
          promesaDireccion,
          new Promise<string>((r) => setTimeout(() => r(""), 420)),
        ]);
        const [creado] = await Promise.all([
          onCrearPunto({
            pos: p,
            direccionInicial: dirInicial,
            tipoUbicacion: esZonaRadio ? "radio" : "punto",
            radioMetros: esZonaRadio ? RADIO_DEFECTO_METROS : null,
            geometria: null,
          }),
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
      tipo_ubicacion: p.tipo_ubicacion,
      radio_metros: p.radio_metros,
      geometria: p.geometria,
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
          fotos={fotos}
          modo={modo}
          mostrarDistritos={mostrarDistritos}
          distritos={mostrarDistritos && modo === "zona" ? distritos : []}
          cargandoDistritos={cargandoDistritos}
          buscandoPoligono={buscandoPoligono}
          avisoZona={avisoZona}
          vistaBuscada={vistaBuscada}
          zonaPrevia={zonaPrevia}
          creandoPos={creandoPos}
          centrarEn={centrarEn}
          pendiente={pendiente}
          onCambiarModo={cambiarModo}
          onAlternarDistritos={alternarDistritos}
          onConfirmarZona={confirmarZonaPrevia}
          onCancelarZona={() => setZonaPrevia(null)}
          onElegir={elegirEnMapa}
          onClicPunto={clicEnPuntoExistente}
          onMoverPunto={moverPuntoEnMapa}
          onClicDistrito={seleccionarDistrito}
          onCambioVista={alCambiarVista}
          onElegirBusqueda={elegirBusqueda}
        />
      </SafeMapContainer>

      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}

function ContenidoMapaCampana({
  puntosMapa,
  fotos,
  modo,
  mostrarDistritos,
  distritos,
  cargandoDistritos,
  buscandoPoligono,
  avisoZona,
  vistaBuscada,
  zonaPrevia,
  creandoPos,
  centrarEn,
  pendiente,
  onCambiarModo,
  onAlternarDistritos,
  onConfirmarZona,
  onCancelarZona,
  onElegir,
  onClicPunto,
  onMoverPunto,
  onClicDistrito,
  onCambioVista,
  onElegirBusqueda,
}: {
  puntosMapa: PuntoExistente[];
  fotos: FotoMapa[];
  modo: ModoSeleccion;
  mostrarDistritos: boolean;
  distritos: DistritoOSM[];
  cargandoDistritos: boolean;
  buscandoPoligono: boolean;
  avisoZona: string | null;
  vistaBuscada: Posicion | null;
  zonaPrevia: ZonaPrevia | null;
  creandoPos: Posicion | null;
  centrarEn: number;
  pendiente: boolean;
  onCambiarModo: (m: ModoSeleccion) => void;
  onAlternarDistritos: () => void;
  onConfirmarZona: () => void;
  onCancelarZona: () => void;
  onElegir: (p: Posicion) => void;
  onClicPunto: (p: PuntoExistente) => void;
  onMoverPunto: (p: PuntoExistente, pos: Posicion) => Promise<boolean>;
  onClicDistrito: (d: DistritoOSM) => void;
  onCambioVista: (b: BBoxVista) => void;
  onElegirBusqueda: (s: Sugerencia) => void;
}) {
  const { enModal } = useSafeMap();

  const textoAyuda = creandoPos || pendiente
    ? modo === "zona"
      ? "Guardando zona en la campaña…"
      : "Guardando punto en la campaña…"
    : buscandoPoligono
      ? "Cargando límites de la zona…"
      : avisoZona
        ? avisoZona
        : modo === "zona"
          ? mostrarDistritos
            ? "Toca un distrito para seleccionarlo, o toca otra área para crear una zona con radio."
            : "Busca un barrio o distrito arriba, o toca el mapa para crear una zona con radio."
          : "Toca el mapa para añadir un punto, o pulsa y arrastra uno para moverlo.";

  return (
    <div className="relative h-full [&>*:first-child]:!h-full">
      <MapaSelector
        puntos={puntosMapa}
        fotos={fotos}
        posicion={null}
        vistaBuscada={vistaBuscada}
        zonaPrevia={enModal ? zonaPrevia : null}
        distritos={enModal ? distritos : []}
        creandoEn={enModal ? creandoPos : null}
        onElegir={onElegir}
        onClicPunto={onClicPunto}
        onMoverPunto={onMoverPunto}
        onClicDistrito={onClicDistrito}
        onCambioVista={enModal ? onCambioVista : undefined}
        centrarEn={centrarEn}
        soloLectura={!enModal}
        zoomConRueda={enModal}
      />

      {enModal && (
        <>
          <div className="pointer-events-none absolute left-14 right-esp3 top-esp3 z-[1000] flex flex-wrap items-center gap-esp2">
            <div className="pointer-events-auto min-w-[200px] flex-1 max-w-sm">
              <BuscadorDireccion
                onElegir={onElegirBusqueda}
                placeholder={
                  modo === "zona"
                    ? "Buscar barrio, distrito o ciudad…"
                    : "Buscar dirección o lugar…"
                }
                inputClassName="shadow-elevado"
              />
            </div>

            <div
              role="group"
              aria-label="Modo de selección"
              className="pointer-events-auto inline-flex h-10 items-center rounded-lg border border-borde-default bg-fondo-superficie p-0.5 shadow-elevado"
            >
              {(
                [
                  { id: "punto", etiqueta: "Punto" },
                  { id: "zona", etiqueta: "Zona" },
                ] as const
              ).map((op) => {
                const activo = modo === op.id;
                return (
                  <button
                    key={op.id}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => onCambiarModo(op.id)}
                    className={`inline-flex h-full items-center rounded-md px-esp3 text-xs font-semibold transition-colors ${
                      activo
                        ? "bg-fondo-marca text-texto-sobre-marca"
                        : "text-texto-secundario hover:text-texto-primario"
                    }`}
                  >
                    {op.etiqueta}
                  </button>
                );
              })}
            </div>

            {modo === "zona" && (
              <button
                type="button"
                aria-pressed={mostrarDistritos}
                onClick={onAlternarDistritos}
                className={`pointer-events-auto inline-flex h-10 items-center rounded-lg border px-esp3 text-xs font-semibold shadow-elevado transition-colors ${
                  mostrarDistritos
                    ? "border-borde-marca bg-fondo-marca-sutil text-texto-marca"
                    : "border-borde-default bg-fondo-superficie text-texto-secundario hover:bg-fondo-sutil hover:text-texto-primario"
                }`}
              >
                {cargandoDistritos ? "Cargando distritos…" : "Distritos"}
              </button>
            )}
          </div>

          <div className="pointer-events-none absolute inset-x-esp3 bottom-esp3 z-[1000] flex justify-center">
            {zonaPrevia ? (
              <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-esp2 rounded-lg border border-borde-marca bg-fondo-superficie px-esp3 py-esp2 shadow-elevado">
                <span className="max-w-xs truncate text-meta font-semibold text-texto-primario">
                  {zonaPrevia.nombre}
                </span>
                <div className="flex items-center gap-esp1">
                  <button
                    type="button"
                    onClick={onConfirmarZona}
                    disabled={pendiente}
                    className="inline-flex min-h-9 items-center rounded-md bg-fondo-marca px-esp3 text-xs font-semibold text-texto-sobre-marca transition-colors hover:bg-fondo-marca-hover disabled:opacity-50"
                  >
                    Añadir zona
                  </button>
                  <button
                    type="button"
                    onClick={onCancelarZona}
                    className="inline-flex min-h-9 items-center rounded-md px-esp2 text-xs font-medium text-texto-secundario transition-colors hover:bg-fondo-hover hover:text-texto-primario"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <p className="rounded-lg border border-borde-default bg-fondo-superficie px-esp3 py-esp1 text-center text-meta font-medium text-texto-secundario shadow-elevado">
                {textoAyuda}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
