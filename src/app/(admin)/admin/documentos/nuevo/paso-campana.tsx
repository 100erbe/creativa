"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PasosDocumento } from "@/components/admin/pasos-documento";
import { BotonSalirBorrador } from "@/components/admin/boton-salir-borrador";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { MapaInteractivoCampana } from "@/components/mapa/mapa-interactivo-campana";
import { ModalDetallesPunto, type ArticuloModalData } from "@/components/mapa/modal-detalles-punto";
import { TarjetaDeslizablePunto } from "@/components/mapa/tarjeta-deslizable-punto";
import { BarraAccion, CAMPO } from "@/components/ui/panel-busqueda";
import { SelectorFecha } from "@/components/ui/selector-fecha";
import { cn } from "@/lib/cn";
import { ETIQUETA_TIPO } from "@/lib/documentos";
import { ETIQUETA_SOPORTE } from "@/lib/etiquetas";
import { fechaMedia } from "@/lib/formato";
import { formatoPiezas, nombreVisiblePunto } from "@/lib/mapa/geocodificacion";
import { etiquetaTipoUbicacion, type GeometriaZona, type TipoUbicacion } from "@/lib/mapa/zonas";
import type { Cabecera } from "./paso-lineas";
import { actualizarPunto, anadirPunto, crearCampana, eliminarPunto, moverPunto, vincularCampana } from "./acciones";
import { desenvolver } from "@/lib/accion";
import { useAccion } from "@/lib/use-accion";

type Campana = { id: number; nombre: string; fecha_inicio: string | null; fecha_fin: string | null; estado: string };
type Articulo = { id: number; descripcion: string; nombre: string; artista: string | null; piezas: number; unidad: string };
type Punto = {
  id: number;
  nombre: string;
  tipo_soporte: string;
  linea_id: number | null;
  piezas: number | null;
  direccion: string | null;
  latitud: number;
  longitud: number;
  tipo_ubicacion?: TipoUbicacion;
  radio_metros?: number | null;
  geometria?: GeometriaZona | null;
  fecha_colocacion_prevista: string | null;
  fecha_retirada_prevista: string | null;
  estado: string;
  notas: string | null;
};

const entrada = CAMPO;
const areaTexto =
  "rounded-lg border border-borde-campo bg-fondo-superficie px-esp3 py-esp2 text-base text-texto-primario outline-none focus:border-borde-foco md:text-sm";

function etiquetaArticulo(a: Articulo) {
  return a.artista ? `${a.nombre} — ${a.artista}` : a.nombre;
}

export function PasoCampana({
  documento,
  campanas,
  articulos,
  puntos,
}: {
  documento: Cabecera;
  campanas: Campana[];
  articulos: Articulo[];
  puntos: Punto[];
}) {
  const router = useRouter();
  const campana = campanas.find((c) => c.id === documento.campana_id) ?? null;
  const etiquetaTipo = ETIQUETA_TIPO[documento.tipo] ?? "Documento";

  return (
    <div className="flex flex-col gap-esp5">
      <div className="flex flex-wrap items-center gap-esp3">
        <div className="flex-1">
          <p className="text-xs text-texto-terciario">Documentos / Nuevo</p>
          <h1 className="text-2xl font-bold text-texto-primario md:text-titulo-pagina">{etiquetaTipo} en borrador</h1>
        </div>
        <BotonSalirBorrador documentoId={documento.id} />
      </div>

      <PasosDocumento actual={3} documentoId={documento.id} />

      <div>
        <h2 className="text-titulo-panel text-texto-primario">¿Dónde y cómo se hace la campaña?</h2>
        <p className="text-sm text-texto-secundario">
          Marca en el mapa cada punto donde se instalará la publicidad, con el tipo de soporte y las fechas.
          Los instaladores lo verán en su agenda. Si este documento no lleva instalación, puedes saltar este paso.
        </p>
      </div>

      {campana ? (
        <CampanaVinculada documento={documento} campana={campana} articulos={articulos} puntos={puntos} />
      ) : (
        <ElegirCampana documento={documento} campanas={campanas} />
      )}

      <BarraAccion className="md:border-t md:border-borde-default md:pt-esp4">
        <Boton variante="secundario" onClick={() => router.push(`/admin/documentos/nuevo?documento=${documento.id}`)}>
          Atrás
        </Boton>
        <span className="flex-1" />
        {!campana && (
          <Boton variante="fantasma" onClick={() => router.push(`/admin/documentos/${documento.id}`)}>
            Saltar
            <span className="hidden sm:inline">, sin campaña</span>
          </Boton>
        )}
        <Boton onClick={() => router.push(`/admin/documentos/${documento.id}`)}>Continuar</Boton>
      </BarraAccion>
    </div>
  );
}

