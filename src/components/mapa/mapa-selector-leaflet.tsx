"use client";

import { useEffect, useRef, useState } from "react";
import { Circle, GeoJSON, MapContainer, Marker, Popup, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CapaBase } from "./capa-base";
import { ModalFotoMapa } from "./modal-foto-mapa";
import { borde, colorMapa, fondo } from "@/design/tokens";
import {
  boundsDeCirculo,
  boundsDeGeometria,
  esGeometriaZona,
  type DistritoOSM,
  type FotoMapa,
  type GeometriaZona,
  type TipoUbicacion,
} from "@/lib/mapa/zonas";

// Mapa para elegir la ubicación de un punto o zona: clic en el mapa = nueva posición.
// Muestra también los puntos/zonas ya creados de la campaña y los puntitos de fotos realizadas.

export type PuntoExistente = {
  id: number;
  nombre: string;
  latitud: number;
  longitud: number;
  detalle?: string;
  estado?: string;
  tipo_ubicacion?: TipoUbicacion;
  radio_metros?: number | null;
  geometria?: GeometriaZona | null;
};

export type Posicion = { latitud: number; longitud: number };

export type ZonaPrevia = {
  id?: string;
  nombre: string;
  direccion: string;
  centro: Posicion;
  geometria: GeometriaZona;
};

export type BBoxVista = { sur: number; oeste: number; norte: number; este: number };

function icono(color: string, tamano = 16, areaTactil = tamano) {
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${areaTactil}px;height:${areaTactil}px;cursor:pointer"><span style="display:block;width:${tamano}px;height:${tamano}px;border-radius:50%;background:${color};border:2px solid ${colorMapa.contorno};box-shadow:0 1px 4px ${colorMapa.sombra}"></span></span>`,
    iconSize: [areaTactil, areaTactil],
    iconAnchor: [areaTactil / 2, areaTactil / 2],
    popupAnchor: [0, -tamano / 2],
  });
}

