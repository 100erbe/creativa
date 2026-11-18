"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PasosDocumento } from "@/components/admin/pasos-documento";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { MapaSelector, type Posicion, type PuntoExistente } from "@/components/mapa/mapa-selector";
import { SafeMapContainer, useSafeMap } from "@/components/shared/SafeMapContainer";
import { BuscadorDireccion, type Sugerencia } from "@/components/mapa/buscador-direccion";
import { BarraAccion, CAMPO } from "@/components/ui/panel-busqueda";
import { cn } from "@/lib/cn";
import { ETIQUETA_TIPO } from "@/lib/documentos";
import { fechaMedia } from "@/lib/formato";
import type { Cabecera } from "./paso-lineas";
import { actualizarPunto, anadirPunto, crearCampana, eliminarPunto, moverPunto, vincularCampana } from "./acciones";
import { desenvolver } from "@/lib/accion";
import { confirmar } from "@/components/ui/dialogos";
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
  fecha_colocacion_prevista: string | null;
  fecha_retirada_prevista: string | null;
  estado: string;
  notas: string | null;
};

const SOPORTES = [
  { valor: "cartel", etiqueta: "Cartel" },
  { valor: "lona", etiqueta: "Lona" },
  { valor: "valla", etiqueta: "Valla" },
  { valor: "totem", etiqueta: "Tótem" },
  { valor: "mobiliario_urbano", etiqueta: "Mobiliario urbano / farola" },
  { valor: "marquesina", etiqueta: "Marquesina" },
  { valor: "pantalla", etiqueta: "Pantalla" },
  { valor: "otro", etiqueta: "Otro soporte" },
] as const;
const ETIQUETA_SOPORTE = Object.fromEntries(SOPORTES.map((s) => [s.valor, s.etiqueta])) as Record<string, string>;

const entrada = CAMPO;
const areaTexto =
  "rounded-lg border border-borde-campo bg-fondo-superficie px-esp3 py-esp2 text-base text-texto-primario outline-none focus:border-borde-foco md:text-sm";

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
        <Link href="/admin/documentos">
          <Boton variante="secundario">Guardar y salir</Boton>
        </Link>
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
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={entrada} />
          </Etiqueta>
          <Etiqueta texto="Fin (retirada)">
            <input type="date" value={fin} min={inicio || undefined} onChange={(e) => setFin(e.target.value)} className={entrada} />
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

      <MapaCampana
        documentoId={documento.id}
        campana={campana}
        articulos={articulos}
        puntos={puntos}
        onAbrirPunto={(p) => {
          setSwipeAbiertoId(null);
          setPuntoModal(p);
        }}
        onActualizarDireccionTardia={(id, dir) => {
          setPuntoModal((actual) =>
            actual && actual.id === id && !actual.direccion ? { ...actual, direccion: dir } : actual,
          );
        }}
      />

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
          {puntos.map((p, i) => (
            <TarjetaPunto
              key={p.id}
              indice={i + 1}
              documentoId={documento.id}
              campanaId={campana.id}
              punto={p}
              articulos={articulos}
              swipeAbierto={swipeAbiertoId === p.id}
              onAbrirSwipe={() => setSwipeAbiertoId(p.id)}
              onCerrarSwipe={() => setSwipeAbiertoId((actual) => (actual === p.id ? null : actual))}
              onAbrirModal={() => {
                setSwipeAbiertoId(null);
                setPuntoModal(p);
              }}
            />
          ))}
        </div>
      </div>

      {puntoModalActual && (
        <ModalDetallesPunto
          punto={puntoModalActual}
          documentoId={documento.id}
          campanaId={campana.id}
          articulos={articulos}
          puntos={puntos}
          onCerrar={() => setPuntoModal(null)}
        />
      )}
    </div>
  );
}