function ElegirCampana({ documento, campanas }: { documento: Cabecera; campanas: Campana[] }) {
  const { pendiente, error, ejecutar } = useAccion({ refrescar: true });
  const [nombre, setNombre] = useState("");
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [existente, setExistente] = useState("");

  return (
    <div className="grid grid-cols-1 gap-esp4 lg:grid-cols-[1fr_320px]">
      <form
        className="flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie px-esp6 py-esp5"
        onSubmit={(e) => {
          e.preventDefault();
          ejecutar(async () => {
            await desenvolver(crearCampana(documento.id, {
              nombre,
              fecha_inicio: inicio,
              fecha_fin: fin,
              descripcion,
            }));
          });
        }}
      >
        <h3 className="text-base font-semibold text-texto-primario">Nueva campaña</h3>
        <Etiqueta texto="Nombre de la campaña *">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder={`${documento.cliente} · Concierto verano`}
            className={entrada}
          />
        </Etiqueta>
        <div className="grid grid-cols-2 gap-esp3">
          <Etiqueta texto="Inicio (colocación)">
            <SelectorFecha
              value={inicio}
              onChange={(v) => {
                setInicio(v);
                if (fin && v && fin < v) setFin("");
              }}
            />
          </Etiqueta>
          <Etiqueta texto="Fin (retirada)">
            <SelectorFecha value={fin} min={inicio || undefined} onChange={setFin} />
          </Etiqueta>
        </div>
        <Etiqueta texto="Indicaciones generales">
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            placeholder="Ej. instalar de noche, pedir permiso al ayuntamiento…"
            className={areaTexto}
          />
        </Etiqueta>
        {error && <p className="text-sm text-texto-peligro">{error}</p>}
        <Boton type="submit" cargando={pendiente} className="self-end">
          Crear campaña y marcar puntos
        </Boton>
      </form>

      <div className="flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
        <h3 className="text-base font-semibold text-texto-primario">O usar una existente</h3>
        {campanas.length === 0 ? (
          <p className="text-sm text-texto-terciario">Este cliente aún no tiene campañas.</p>
        ) : (
          <>
            <div role="radiogroup" aria-label="Campañas del cliente" className="flex max-h-64 flex-col gap-esp2 overflow-y-auto">
              {campanas.map((c) => {
                const activa = existente === String(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={activa}
                    onClick={() => setExistente(String(c.id))}
                    className={cn(
                      "flex min-h-12 shrink-0 flex-col justify-center rounded-md border px-esp3 py-esp2 text-left",
                      activa
                        ? "border-borde-foco bg-fondo-marca-sutil"
                        : "border-borde-campo bg-fondo-superficie hover:bg-fondo-sutil",
                    )}
                  >
                    <span className="text-sm font-medium text-texto-primario">{c.nombre}</span>
                    {c.fecha_inicio && <span className="text-xs text-texto-terciario">{fechaMedia(c.fecha_inicio)}</span>}
                  </button>
                );
              })}
            </div>
            <Boton
              variante="secundario"
              className="min-h-11"
              disabled={!existente || pendiente}
              onClick={() => ejecutar(() => desenvolver(vincularCampana(documento.id, Number(existente))))}
            >
              Vincular
            </Boton>
          </>
        )}
      </div>
    </div>
  );
}

