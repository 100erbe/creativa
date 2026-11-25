"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { SelectorFecha } from "@/components/ui/selector-fecha";
import { confirmar } from "@/components/ui/dialogos";
import { ETIQUETA_SOPORTE } from "@/lib/etiquetas";
import { formatoPiezas, nombreVisiblePunto } from "@/lib/mapa/geocodificacion";
import {
  RADIOS_ZONA,
  RADIO_DEFECTO_METROS,
  etiquetaTipoUbicacion,
  formatoRadio,
  type GeometriaZona,
  type TipoUbicacion,
} from "@/lib/mapa/zonas";
import { useAccion } from "@/lib/use-accion";
import { atraparFoco } from "@/lib/trampa-foco";

export type ArticuloModalData = {
  id: number;
  etiqueta: string;
  piezas: number;
};

export type PuntoModalData = {
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
  estado?: string;
  notas: string | null;
  tipo_ubicacion?: TipoUbicacion;
  radio_metros?: number | null;
  geometria?: GeometriaZona | null;
};

const entrada = CAMPO;
const areaTexto =
  "rounded-lg border border-borde-campo bg-fondo-superficie px-esp3 py-esp2 text-base text-texto-primario outline-none focus:border-borde-foco md:text-sm";

function Etiqueta({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-texto-secundario">{texto}</span>
      {children}
    </label>
  );
}

/**
 * Formulario interno de detalles de un punto. Compartido entre el wizard de documentos
 * y la ficha de campaña para mantener exactamente la misma UX en ambos sitios.
 */