const ICONO_EXISTENTE = icono(colorMapa.estado.retirado, 16, 44);
const ICONO_CENTRO_ZONA = icono(colorMapa.defecto, 12, 36);
const ICONO_NUEVO = icono(colorMapa.defecto, 22, 44);
const ICONO_FOTO = L.divIcon({
  className: "",
  html: `<span data-foto-marker="1" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;cursor:pointer"><span style="display:block;width:9px;height:9px;border-radius:50%;background:${fondo.inverso};opacity:0.78;border:1.5px solid ${colorMapa.contorno};box-shadow:0 1px 2px ${colorMapa.sombra}"></span></span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});
const ICONO_CREANDO_ONDA = L.divIcon({
  className: "",
  html: `<span style="position:relative;display:flex;align-items:center;justify-content:center;width:64px;height:64px;pointer-events:none"><span style="position:absolute;inset:12px;border-radius:50%;border:2px solid ${colorMapa.defecto};animation:punto-onda 650ms cubic-bezier(0.16, 1, 0.3, 1) infinite"></span><span style="position:absolute;inset:12px;border-radius:50%;border:2px solid ${colorMapa.defecto};animation:punto-onda 650ms cubic-bezier(0.16, 1, 0.3, 1) 200ms infinite"></span><span style="position:relative;display:block;width:16px;height:16px;border-radius:50%;background:${colorMapa.defecto};border:2px solid ${colorMapa.contorno};box-shadow:0 1px 4px ${colorMapa.sombra};animation:punto-nucleo 260ms cubic-bezier(0.16, 1, 0.3, 1) both"></span></span>`,
  iconSize: [64, 64],
  iconAnchor: [32, 32],
});

// Centro por defecto: Málaga (zona habitual de trabajo de Creativa).
const CENTRO_DEFECTO: [number, number] = [36.7213, -4.4214];

function colorEstado(estado?: string): string {
  if (estado && estado in colorMapa.estado) {
    return colorMapa.estado[estado as keyof typeof colorMapa.estado];
  }
  return colorMapa.defecto;
}

function Clics({
  onElegir,
  ultimoGestoRef,
  ultimoClicCapaRef,
}: {
  onElegir: (p: Posicion) => void;
  ultimoGestoRef: React.MutableRefObject<number>;
  ultimoClicCapaRef: React.MutableRefObject<number>;
}) {
  const mapa = useMap();

  useEffect(() => {
    const contenedor = mapa.getContainer();
    const marcarMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) ultimoGestoRef.current = Date.now();
    };
    const marcarGesto = () => {
      ultimoGestoRef.current = Date.now();
    };
    contenedor.addEventListener("touchstart", marcarMultiTouch, { passive: true });
    contenedor.addEventListener("touchmove", marcarMultiTouch, { passive: true });
    mapa.on("movestart moveend zoomstart zoomend", marcarGesto);
    return () => {
      contenedor.removeEventListener("touchstart", marcarMultiTouch);
      contenedor.removeEventListener("touchmove", marcarMultiTouch);
      mapa.off("movestart moveend zoomstart zoomend", marcarGesto);
    };
  }, [mapa, ultimoGestoRef]);

  useMapEvents({
    click(e) {
      const ahora = Date.now();
      if (ahora - ultimoGestoRef.current < 320) return;
      if (ahora - ultimoClicCapaRef.current < 120) return;
      const destino = e.originalEvent.target as HTMLElement | null;
      if (destino?.closest(".leaflet-marker-icon")) return;
      onElegir({ latitud: e.latlng.lat, longitud: e.latlng.lng });
    },
  });
  return null;
}

/** Notifica los límites visibles actuales del mapa para cargar distritos bajo demanda. */
function ObservadorVista({ onCambioVista }: { onCambioVista?: (b: BBoxVista) => void }) {
  const mapa = useMap();
  const ref = useRef(onCambioVista);
  ref.current = onCambioVista;

  useEffect(() => {
    const emitir = () => {
      if (!ref.current) return;
      const b = mapa.getBounds();
      ref.current({
        sur: b.getSouth(),
        oeste: b.getWest(),
        norte: b.getNorth(),
        este: b.getEast(),
      });
    };
    emitir();
    mapa.on("moveend zoomend", emitir);
    return () => {
      mapa.off("moveend zoomend", emitir);
    };
  }, [mapa]);
  return null;
}

/**
 * Marcador o zona ya añadida. Soporta clic/toque corto (editar detalles) y arrastre (mover ubicación
 * para puntos y zonas con radio), sin interferir con el arrastre ni zoom del mapa.
 */
function ElementoExistente({
  punto,
  onClic,
  onMover,
  ultimoGestoRef,
  ultimoClicCapaRef,
}: {
  punto: PuntoExistente;
  onClic?: (p: PuntoExistente) => void;
  onMover?: (p: PuntoExistente, pos: Posicion) => boolean | void | Promise<boolean | void>;
  ultimoGestoRef: React.MutableRefObject<number>;
  ultimoClicCapaRef: React.MutableRefObject<number>;
}) {
  const onClicRef = useRef(onClic);
  onClicRef.current = onClic;
  const onMoverRef = useRef(onMover);
  onMoverRef.current = onMover;
  const puntoRef = useRef(punto);
  puntoRef.current = punto;
  const arrastrable = Boolean(onMover) && (!punto.estado || punto.estado === "pendiente");
  const color = colorEstado(punto.estado);

  const manejarClic = () => {
    ultimoClicCapaRef.current = Date.now();
    if (Date.now() - ultimoGestoRef.current < 320) return;
    onClicRef.current?.(puntoRef.current);
  };

  if (punto.tipo_ubicacion === "poligono" && esGeometriaZona(punto.geometria)) {
    return (
      <GeoJSON
        key={`zona-poly-${punto.id}-${punto.estado ?? ""}`}
        data={punto.geometria}
        style={{
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.16,
        }}
        eventHandlers={{
          click(e) {
            L.DomEvent.stopPropagation(e);
            manejarClic();
          },
        }}
      >
        <Tooltip direction="center" sticky>
          {punto.nombre}
        </Tooltip>
      </GeoJSON>
    );
  }

  if (punto.tipo_ubicacion === "radio" && punto.radio_metros) {
    return (
      <>
        <Circle
          key={`zona-radio-${punto.id}-${punto.radio_metros}-${punto.estado ?? ""}`}
          center={[punto.latitud, punto.longitud]}
          radius={punto.radio_metros}
          pathOptions={{
            color,
            weight: 2,
            dashArray: "6 4",
            fillColor: color,
            fillOpacity: 0.14,
          }}
          eventHandlers={{
            click(e) {
              L.DomEvent.stopPropagation(e);
              manejarClic();
            },
          }}
        >
          <Tooltip direction="center" sticky>
            {punto.nombre}
          </Tooltip>
        </Circle>
        <Marker
          position={[punto.latitud, punto.longitud]}
          icon={ICONO_CENTRO_ZONA}
          draggable={arrastrable}
          zIndexOffset={100}
          eventHandlers={{
            click: manejarClic,
            dragstart() {
              ultimoGestoRef.current = Date.now();
            },
            async dragend(e) {
              ultimoGestoRef.current = Date.now();
              const marcador = e.target as L.Marker;
              const ll = marcador.getLatLng();
              const origen: [number, number] = [puntoRef.current.latitud, puntoRef.current.longitud];
              const confirmado = await onMoverRef.current?.(puntoRef.current, {
                latitud: ll.lat,
                longitud: ll.lng,
              });
              if (confirmado === false) {
                marcador.setLatLng(origen);
              }
            },
          }}
        />
      </>
    );
  }

  return (
    <Marker
      position={[punto.latitud, punto.longitud]}
      icon={ICONO_EXISTENTE}
      draggable={arrastrable}
      zIndexOffset={100}
      eventHandlers={{
        click: manejarClic,
        dragstart() {
          ultimoGestoRef.current = Date.now();
        },
        async dragend(e) {
          ultimoGestoRef.current = Date.now();
          const marcador = e.target as L.Marker;
          const ll = marcador.getLatLng();
          const origen: [number, number] = [puntoRef.current.latitud, puntoRef.current.longitud];
          const confirmado = await onMoverRef.current?.(puntoRef.current, { latitud: ll.lat, longitud: ll.lng });
          if (confirmado === false) {
            marcador.setLatLng(origen);
          }
        },
      }}
    >
      {!onClic && (
        <Popup>
          <strong>{punto.nombre}</strong>
          {punto.detalle ? (
            <>
              <br />
              {punto.detalle}
            </>
          ) : null}
        </Popup>
      )}
    </Marker>
  );
}

/**
 * Encuadra el mapa con el máximo zoom posible manteniendo visibles todos los puntos/zonas/fotos.
 * En modo vista previa (`soloLectura`) reencuadra siempre que cambien los puntos o el tamaño.
 * En modo edición (modal) encuadra al abrir y respeta la vista del usuario una vez que la mueve.
 */
function Encuadrar({
  puntos,
  posicion,
  fotos,
  soloLectura,
}: {
  puntos: PuntoExistente[];
  posicion: Posicion | null;
  fotos: FotoMapa[];
  soloLectura: boolean;
}) {
  const mapa = useMap();
  const puntosRef = useRef(puntos);
  puntosRef.current = puntos;
  const posicionRef = useRef(posicion);
  posicionRef.current = posicion;
  const fotosRef = useRef(fotos);
  fotosRef.current = fotos;
  const soloLecturaRef = useRef(soloLectura);
  soloLecturaRef.current = soloLectura;
  const ultimoTamanoRef = useRef({ w: 0, h: 0 });
  const movidoManualRef = useRef(false);
  const encuadrandoRef = useRef(false);

  const claveDatos = [
    ...puntos.map((p) => `${p.id}:${p.latitud},${p.longitud},${p.tipo_ubicacion ?? "punto"},${p.radio_metros ?? ""}`),
    ...fotos.map((f) => `${f.latitud},${f.longitud}`),
    posicion ? `${posicion.latitud},${posicion.longitud}` : "",
  ].join("|");

  useEffect(() => {
    const marcar = () => {
      if (encuadrandoRef.current || soloLecturaRef.current) return;
      movidoManualRef.current = true;
    };
    mapa.on("dragstart zoomstart", marcar);
    return () => {
      mapa.off("dragstart zoomstart", marcar);
    };
  }, [mapa]);

  useEffect(() => {
    const encuadrar = (forzar = false) => {
      if (!soloLecturaRef.current && movidoManualRef.current) return;
      const contenedor = mapa.getContainer();
      const w = contenedor.clientWidth;
      const h = contenedor.clientHeight;
      if (w === 0 || h === 0) return;

      const prev = ultimoTamanoRef.current;
      const cambioTamano = Math.abs(w - prev.w) > 20 || Math.abs(h - prev.h) > 20;
      if (!forzar && !cambioTamano) return;

      encuadrandoRef.current = true;
      try {
        mapa.invalidateSize({ animate: false });
        const coords: [number, number][] = [];
        for (const p of puntosRef.current) {
          if (p.tipo_ubicacion === "poligono" && esGeometriaZona(p.geometria)) {
            const b = boundsDeGeometria(p.geometria);
            if (b) coords.push(b[0], b[1]);
            else coords.push([p.latitud, p.longitud]);
          } else if (p.tipo_ubicacion === "radio" && p.radio_metros) {
            const b = boundsDeCirculo(p.latitud, p.longitud, p.radio_metros);
            coords.push(b[0], b[1]);
          } else {
            coords.push([p.latitud, p.longitud]);
          }
        }
        for (const f of fotosRef.current) {
          coords.push([f.latitud, f.longitud]);
        }
        if (posicionRef.current) {
          coords.push([posicionRef.current.latitud, posicionRef.current.longitud]);
        }

        if (coords.length >= 2) {
          mapa.fitBounds(L.latLngBounds(coords), {
            padding: [28, 28],
            maxZoom: 18,
            animate: false,
          });
        } else if (coords.length === 1) {
          mapa.setView(coords[0]!, 17, { animate: false });
        }
        ultimoTamanoRef.current = { w, h };
      } finally {
        encuadrandoRef.current = false;
      }
    };

    encuadrar(true);
    const t = setTimeout(() => encuadrar(true), 120);
    const contenedor = mapa.getContainer();
    if (typeof ResizeObserver === "undefined") {
      return () => clearTimeout(t);
    }
    const observer = new ResizeObserver(() => encuadrar(false));
    observer.observe(contenedor);
    return () => {
      clearTimeout(t);
      observer.disconnect();
    };
  }, [mapa, claveDatos, soloLectura]);

  return null;
}

/** Recentra el mapa solo cuando la posición o zona previa cambia desde el buscador. */
function Seguir({
  posicion,
  zonaPrevia,
  centrarEn,
}: {
  posicion: Posicion | null;
  zonaPrevia?: ZonaPrevia | null;
  centrarEn?: number;
}) {
  const mapa = useMap();
  useEffect(() => {
    if (!centrarEn) return;
    if (zonaPrevia && esGeometriaZona(zonaPrevia.geometria)) {
      const b = boundsDeGeometria(zonaPrevia.geometria);
      if (b) {
        mapa.fitBounds(L.latLngBounds(b), { padding: [56, 56], maxZoom: 15 });
        return;
      }
    }
    if (posicion) {
      mapa.setView([posicion.latitud, posicion.longitud], Math.max(mapa.getZoom(), 16));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centrarEn]);
  return null;
}

/** Recalcula el tamaño del mapa cuando cambia su contenedor (tarjeta mobile o modal fullscreen). */
function AutoResize() {
  const mapa = useMap();
  useEffect(() => {
    const t = setTimeout(() => mapa.invalidateSize(), 100);
    const contenedor = mapa.getContainer();
    if (typeof ResizeObserver === "undefined") {
      return () => clearTimeout(t);
    }
    const observer = new ResizeObserver(() => {
      mapa.invalidateSize();
    });
    observer.observe(contenedor);
    return () => {
      clearTimeout(t);
      observer.disconnect();
    };
  }, [mapa]);
  return null;
}

function ControlZoomRueda({ activo }: { activo: boolean }) {
  const mapa = useMap();
  useEffect(() => {
    if (activo) {
      mapa.scrollWheelZoom.enable();
    } else {
      mapa.scrollWheelZoom.disable();
    }
  }, [mapa, activo]);
  return null;
}

export function MapaSelectorLeaflet({
  puntos,
  fotos = [],
  posicion,
  vistaBuscada,
  zonaPrevia,
  distritos = [],
  creandoEn,
  onElegir,
  onClicPunto,
  onMoverPunto,
  onClicDistrito,
  onCambioVista,
  centrarEn,
  soloLectura = false,
  zoomConRueda = false,
  altura = "clamp(380px, 62vh, 640px)",
}: {
  puntos: PuntoExistente[];
  /** Fotos realizadas con coordenadas (GPS/EXIF): puntitos discretos clicables. */
  fotos?: FotoMapa[];
  posicion: Posicion | null;
  /** Posición a enfocar desde el buscador sin colocar marcador. */
  vistaBuscada?: Posicion | null;
  /** Polígono previsualizado antes de confirmar "Añadir zona". */
  zonaPrevia?: ZonaPrevia | null;
  /** Capa opcional de distritos/barrios de OSM clicables en la vista actual. */
  distritos?: DistritoOSM[];
  /** Coordenadas donde mostrar la microanimación de punto con cerchi concentrici antes de abrir el modal. */
  creandoEn?: Posicion | null;
  onElegir: (p: Posicion) => void;
  /** Clic corto sobre un punto o zona ya añadido. */
  onClicPunto?: (punto: PuntoExistente) => void;
  /** Al terminar de arrastrar un punto/zona ya añadido a otra ubicación (devolver false cancela). */
  onMoverPunto?: (punto: PuntoExistente, pos: Posicion) => boolean | void | Promise<boolean | void>;
  /** Clic sobre un distrito de la capa OSM. */
  onClicDistrito?: (distrito: DistritoOSM) => void;
  /** Se llama cuando cambia el área visible del mapa. */
  onCambioVista?: (bbox: BBoxVista) => void;
  /** Incrementar solo al elegir una dirección/zona en el buscador para centrar el mapa en ella. */
  centrarEn?: number;
  /** En modo solo lectura muestra los puntos/zonas sin permitir colocar nuevos al hacer clic. */
  soloLectura?: boolean;
  /** Habilita zoom con rueda del ratón / pellizco en trackpad (ej. dentro del modal a pantalla completa). */
  zoomConRueda?: boolean;
  altura?: number | string;
}) {
  const ultimoGestoRef = useRef(0);
  const ultimoClicCapaRef = useRef(0);
  const [fotoActiva, setFotoActiva] = useState<FotoMapa | null>(null);

  const centro: [number, number] =
    puntos.length > 0
      ? [
          puntos.reduce((s, p) => s + p.latitud, 0) / puntos.length,
          puntos.reduce((s, p) => s + p.longitud, 0) / puntos.length,
        ]
      : CENTRO_DEFECTO;

  return (
    <>
      <div style={{ height: altura }} className="overflow-hidden rounded-lg border border-borde-default">
        <MapContainer
          center={centro}
          zoom={puntos.length > 0 ? 13 : 12}
          zoomSnap={0.25}
          dragging
          touchZoom
          scrollWheelZoom={zoomConRueda}
          style={{ height: "100%", width: "100%", cursor: soloLectura ? "grab" : "crosshair" }}
        >
          <AutoResize />
          <ControlZoomRueda activo={zoomConRueda} />
          <Encuadrar puntos={puntos} posicion={posicion} fotos={fotos} soloLectura={soloLectura} />
          <CapaBase />
          {onCambioVista && <ObservadorVista onCambioVista={onCambioVista} />}
          {!soloLectura && (
            <Clics
              onElegir={onElegir}
              ultimoGestoRef={ultimoGestoRef}
              ultimoClicCapaRef={ultimoClicCapaRef}
            />
          )}
          <Seguir
            posicion={vistaBuscada ?? posicion}
            zonaPrevia={zonaPrevia}
            centrarEn={centrarEn}
          />

          {/* Capa opcional de distritos OSM clicables */}
          {!soloLectura &&
            distritos.map((d) => {
              const seleccionado = zonaPrevia?.id === d.id;
              return (
                <GeoJSON
                  key={`distrito-${d.id}-${seleccionado ? "sel" : "std"}`}
                  data={d.geometria}
                  style={{
                    color: seleccionado ? colorMapa.defecto : borde.campo,
                    weight: seleccionado ? 2.5 : 1.5,
                    dashArray: seleccionado ? undefined : "4 4",
                    fillColor: seleccionado ? colorMapa.defecto : fondo.marca,
                    fillOpacity: seleccionado ? 0.18 : 0.05,
                  }}
                  eventHandlers={{
                    click(e) {
                      L.DomEvent.stopPropagation(e);
                      ultimoClicCapaRef.current = Date.now();
                      if (Date.now() - ultimoGestoRef.current < 320) return;
                      onClicDistrito?.(d);
                    },
                  }}
                >
                  <Tooltip direction="center" sticky>
                    {d.nombre}
                  </Tooltip>
                </GeoJSON>
              );
            })}

          {/* Polígono previsualizado desde el buscador (si no está ya en la capa de distritos) */}
          {!soloLectura &&
            zonaPrevia &&
            !distritos.some((d) => d.id === zonaPrevia.id) && (
              <GeoJSON
                key={`previa-${zonaPrevia.id ?? zonaPrevia.nombre}`}
                data={zonaPrevia.geometria}
                interactive={false}
                style={{
                  color: colorMapa.defecto,
                  weight: 2.5,
                  fillColor: colorMapa.defecto,
                  fillOpacity: 0.18,
                }}
              />
            )}

          {puntos.map((p) => (
            <ElementoExistente
              key={p.id}
              punto={p}
              onClic={onClicPunto}
              onMover={onMoverPunto}
              ultimoGestoRef={ultimoGestoRef}
              ultimoClicCapaRef={ultimoClicCapaRef}
            />
          ))}

          {/* Puntitos discretos de fotos realizadas con GPS/EXIF */}
          {fotos.map((f, idx) => (
            <Marker
              key={`foto-${f.id ?? f.url}-${idx}`}
              position={[f.latitud, f.longitud]}
              icon={ICONO_FOTO}
              zIndexOffset={-50}
              eventHandlers={{
                click(e) {
                  L.DomEvent.stopPropagation(e);
                  ultimoClicCapaRef.current = Date.now();
                  if (Date.now() - ultimoGestoRef.current < 320) return;
                  setFotoActiva(f);
                },
              }}
            />
          ))}

          {creandoEn && (
            <Marker
              key={`creando-${creandoEn.latitud}-${creandoEn.longitud}`}
              position={[creandoEn.latitud, creandoEn.longitud]}
              icon={ICONO_CREANDO_ONDA}
              interactive={false}
            />
          )}
          {posicion && (
            <Marker
              position={[posicion.latitud, posicion.longitud]}
              icon={ICONO_NUEVO}
              draggable
              eventHandlers={{
                dragend(e) {
                  const ll = (e.target as L.Marker).getLatLng();
                  onElegir({ latitud: ll.lat, longitud: ll.lng });
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <ModalFotoMapa foto={fotoActiva} onCerrar={() => setFotoActiva(null)} />
    </>
  );
}