function FormularioDetallesPunto({
  formId,
  punto,
  articulos,
  puntos,
  error,
  onLimpiarError,
  onGuardar,
}: {
  formId: string;
  punto: Punto;
  articulos: Articulo[];
  puntos: Punto[];
  error: string | null;
  onLimpiarError: () => void;
  onGuardar: (datos: {
    lineaId: number | null;
    piezas: number | null;
    direccion: string;
    fecha_colocacion_prevista: string;
    fecha_retirada_prevista: string;
    notas: string;
  }) => void;
}) {
  const [lineaId, setLineaId] = useState<string>(
    punto.linea_id != null ? String(punto.linea_id) : articulos.length === 1 ? String(articulos[0]!.id) : "",
  );
  const [piezas, setPiezas] = useState(punto.piezas != null ? String(punto.piezas).replace(".", ",") : "");
  const [direccion, setDireccion] = useState(punto.direccion ?? "");
  const [colocacion, setColocacion] = useState(punto.fecha_colocacion_prevista ?? "");
  const [retirada, setRetirada] = useState(punto.fecha_retirada_prevista ?? "");
  const [notas, setNotas] = useState(punto.notas ?? "");

  // Sincroniza si llega la dirección geocodificada justo tras abrir el modal.
  useEffect(() => {
    setDireccion((actual) => (actual === "" && punto.direccion ? punto.direccion : actual));
  }, [punto.direccion]);

  const articuloElegido = articulos.find((x) => String(x.id) === lineaId) ?? null;
  const repartidasOtros = articuloElegido
    ? puntos
        .filter((otro) => otro.id !== punto.id && otro.linea_id === articuloElegido.id)
        .reduce((t, otro) => t + (otro.piezas ?? 0), 0)
    : 0;
  const restantes = articuloElegido
    ? articuloElegido.piezas - repartidasOtros - (Number(piezas.replace(",", ".")) || 0)
    : 0;

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    onLimpiarError();
    const nPiezas = piezas.trim() === "" ? null : Number(piezas.replace(",", "."));
    onGuardar({
      lineaId: lineaId ? Number(lineaId) : null,
      piezas: nPiezas,
      direccion,
      fecha_colocacion_prevista: colocacion,
      fecha_retirada_prevista: retirada,
      notas,
    });
  }

  return (
    <form id={formId} onSubmit={enviar} className="flex flex-col gap-esp3">
      {articulos.length > 0 ? (
        <div className="grid grid-cols-1 gap-esp2 sm:grid-cols-2 sm:gap-esp3">
          <Etiqueta texto="Artículo">
            <select
              value={lineaId}
              onChange={(e) => {
                setLineaId(e.target.value);
                onLimpiarError();
              }}
              className={entrada}
            >
              <option value="">Elige un artículo…</option>
              {articulos.map((a) => (
                <option key={a.id} value={a.id}>
                  {etiquetaArticulo(a)}
                </option>
              ))}
            </select>
          </Etiqueta>
          <Etiqueta texto="Piezas de este punto">
            <input value={piezas} onChange={(e) => setPiezas(e.target.value)} inputMode="decimal" className={entrada} />
            {articuloElegido && (
              <span
                className={restantes < 0 ? "text-xs text-texto-aviso" : "text-xs text-texto-terciario"}
                role="status"
              >
                {restantes < 0
                  ? `Te pasas ${formatoPiezas(-restantes)} del total (${formatoPiezas(articuloElegido.piezas)}).`
                  : restantes === 0
                    ? `Repartido todo el artículo (${formatoPiezas(articuloElegido.piezas)}).`
                    : `Quedan ${formatoPiezas(restantes)} de ${formatoPiezas(articuloElegido.piezas)}`}
              </span>
            )}
          </Etiqueta>
        </div>
      ) : (
        <p className="rounded-md bg-fondo-aviso-sutil px-esp3 py-esp2 text-xs text-texto-primario">
          Este documento aún no tiene artículos. Añádelos en el paso 2 para poder asignarlos a los puntos.
        </p>
      )}
      <Etiqueta texto="Dirección">
        <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={entrada} />
      </Etiqueta>
      <div className="grid grid-cols-2 gap-esp2">
        <Etiqueta texto="Colocar el">
          <input type="date" value={colocacion} onChange={(e) => setColocacion(e.target.value)} className={entrada} />
        </Etiqueta>
        <Etiqueta texto="Retirar el">
          <input
            type="date"
            value={retirada}
            min={colocacion || undefined}
            onChange={(e) => setRetirada(e.target.value)}
            className={entrada}
          />
        </Etiqueta>
      </div>
      <Etiqueta texto="Cómo instalar">
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          placeholder="Ej. 2 carteles 70x100 con bridas, cara hacia la rotonda"
          className={areaTexto}
        />
      </Etiqueta>
      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </form>
  );
}

