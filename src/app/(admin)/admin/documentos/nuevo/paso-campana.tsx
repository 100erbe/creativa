"use client";

import { useEffect, useState } from "react";
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
import { avisar, confirmar } from "@/components/ui/dialogos";
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
  const [expandidoId, setExpandidoId] = useState<number | null>(null);

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

      <MapaCampana documentoId={documento.id} campana={campana} articulos={articulos} puntos={puntos} />

      <div className="flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie px-esp4 py-esp4 md:px-esp6 md:py-esp5">
        <div className="flex flex-wrap items-baseline justify-between gap-esp2">
          <h3 className="text-base font-semibold text-texto-primario">Puntos de la campaña · {puntos.length}</h3>
          {puntos.length > 0 && (
            <span className="text-etiqueta text-texto-secundario">Pulsa un punto para editar sus detalles</span>
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
          <p className="text-sm text-texto-terciario">Aún no hay puntos. Pulsa «Nuevo punto» para añadir el primero.</p>
        )}
        <div className="flex flex-col divide-y divide-borde-default">
          {puntos.map((p, i) => (
            <FilaPuntoEditable
              key={p.id}
              indice={i + 1}
              documentoId={documento.id}
              campanaId={campana.id}
              punto={p}
              articulos={articulos}
              puntos={puntos}
              expandido={expandidoId === p.id}
              onAlternar={() => setExpandidoId((actual) => (actual === p.id ? null : p.id))}
              onCerrar={() => setExpandidoId(null)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FormularioDetallesPunto({
  punto,
  articulos,
  puntos,
  pendiente,
  error,
  etiquetaGuardar,
  etiquetaCerrar,
  onLimpiarError,
  onGuardar,
  onCerrar,
}: {
  punto: Punto;
  articulos: Articulo[];
  puntos: Punto[];
  pendiente: boolean;
  error: string | null;
  etiquetaGuardar: string;
  etiquetaCerrar: string;
  onLimpiarError: () => void;
  onGuardar: (datos: {
    lineaId: number | null;
    piezas: number | null;
    direccion: string;
    fecha_colocacion_prevista: string;
    fecha_retirada_prevista: string;
    notas: string;
  }) => void;
  onCerrar: () => void;
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
    <form onSubmit={enviar} className="flex flex-col gap-esp3">
      {articulos.length > 0 ? (
        <div className="grid grid-cols-1 gap-esp3 md:grid-cols-2">
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
                  ? `Con este punto te pasas ${formatoPiezas(-restantes)} del total (${formatoPiezas(articuloElegido.piezas)}). Puedes guardarlo igualmente.`
                  : restantes === 0
                    ? `Con este punto se reparte todo el artículo (${formatoPiezas(articuloElegido.piezas)}).`
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
      <div className="flex justify-end gap-esp2">
        <Boton type="button" variante="secundario" disabled={pendiente} onClick={onCerrar}>
          {etiquetaCerrar}
        </Boton>
        <Boton type="submit" cargando={pendiente}>
          {etiquetaGuardar}
        </Boton>
      </div>
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

  return createPortal(
    <div
      data-punto-modal=""
      className="fixed inset-0 z-[10000] flex items-end justify-center p-esp4 sm:items-center"
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
        className="animate-hoja-subir sm:animate-modal-entrar relative flex max-h-[88dvh] w-full max-w-lg flex-col gap-esp4 overflow-y-auto rounded-xl border border-borde-default bg-fondo-superficie p-esp5 shadow-elevado md:p-esp6"
      >
        <div className="flex items-start justify-between gap-esp3">
          <div>
            <h3 id="titulo-modal-punto" className="text-titulo-panel text-texto-primario">
              {punto.nombre}
            </h3>
            <p className="text-meta text-texto-secundario">
              Puedes guardar los detalles ahora o cerrar y completarlos más tarde.
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onCerrar}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-borde-default bg-fondo-superficie text-icono-default transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
          >
            <Icono nombre="cerrar" size={18} />
          </button>
        </div>

        <FormularioDetallesPunto
          key={punto.id}
          punto={punto}
          articulos={articulos}
          puntos={puntos}
          pendiente={pendiente}
          error={error}
          etiquetaGuardar="Guardar detalles"
          etiquetaCerrar="Cerrar"
          onLimpiarError={() => setError(null)}
          onCerrar={onCerrar}
          onGuardar={(datos) => {
            ejecutar(async () => {
              await desenvolver(actualizarPunto(documentoId, campanaId, punto.id, datos));
              onCerrar();
            });
          }}
        />
      </div>
    </div>,
    document.body,
  );
}

function FilaPuntoEditable({
  indice,
  documentoId,
  campanaId,
  punto,
  articulos,
  puntos,
  expandido,
  onAlternar,
  onCerrar,
}: {
  indice: number;
  documentoId: number;
  campanaId: number;
  punto: Punto;
  articulos: Articulo[];
  puntos: Punto[];
  expandido: boolean;
  onAlternar: () => void;
  onCerrar: () => void;
}) {
  const { pendiente, error, setError, ejecutar } = useAccion({ refrescar: true });

  const articuloActual = articulos.find((x) => x.id === punto.linea_id);
  const etiquetaResumen = articuloActual
    ? etiquetaArticulo(articuloActual)
    : (ETIQUETA_SOPORTE[punto.tipo_soporte] ?? punto.tipo_soporte);
  const faltaArticulo = articulos.length > 0 && punto.linea_id == null;

  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-esp2 py-esp2">
        <button
          type="button"
          aria-expanded={expandido}
          onClick={() => {
            setError(null);
            onAlternar();
          }}
          className="flex min-h-11 min-w-0 flex-1 items-start gap-esp3 rounded-lg px-esp2 py-esp2 text-left transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
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
          </div>
          <span className="inline-flex shrink-0 items-center gap-esp1 pt-0.5 text-etiqueta text-texto-marca">
            <span>{expandido ? "Cerrar" : "Editar"}</span>
            <Icono
              nombre="chevron"
              size={16}
              className={cn(
                "transition-transform duration-rapida ease-salida",
                expandido ? "-rotate-90" : "rotate-90",
              )}
            />
          </span>
        </button>

        {punto.estado === "pendiente" ? (
          <button
            type="button"
            aria-label={`Eliminar ${punto.nombre}`}
            disabled={pendiente}
            onClick={async () => {
              if (!(await confirmar(`¿Eliminar el punto «${punto.nombre}»?`))) return;
              ejecutar(() => desenvolver(eliminarPunto(documentoId, campanaId, punto.id)));
            }}
            className="mt-esp1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-peligro-sutil hover:text-texto-peligro disabled:opacity-50"
          >
            <Icono nombre="eliminar" size={16} />
          </button>
        ) : (
          <span className="mt-esp2 shrink-0 px-esp2 text-xs text-texto-terciario">{punto.estado}</span>
        )}
      </div>

      {expandido && (
        <div className="animate-estado-entrar mb-esp3 rounded-xl border border-borde-default bg-fondo-sutil p-esp4">
          <FormularioDetallesPunto
            key={`${punto.id}-${punto.linea_id ?? ""}-${punto.piezas ?? ""}-${punto.direccion ?? ""}-${punto.notas ?? ""}`}
            punto={punto}
            articulos={articulos}
            puntos={puntos}
            pendiente={pendiente}
            error={error}
            etiquetaGuardar="Guardar cambios"
            etiquetaCerrar="Cancelar"
            onLimpiarError={() => setError(null)}
            onCerrar={onCerrar}
            onGuardar={(datos) => {
              ejecutar(async () => {
                await desenvolver(actualizarPunto(documentoId, campanaId, punto.id, datos));
                onCerrar();
              });
            }}
          />
        </div>
      )}
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
}: {
  documentoId: number;
  campana: Campana;
  articulos: Articulo[];
  puntos: Punto[];
}) {
  const { pendiente, error, setError, ejecutar } = useAccion({ refrescar: true });
  const [seleccionando, setSeleccionando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [vistaBuscada, setVistaBuscada] = useState<Posicion | null>(null);
  const [centrarEn, setCentrarEn] = useState(0);
  const [puntoModal, setPuntoModal] = useState<Punto | null>(null);

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

  // Solo el tap/clic simple añade el punto y abre el modal pop-up para sus detalles.
  function elegirEnMapa(p: Posicion) {
    if (!seleccionando || pendiente) return;
    setError(null);
    const lineaPorDefecto = articulos.length === 1 ? articulos[0]!.id : null;
    const promesaDireccion = direccionDe(p);
    ejecutar(async () => {
      const dirInicial = await Promise.race([
        promesaDireccion,
        new Promise<string>((r) => setTimeout(() => r(""), 650)),
      ]);
      const creado = await desenvolver(
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
      );
      setPuntoModal(creado);
      if (!dirInicial) {
        void promesaDireccion.then((dirTardia) => {
          if (!dirTardia) return;
          setPuntoModal((actual) => (actual && actual.id === creado.id && !actual.direccion ? { ...actual, direccion: dirTardia } : actual));
          void moverPunto(documentoId, campana.id, creado.id, creado.latitud, creado.longitud, dirTardia);
        });
      }
    });
  }

  function abrirNuevoPuntoExterno() {
    setError(null);
    setSeleccionando(true);
    if (window.matchMedia("(max-width: 767px)").matches) {
      setModalAbierto(true);
    }
  }

  function abrirDesdeMapa() {
    setError(null);
    setSeleccionando(true);
  }

  function clicEnPuntoExistente(punto: PuntoExistente) {
    const encontrado = puntos.find((x) => x.id === punto.id);
    if (encontrado) setPuntoModal(encontrado);
  }

  function moverPuntoEnMapa(punto: PuntoExistente, nuevaPos: Posicion) {
    setError(null);
    const promesaDir = direccionDe(nuevaPos);
    ejecutar(async () => {
      const dir = await Promise.race([
        promesaDir,
        new Promise<string>((r) => setTimeout(() => r(""), 650)),
      ]);
      await desenvolver(
        moverPunto(documentoId, campana.id, punto.id, nuevaPos.latitud, nuevaPos.longitud, dir || undefined),
      );
    });
  }

  async function solicitarEliminarPunto(punto: PuntoExistente) {
    if (punto.estado && punto.estado !== "pendiente") {
      await avisar(`El punto «${punto.nombre}» ya está ${punto.estado} y no se puede eliminar.`);
      return;
    }
    if (!(await confirmar(`¿Eliminar el punto «${punto.nombre}»?`))) return;
    ejecutar(() => desenvolver(eliminarPunto(documentoId, campana.id, punto.id)));
  }

  const puntosMapa: PuntoExistente[] = puntos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    latitud: p.latitud,
    longitud: p.longitud,
    detalle: ETIQUETA_SOPORTE[p.tipo_soporte],
    estado: p.estado,
  }));

  return (
    <div className="flex flex-col gap-esp3">
      <div className="flex flex-wrap items-center justify-between gap-esp3">
        <p className="text-sm text-texto-secundario">
          {seleccionando
            ? "Toca el mapa para añadir un punto o busca una dirección para centrarlo."
            : puntos.length > 0
              ? `${puntos.length} ${puntos.length === 1 ? "punto marcado" : "puntos marcados"} en el mapa.`
              : "Pulsa «Nuevo punto» para marcar una ubicación en el mapa."}
        </p>
        {seleccionando ? (
          <Boton type="button" variante="secundario" disabled={pendiente} onClick={() => setSeleccionando(false)}>
            Listo
          </Boton>
        ) : (
          <Boton type="button" onClick={abrirNuevoPuntoExterno}>
            <Icono nombre="mas" size={16} />
            Nuevo punto
          </Boton>
        )}
      </div>

      <SafeMapContainer
        title={seleccionando ? `Nuevo punto · ${campana.nombre}` : `Puntos de la campaña · ${campana.nombre}`}
        exploreLabel={seleccionando ? "Añadir en el mapa" : "Explorar mapa"}
        open={modalAbierto}
        onOpenChange={(siguiente) => {
          setModalAbierto(siguiente);
          if (!siguiente) {
            setSeleccionando(false);
          }
        }}
        modalAction={
          seleccionando ? (
            <Boton type="button" variante="secundario" tamano="s" onClick={() => setSeleccionando(false)}>
              Listo
            </Boton>
          ) : (
            <Boton type="button" tamano="s" onClick={abrirDesdeMapa}>
              <Icono nombre="mas" size={16} />
              Nuevo punto
            </Boton>
          )
        }
      >
        <div className="relative h-full max-md:[&>*:first-child]:!h-full">
          <MapaSelector
            puntos={puntosMapa}
            posicion={null}
            vistaBuscada={vistaBuscada}
            onElegir={elegirEnMapa}
            onClicPunto={clicEnPuntoExistente}
            onMoverPunto={moverPuntoEnMapa}
            onPulsacionLargaPunto={solicitarEliminarPunto}
            centrarEn={centrarEn}
            soloLectura={!seleccionando}
          />
          <ControlesEnMapa
            seleccionando={seleccionando}
            hayPuntos={puntos.length > 0}
            pendiente={pendiente}
            onNuevoPunto={abrirDesdeMapa}
            onListo={() => setSeleccionando(false)}
            onElegirBusqueda={elegirBusqueda}
          />
        </div>
      </SafeMapContainer>

      {error && <p className="text-xs text-texto-peligro">{error}</p>}

      {puntoModal && (
        <ModalDetallesPunto
          punto={puntoModal}
          documentoId={documentoId}
          campanaId={campana.id}
          articulos={articulos}
          puntos={puntos}
          onCerrar={() => setPuntoModal(null)}
        />
      )}
    </div>
  );
}

function ControlesEnMapa({
  seleccionando,
  hayPuntos,
  pendiente,
  onNuevoPunto,
  onListo,
  onElegirBusqueda,
}: {
  seleccionando: boolean;
  hayPuntos: boolean;
  pendiente: boolean;
  onNuevoPunto: () => void;
  onListo: () => void;
  onElegirBusqueda: (s: Sugerencia) => void;
}) {
  const { enModal } = useSafeMap();
  const ocultarEnMovilPreview = !enModal;

  return (
    <>
      <div
        className={cn(
          "pointer-events-none absolute left-14 right-esp3 top-esp3 z-[1000] flex items-start justify-between gap-esp2",
          ocultarEnMovilPreview && "max-md:hidden",
        )}
      >
        <div className="pointer-events-auto min-w-0 flex-1 md:max-w-md">
          {seleccionando && (
            <BuscadorDireccion
              onElegir={onElegirBusqueda}
              placeholder="Buscar dirección o lugar…"
              inputClassName="shadow-elevado"
            />
          )}
        </div>
        {/* En el modal móvil el CTA vive en la cabecera del SafeMapContainer; en escritorio va arriba a la derecha dentro del mapa. */}
        {!enModal && (
          <div className="pointer-events-auto hidden shrink-0 md:block">
            {seleccionando ? (
              <Boton type="button" variante="secundario" tamano="s" onClick={onListo} className="shadow-elevado">
                Listo
              </Boton>
            ) : (
              <Boton type="button" tamano="s" onClick={onNuevoPunto} className="shadow-elevado">
                <Icono nombre="mas" size={16} />
                Nuevo punto
              </Boton>
            )}
          </div>
        )}
      </div>

      {(seleccionando || hayPuntos) && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-esp3 bottom-esp3 z-[1000] flex justify-center",
            ocultarEnMovilPreview && "max-md:hidden",
          )}
        >
          <p className="rounded-lg border border-borde-default bg-fondo-superficie px-esp3 py-esp1 text-center text-meta font-medium text-texto-secundario shadow-elevado">
            {pendiente
              ? "Guardando punto en la campaña…"
              : seleccionando
                ? "Toca el mapa para añadir un punto. Arrástralo para moverlo o tócalo para editar sus detalles."
                : "Arrastra un punto para moverlo o tócalo para editar sus detalles. Mantén pulsado para eliminarlo."}
          </p>
        </div>
      )}
    </>
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