function FormularioDetallesPunto({
  formId,
  punto,
  articulos,
  puntos,
  permitirSoporteLibre,
  error,
  onLimpiarError,
  onGuardar,
}: {
  formId: string;
  punto: PuntoModalData;
  articulos: ArticuloModalData[];
  puntos: Pick<PuntoModalData, "id" | "linea_id" | "piezas">[];
  permitirSoporteLibre: boolean;
  error: string | null;
  onLimpiarError: () => void;
  onGuardar: (datos: {
    tipoSoporte: string;
    lineaId: number | null;
    piezas: number | null;
    direccion: string;
    fecha_colocacion_prevista: string;
    fecha_retirada_prevista: string;
    notas: string;
    radioMetros: number | null;
  }) => void;
}) {
  const [tipoSoporte, setTipoSoporte] = useState(punto.tipo_soporte || "cartel");
  const [lineaId, setLineaId] = useState<string>(
    punto.linea_id != null && articulos.some((a) => a.id === punto.linea_id)
      ? String(punto.linea_id)
      : articulos.length === 1
        ? String(articulos[0]!.id)
        : "",
  );
  const [piezas, setPiezas] = useState(punto.piezas != null ? String(punto.piezas).replace(".", ",") : "");
  const [direccion, setDireccion] = useState(punto.direccion ?? "");
  const [colocacion, setColocacion] = useState(punto.fecha_colocacion_prevista ?? "");
  const [retirada, setRetirada] = useState(punto.fecha_retirada_prevista ?? "");
  const [notas, setNotas] = useState(punto.notas ?? "");
  const [radioMetros, setRadioMetros] = useState<number>(punto.radio_metros ?? RADIO_DEFECTO_METROS);
  const esZonaRadio = punto.tipo_ubicacion === "radio";

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
      tipoSoporte,
      lineaId: lineaId ? Number(lineaId) : null,
      piezas: nPiezas,
      direccion,
      fecha_colocacion_prevista: colocacion,
      fecha_retirada_prevista: retirada,
      notas,
      radioMetros: esZonaRadio ? radioMetros : null,
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
                  {a.etiqueta}
                </option>
              ))}
            </select>
          </Etiqueta>
          <Etiqueta texto="Unidades de este punto">
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
      ) : permitirSoporteLibre ? (
        <div className="grid grid-cols-2 gap-esp2 sm:gap-esp3">
          <Etiqueta texto="Soporte">
            <select value={tipoSoporte} onChange={(e) => setTipoSoporte(e.target.value)} className={entrada}>
              {Object.entries(ETIQUETA_SOPORTE).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </Etiqueta>
          <Etiqueta texto="Unidades">
            <input value={piezas} onChange={(e) => setPiezas(e.target.value)} inputMode="decimal" className={entrada} />
          </Etiqueta>
        </div>
      ) : (
        <p className="rounded-md bg-fondo-aviso-sutil px-esp3 py-esp2 text-xs text-texto-primario">
          Este documento no tiene artículos instalables. Añádelos en el paso 2 para poder asignarlos a los puntos.
        </p>
      )}
      {esZonaRadio && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-texto-secundario">Radio de la zona</span>
          <div className="grid grid-cols-4 gap-esp2" role="group" aria-label="Radio de la zona">
            {RADIOS_ZONA.map((m) => {
              const activo = radioMetros === m;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => setRadioMetros(m)}
                  className={`inline-flex min-h-10 items-center justify-center rounded-lg border text-xs font-semibold transition-colors ${
                    activo
                      ? "border-borde-marca bg-fondo-marca-sutil text-texto-marca"
                      : "border-borde-default bg-fondo-superficie text-texto-secundario hover:bg-fondo-sutil hover:text-texto-primario"
                  }`}
                >
                  {formatoRadio(m)}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <Etiqueta texto={punto.tipo_ubicacion === "poligono" || esZonaRadio ? "Zona / dirección" : "Dirección"}>
        <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={entrada} />
      </Etiqueta>
      <div className="grid grid-cols-2 gap-esp2">
        <Etiqueta texto="Colocar el">
          <SelectorFecha
            value={colocacion}
            onChange={(v) => {
              setColocacion(v);
              if (retirada && v && retirada < v) setRetirada("");
            }}
          />
        </Etiqueta>
        <Etiqueta texto="Retirar el">
          <SelectorFecha value={retirada} min={colocacion || undefined} onChange={setRetirada} />
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

/**
 * Modal de edición/eliminación de detalles de un punto con cabecera y pie fijos (3 zonas).
 */
export function ModalDetallesPunto({
  punto,
  articulos,
  puntos,
  permitirSoporteLibre = false,
  onGuardar,
  onEliminar,
  onCerrar,
}: {
  punto: PuntoModalData;
  articulos: ArticuloModalData[];
  puntos: Pick<PuntoModalData, "id" | "linea_id" | "piezas">[];
  permitirSoporteLibre?: boolean;
  onGuardar: (datos: {
    tipoSoporte: string;
    lineaId: number | null;
    piezas: number | null;
    direccion: string;
    fecha_colocacion_prevista: string;
    fecha_retirada_prevista: string;
    notas: string;
    radioMetros: number | null;
  }) => Promise<void>;
  onEliminar?: () => Promise<void>;
  onCerrar: () => void;
}) {
  const { pendiente, error, setError, ejecutar } = useAccion({ refrescar: true });
  const [montado, setMontado] = useState(false);
  const formId = "form-detalles-punto";
  const nombre = nombreVisiblePunto(punto.nombre);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.querySelector('[role="alertdialog"], [data-selector-fecha]')) return;
        onCerrar();
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  if (!montado) return null;

  async function manejarEliminar() {
    if (!onEliminar) return;
    if (!(await confirmar(`¿Eliminar el punto «${nombre}»?`))) return;
    ejecutar(async () => {
      await onEliminar();
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
      <div ref={atraparFoco}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-punto"
        className="animate-hoja-subir sm:animate-modal-entrar relative flex h-[100dvh] w-full flex-col overflow-hidden bg-fondo-superficie shadow-elevado sm:h-auto sm:max-h-[90dvh] sm:max-w-xl sm:rounded-xl sm:border sm:border-borde-default"
      >
        <div className="flex shrink-0 items-center justify-between gap-esp3 border-b border-borde-default px-esp4 py-esp3 pt-[max(theme(spacing.esp3),env(safe-area-inset-top))] sm:px-esp6 sm:py-esp4">
          <div className="flex min-w-0 items-center gap-esp2">
            <h3 id="titulo-modal-punto" className="min-w-0 truncate text-titulo-panel text-texto-primario">
              {nombre}
            </h3>
            {etiquetaTipoUbicacion(punto.tipo_ubicacion, punto.radio_metros, punto.direccion) && (
              <span className="shrink-0 rounded bg-fondo-marca-sutil px-2 py-0.5 text-xs font-medium text-texto-marca">
                {etiquetaTipoUbicacion(punto.tipo_ubicacion, punto.radio_metros, punto.direccion)}
              </span>
            )}
          </div>
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
            permitirSoporteLibre={permitirSoporteLibre}
            error={error}
            onLimpiarError={() => setError(null)}
            onGuardar={(datos) => {
              ejecutar(async () => {
                await onGuardar(datos);
                onCerrar();
              });
            }}
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-esp2 border-t border-borde-default bg-fondo-superficie px-esp4 py-esp3 pb-[max(theme(spacing.esp3),env(safe-area-inset-bottom))] sm:px-esp6 sm:py-esp4">
          {onEliminar && (
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