function ModalDetallesPunto({
  punto,
  documentoId,
  campanaId,
  articulos,
  puntos,
  onCerrar,
}: {
  punto: Punto;
  documentoId: number;
  campanaId: number;
  articulos: Articulo[];
  puntos: Punto[];
  onCerrar: () => void;
}) {
  const { pendiente, error, setError, ejecutar } = useAccion({ refrescar: true });
  const [montado, setMontado] = useState(false);
  const formId = "form-detalles-punto";

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.querySelector('[role="alertdialog"]')) return;
        onCerrar();
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  if (!montado) return null;

  async function manejarEliminar() {
    if (!(await confirmar(`¿Eliminar el punto «${punto.nombre}»?`))) return;
    ejecutar(async () => {
      await desenvolver(eliminarPunto(documentoId, campanaId, punto.id));
      onCerrar();
    });
  }

  return createPortal(
    <div
      data-punto-modal=""
      className="fixed inset-0 z-[10000] flex items-end justify-center p-0 sm:items-center sm:p-esp4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Cerrar detalles del punto"
        tabIndex={-1}
        onClick={onCerrar}
        className="animate-velo-entrar absolute inset-0 cursor-default bg-fondo-velo"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-punto"
        className="animate-hoja-subir sm:animate-modal-entrar relative flex h-[100dvh] w-full flex-col overflow-hidden bg-fondo-superficie shadow-elevado sm:h-auto sm:max-h-[90dvh] sm:max-w-xl sm:rounded-xl sm:border sm:border-borde-default"
      >
        <div className="flex shrink-0 items-center justify-between gap-esp3 border-b border-borde-default px-esp4 py-esp3 sm:px-esp6 sm:py-esp4">
          <h3 id="titulo-modal-punto" className="min-w-0 truncate text-titulo-panel text-texto-primario">
            {punto.nombre}
          </h3>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onCerrar}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-borde-default bg-fondo-superficie text-icono-default transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
          >
            <Icono nombre="cerrar" size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-esp4 py-esp3 sm:px-esp6 sm:py-esp4">
          <FormularioDetallesPunto
            key={punto.id}
            formId={formId}
            punto={punto}
            articulos={articulos}
            puntos={puntos}
            error={error}
            onLimpiarError={() => setError(null)}
            onGuardar={(datos) => {
              ejecutar(async () => {
                await desenvolver(actualizarPunto(documentoId, campanaId, punto.id, datos));
                onCerrar();
              });
            }}
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-esp2 border-t border-borde-default bg-fondo-superficie px-esp4 py-esp3 sm:px-esp6 sm:py-esp4">
          {punto.estado === "pendiente" && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => void manejarEliminar()}
              className="inline-flex min-h-11 items-center gap-esp1 rounded-lg px-esp2 text-etiqueta text-texto-peligro transition-colors duration-rapida ease-suave hover:bg-fondo-peligro-sutil active:scale-press disabled:opacity-50 md:min-h-[42px]"
            >
              <Icono nombre="eliminar" size={16} />
              Eliminar punto
            </button>
          )}
          <div className="ml-auto flex gap-esp2">
            <Boton type="button" variante="secundario" disabled={pendiente} onClick={onCerrar}>
              Cerrar
            </Boton>
            <Boton type="submit" form={formId} cargando={pendiente}>
              Guardar detalles
            </Boton>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const ANCHO_ACCION_ELIMINAR = 80;