function CampanaVinculada({
  documento,
  campana,
  articulos,
  puntos,
}: {
  documento: Cabecera;
  campana: Campana;
  articulos: Articulo[];
  puntos: Punto[];
}) {
  const { pendiente, error, ejecutar } = useAccion({ refrescar: true });
  const [puntoModal, setPuntoModal] = useState<Punto | null>(null);
  const [swipeAbiertoId, setSwipeAbiertoId] = useState<number | null>(null);

  const articulosModal: ArticuloModalData[] = articulos.map((a) => ({
    id: a.id,
    etiqueta: etiquetaArticulo(a),
    piezas: a.piezas,
  }));

  const puntoModalActual = puntoModal ? (puntos.find((x) => x.id === puntoModal.id) ?? puntoModal) : null;

  return (
    <div className="flex flex-col gap-esp4">
      <div className="flex flex-wrap items-center gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie px-esp5 py-esp3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fondo-marca-sutil text-texto-marca">
          <Icono nombre="campanas" size={18} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-texto-primario">{campana.nombre}</p>
          <p className="text-xs text-texto-terciario">
            {campana.fecha_inicio ? fechaMedia(campana.fecha_inicio) : "Sin fecha de inicio"}
            {campana.fecha_fin ? ` → ${fechaMedia(campana.fecha_fin)}` : ""} · {puntos.length}{" "}
            {puntos.length === 1 ? "punto" : "puntos"}
          </p>
        </div>
        <Link href={`/admin/campanas/${campana.id}`} className="text-sm font-medium text-texto-marca">
          Abrir campaña
        </Link>
        <button
          disabled={pendiente}
          onClick={() => ejecutar(() => desenvolver(vincularCampana(documento.id, null)))}
          className="text-sm font-medium text-texto-secundario hover:text-texto-peligro"
        >
          Desvincular
        </button>
      </div>
      {error && <p className="text-sm text-texto-peligro">{error}</p>}

      <div className="flex flex-col gap-esp3">
        <p className="text-sm text-texto-secundario">
          {puntos.length > 0
            ? `${puntos.length} ${puntos.length === 1 ? "punto marcado" : "puntos marcados"} en el mapa.`
            : "Abre el mapa para añadir o modificar puntos de la campaña."}
        </p>

        <MapaInteractivoCampana
          tituloModal={`Puntos de la campaña · ${campana.nombre}`}
          puntos={puntos.map((p) => ({
            ...p,
            detalle: ETIQUETA_SOPORTE[p.tipo_soporte],
          }))}
          onCrearPunto={async ({ pos, direccionInicial, tipoUbicacion, radioMetros, geometria }) => {
            const creado = await desenvolver(
              anadirPunto(documento.id, campana.id, {
                lineaId: articulos.length === 1 ? articulos[0]!.id : null,
                piezas: null,
                direccion: direccionInicial,
                latitud: pos.latitud,
                longitud: pos.longitud,
                tipo_ubicacion: tipoUbicacion,
                radio_metros: radioMetros,
                geometria,
                fecha_colocacion_prevista: campana.fecha_inicio ?? "",
                fecha_retirada_prevista: campana.fecha_fin ?? "",
                notas: "",
              }),
            );
            return { ...creado, detalle: ETIQUETA_SOPORTE[creado.tipo_soporte] };
          }}
          onMoverPunto={(p, nuevaPos, dir) =>
            desenvolver(moverPunto(documento.id, campana.id, p.id, nuevaPos.latitud, nuevaPos.longitud, dir))
          }
          onAbrirPunto={(p) => {
            setSwipeAbiertoId(null);
            setPuntoModal(p);
          }}
          onActualizarDireccionTardia={(creado, dirTardia) => {
            setPuntoModal((actual) =>
              actual && actual.id === creado.id && !actual.direccion ? { ...actual, direccion: dirTardia } : actual,
            );
            void moverPunto(documento.id, campana.id, creado.id, creado.latitud, creado.longitud, dirTardia);
          }}
        />
      </div>

      <div className="flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie px-esp4 py-esp4 md:px-esp6 md:py-esp5">
        <div className="flex flex-wrap items-baseline justify-between gap-esp2">
          <h3 className="text-base font-semibold text-texto-primario">Puntos de la campaña · {puntos.length}</h3>
          {puntos.length > 0 && (
            <span className="text-etiqueta text-texto-secundario">
              Pulsa un punto para editarlo o desliza a la izquierda para eliminarlo
            </span>
          )}
        </div>
        {articulos.length > 0 && (
          <div className="flex flex-col gap-1 rounded-md bg-fondo-sutil px-esp3 py-esp2">
            {articulos.map((a) => {
              const usadas = puntos.filter((p) => p.linea_id === a.id).reduce((t, p) => t + (p.piezas ?? 0), 0);
              return (
                <p key={a.id} className="text-xs text-texto-secundario">
                  <span className="font-medium text-texto-primario">{etiquetaArticulo(a)}</span> ·{" "}
                  {formatoPiezas(usadas)} / {formatoPiezas(a.piezas)}
                  {usadas > a.piezas ? (
                    <span className="text-texto-aviso"> · te pasas en {formatoPiezas(usadas - a.piezas)}</span>
                  ) : usadas === a.piezas ? (
                    " · completo"
                  ) : (
                    ` · quedan ${formatoPiezas(a.piezas - usadas)}`
                  )}
                </p>
              );
            })}
          </div>
        )}
        {puntos.length === 0 && (
          <p className="text-sm text-texto-terciario">
            Aún no hay puntos. Pulsa «Añadir o modificar puntos» en el mapa para empezar.
          </p>
        )}
        <div className="flex flex-col divide-y divide-borde-default">
          {puntos.map((p, i) => {
            const articuloActual = articulos.find((x) => x.id === p.linea_id);
            const etiquetaResumen = articuloActual
              ? etiquetaArticulo(articuloActual)
              : (ETIQUETA_SOPORTE[p.tipo_soporte] ?? p.tipo_soporte);
            const faltaArticulo = articulos.length > 0 && p.linea_id == null;

            return (
              <TarjetaDeslizablePunto
                key={p.id}
                nombreVisible={nombreVisiblePunto(p.nombre)}
                eliminable={p.estado === "pendiente"}
                swipeAbierto={swipeAbiertoId === p.id}
                onAbrirSwipe={() => setSwipeAbiertoId(p.id)}
                onCerrarSwipe={() => setSwipeAbiertoId((actual) => (actual === p.id ? null : actual))}
                onAbrirModal={() => {
                  setSwipeAbiertoId(null);
                  setPuntoModal(p);
                }}
                onEliminar={() => desenvolver(eliminarPunto(documento.id, campana.id, p.id))}
                className="hover:bg-fondo-sutil"
              >
                <div className="flex min-h-11 w-full items-start gap-esp3 px-esp2 py-esp3 text-left">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-completo bg-fondo-sutil text-xs font-medium text-texto-secundario">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-esp2">
                      <p className="text-sm font-medium text-texto-primario">
                        {nombreVisiblePunto(p.nombre)}{" "}
                        {etiquetaTipoUbicacion(p.tipo_ubicacion, p.radio_metros, p.direccion) && (
                          <span className="mr-1 inline-flex rounded bg-fondo-marca-sutil px-1.5 py-0.5 align-middle text-micro font-medium text-texto-marca">
                            {etiquetaTipoUbicacion(p.tipo_ubicacion, p.radio_metros, p.direccion)}
                          </span>
                        )}
                        <span className="font-normal text-texto-terciario">
                          · {etiquetaResumen}
                          {p.piezas != null ? ` · ${formatoPiezas(p.piezas)} ud` : ""}
                        </span>
                      </p>
                      {faltaArticulo && (
                        <span className="rounded-md bg-fondo-aviso-sutil px-esp2 py-0.5 text-etiqueta text-texto-aviso">
                          Completar detalles
                        </span>
                      )}
                    </div>
                    {p.direccion && <p className="truncate text-xs text-texto-secundario">{p.direccion}</p>}
                    <p className="text-xs text-texto-terciario">
                      {p.fecha_colocacion_prevista ? `Colocar ${fechaMedia(p.fecha_colocacion_prevista)}` : "Sin fecha"}
                      {p.fecha_retirada_prevista ? ` · retirar ${fechaMedia(p.fecha_retirada_prevista)}` : ""}
                      {p.notas ? ` · ${p.notas}` : ""}
                    </p>
                  </div>
                  {p.estado !== "pendiente" && (
                    <span className="shrink-0 pt-0.5 text-xs text-texto-terciario">{p.estado}</span>
                  )}
                </div>
              </TarjetaDeslizablePunto>
            );
          })}
        </div>
      </div>

      {puntoModalActual && (
        <ModalDetallesPunto
          punto={puntoModalActual}
          articulos={articulosModal}
          puntos={puntos}
          onGuardar={(datos) =>
            desenvolver(
              actualizarPunto(documento.id, campana.id, puntoModalActual.id, {
                lineaId: datos.lineaId,
                piezas: datos.piezas,
                direccion: datos.direccion,
                fecha_colocacion_prevista: datos.fecha_colocacion_prevista,
                fecha_retirada_prevista: datos.fecha_retirada_prevista,
                notas: datos.notas,
                radio_metros: datos.radioMetros,
              }),
            )
          }
          onEliminar={
            puntoModalActual.estado === "pendiente"
              ? () => desenvolver(eliminarPunto(documento.id, campana.id, puntoModalActual.id))
              : undefined
          }
          onCerrar={() => setPuntoModal(null)}
        />
      )}
    </div>
  );
}

function Etiqueta({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-texto-secundario">{texto}</span>
      {children}
    </label>
  );
}