function TarjetaPunto({
  indice,
  documentoId,
  campanaId,
  punto,
  articulos,
  swipeAbierto,
  onAbrirSwipe,
  onCerrarSwipe,
  onAbrirModal,
}: {
  indice: number;
  documentoId: number;
  campanaId: number;
  punto: Punto;
  articulos: Articulo[];
  swipeAbierto: boolean;
  onAbrirSwipe: () => void;
  onCerrarSwipe: () => void;
  onAbrirModal: () => void;
}) {
  const { pendiente, error, ejecutar } = useAccion({ refrescar: true });
  const [desplazamientoDrag, setDesplazamientoDrag] = useState<number | null>(null);
  const gestoRef = useRef<{
    pointerId: number;
    inicioX: number;
    inicioY: number;
    base: number;
    bloqueado: "horizontal" | "vertical" | null;
  } | null>(null);
  const suprimirClicRef = useRef(false);

  const eliminable = punto.estado === "pendiente";
  const desplazamiento = eliminable ? (desplazamientoDrag ?? (swipeAbierto ? -ANCHO_ACCION_ELIMINAR : 0)) : 0;
  const arrastreActivo = desplazamientoDrag !== null;
  const progresoAccion = Math.min(1, Math.max(0, Math.abs(desplazamiento) / ANCHO_ACCION_ELIMINAR));
  const accionVisible = eliminable && (swipeAbierto || desplazamiento < -4);

  const articuloActual = articulos.find((x) => x.id === punto.linea_id);
  const etiquetaResumen = articuloActual
    ? etiquetaArticulo(articuloActual)
    : (ETIQUETA_SOPORTE[punto.tipo_soporte] ?? punto.tipo_soporte);
  const faltaArticulo = articulos.length > 0 && punto.linea_id == null;

  function alIniciarPuntero(e: React.PointerEvent<HTMLDivElement>) {
    if (!eliminable || pendiente) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    suprimirClicRef.current = false;
    gestoRef.current = {
      pointerId: e.pointerId,
      inicioX: e.clientX,
      inicioY: e.clientY,
      base: swipeAbierto ? -ANCHO_ACCION_ELIMINAR : 0,
      bloqueado: null,
    };
  }

  function alMoverPuntero(e: React.PointerEvent<HTMLDivElement>) {
    const gesto = gestoRef.current;
    if (!gesto || e.pointerId !== gesto.pointerId) return;
    const dx = e.clientX - gesto.inicioX;
    const dy = e.clientY - gesto.inicioY;

    if (!gesto.bloqueado) {
      if (Math.hypot(dx, dy) < 8) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        gesto.bloqueado = "horizontal";
        suprimirClicRef.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } else {
        gesto.bloqueado = "vertical";
        return;
      }
    }

    if (gesto.bloqueado !== "horizontal") return;
    const siguiente = Math.max(-ANCHO_ACCION_ELIMINAR - 8, Math.min(0, gesto.base + dx));
    setDesplazamientoDrag(siguiente);
  }

  function alTerminarPuntero(e: React.PointerEvent<HTMLDivElement>) {
    const gesto = gestoRef.current;
    if (!gesto || e.pointerId !== gesto.pointerId) return;
    gestoRef.current = null;
    if (gesto.bloqueado !== "horizontal") return;

    const final = desplazamientoDrag ?? gesto.base;
    setDesplazamientoDrag(null);
    if (final <= -(ANCHO_ACCION_ELIMINAR * 0.45)) {
      onAbrirSwipe();
    } else {
      onCerrarSwipe();
    }
    setTimeout(() => {
      suprimirClicRef.current = false;
    }, 60);
  }

  function alRueda(e: React.WheelEvent<HTMLDivElement>) {
    if (!eliminable || pendiente) return;
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    if (e.deltaX > 12) {
      onAbrirSwipe();
    } else if (e.deltaX < -12) {
      onCerrarSwipe();
    }
  }

  async function eliminarConConfirmacion() {
    if (!(await confirmar(`¿Eliminar el punto «${punto.nombre}»?`))) {
      onCerrarSwipe();
      return;
    }
    ejecutar(async () => {
      await desenvolver(eliminarPunto(documentoId, campanaId, punto.id));
      onCerrarSwipe();
    });
  }

  return (
    <div className="relative overflow-hidden">
      {eliminable && (
        <div
          aria-hidden={!accionVisible}
          className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-fondo-peligro"
        >
          <button
            type="button"
            tabIndex={swipeAbierto ? 0 : -1}
            disabled={pendiente}
            aria-label={`Eliminar ${punto.nombre}`}
            onClick={() => void eliminarConConfirmacion()}
            style={{
              opacity: Math.max(0.25, progresoAccion),
              transform: `scale(${0.76 + 0.24 * progresoAccion})`,
            }}
            className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-texto-inverso transition-all duration-rapida ease-salida hover:bg-fondo-peligro-hover active:scale-press disabled:opacity-50"
          >
            <Icono nombre="eliminar" size={18} />
            <span className="text-micro font-medium">Eliminar</span>
          </button>
        </div>
      )}

      <div
        onPointerDown={alIniciarPuntero}
        onPointerMove={alMoverPuntero}
        onPointerUp={alTerminarPuntero}
        onPointerCancel={alTerminarPuntero}
        onWheel={alRueda}
        style={{ transform: `translate3d(${desplazamiento}px, 0, 0)` }}
        className={cn(
          "relative z-10 bg-fondo-superficie touch-pan-y",
          arrastreActivo ? "select-none" : "transition-transform duration-rapida ease-salida",
        )}
      >
        <button
          type="button"
          onClick={() => {
            if (suprimirClicRef.current) return;
            if (swipeAbierto) {
              onCerrarSwipe();
              return;
            }
            onAbrirModal();
          }}
          className="flex min-h-11 w-full items-start gap-esp3 px-esp2 py-esp3 text-left transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
        >
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-completo bg-fondo-sutil text-xs font-medium text-texto-secundario">
            {indice}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-esp2">
              <p className="text-sm font-medium text-texto-primario">
                {punto.nombre}{" "}
                <span className="font-normal text-texto-terciario">
                  · {etiquetaResumen}
                  {punto.piezas != null ? ` · ${formatoPiezas(punto.piezas)} pzs` : ""}
                </span>
              </p>
              {faltaArticulo && (
                <span className="rounded-md bg-fondo-aviso-sutil px-esp2 py-0.5 text-etiqueta text-texto-aviso">
                  Completar detalles
                </span>
              )}
            </div>
            {punto.direccion && <p className="truncate text-xs text-texto-secundario">{punto.direccion}</p>}
            <p className="text-xs text-texto-terciario">
              {punto.fecha_colocacion_prevista ? `Colocar ${fechaMedia(punto.fecha_colocacion_prevista)}` : "Sin fecha"}
              {punto.fecha_retirada_prevista ? ` · retirar ${fechaMedia(punto.fecha_retirada_prevista)}` : ""}
              {punto.notas ? ` · ${punto.notas}` : ""}
            </p>
            {error && <p className="mt-1 text-xs text-texto-peligro">{error}</p>}
          </div>
          {!eliminable && (
            <span className="shrink-0 pt-0.5 text-xs text-texto-terciario">{punto.estado}</span>
          )}
        </button>
      </div>
    </div>
  );
}


function etiquetaArticulo(a: Articulo) {
  return a.artista ? `${a.nombre} — ${a.artista}` : a.nombre;
}

const formatoPiezas = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ","));

function MapaCampana({
  documentoId,
  campana,
  articulos,
  puntos,
  onAbrirPunto,
  onActualizarDireccionTardia,
}: {
  documentoId: number;
  campana: Campana;
  articulos: Articulo[];
  puntos: Punto[];
  onAbrirPunto: (punto: Punto) => void;
  onActualizarDireccionTardia: (id: number, direccion: string) => void;
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

  // Al elegir una sugerencia en el buscador: solo mueve/centra el mapa, sin añadir ningún punto.
  function elegirBusqueda(sugerencia: Sugerencia) {
    setVistaBuscada({ latitud: sugerencia.latitud, longitud: sugerencia.longitud });
    setCentrarEn((n) => n + 1);
    setError(null);
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

  // Clic/tap en zona vacía del mapa: microanimación de cerchi concentrici mientras guarda y abre el modal.
  function elegirEnMapa(p: Posicion) {
    if (!modalAbierto || pendiente || creandoRef.current) return;
    creandoRef.current = true;
    setError(null);
    setCreandoPos(p);
    const lineaPorDefecto = articulos.length === 1 ? articulos[0]!.id : null;
    const promesaDireccion = direccionDe(p);
    const pausaAnimacion = new Promise<void>((r) => setTimeout(r, 450));

    ejecutar(async () => {
      try {
        const dirInicial = await Promise.race([
          promesaDireccion,
          new Promise<string>((r) => setTimeout(() => r(""), 420)),
        ]);
        const [creado] = await Promise.all([
          desenvolver(
            anadirPunto(documentoId, campana.id, {
              lineaId: lineaPorDefecto,
              piezas: null,
              direccion: dirInicial,
              latitud: p.latitud,
              longitud: p.longitud,
              fecha_colocacion_prevista: campana.fecha_inicio ?? "",
              fecha_retirada_prevista: campana.fecha_fin ?? "",
              notas: "",
            }),
          ),
          pausaAnimacion,
        ]);
        setCreandoPos(null);
        onAbrirPunto(creado);
        if (!dirInicial) {
          void promesaDireccion.then((dirTardia) => {
            if (!dirTardia) return;
            onActualizarDireccionTardia(creado.id, dirTardia);
            void moverPunto(documentoId, campana.id, creado.id, creado.latitud, creado.longitud, dirTardia);
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
    setMovimientosPendientes((prev) => ({ ...prev, [punto.id]: nuevaPos }));
    if (!(await confirmar(`¿Mover «${punto.nombre}» a esta nueva ubicación?`))) {
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
        await desenvolver(
          moverPunto(documentoId, campana.id, punto.id, nuevaPos.latitud, nuevaPos.longitud, dir || undefined),
        );
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
      nombre: p.nombre,
      latitud: pos ? pos.latitud : p.latitud,
      longitud: pos ? pos.longitud : p.longitud,
      detalle: ETIQUETA_SOPORTE[p.tipo_soporte],
      estado: p.estado,
    };
  });

  return (
    <div className="flex flex-col gap-esp3">
      <p className="text-sm text-texto-secundario">
        {puntos.length > 0
          ? `${puntos.length} ${puntos.length === 1 ? "punto marcado" : "puntos marcados"} en el mapa.`
          : "Abre el mapa para añadir o modificar puntos de la campaña."}
      </p>

      <SafeMapContainer
        modalSiempre
        tamanoMaximo
        varianteTrigger="primario"
        exploreIcon="ubicacion"
        title={`Puntos de la campaña · ${campana.nombre}`}
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

function Etiqueta({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-texto-secundario">{texto}</span>
      {children}
    </label>
  );
}
