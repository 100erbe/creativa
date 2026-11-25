"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { avisar, confirmar } from "@/components/ui/dialogos";
import { cn } from "@/lib/cn";
import {
  formatearDistancia,
  ordenarPuntosParaFoto,
  UMBRAL_AUTO_SELECCION_METROS,
  type PuntoActivoAgenda,
} from "@/lib/distancia";
import { leerExifFoto } from "@/lib/exif-foto";
import type { OrigenFoto, OrigenUbicacion } from "@/lib/foto-metadatos";
import { subirOEncolarFotoPunto } from "@/lib/subir-foto-punto";
import { mensajeSinUbicacion, obtenerUbicacion, type ResultadoUbicacion } from "@/lib/ubicacion";
import { desenvolver } from "@/lib/accion";
import { marcarPuntoInstalado, marcarPuntoRetirado } from "@/app/(empleado)/app/punto/[id]/acciones";
import { atraparFoco } from "@/lib/trampa-foco";

export type CapturaFoto = {
  archivo: File;
  origenFoto: OrigenFoto;
  promesaUbicacion: Promise<ResultadoUbicacion> | null;
};

type EstadoCompletado = {
  puntoId: number;
  puntoNombre: string;
  estadoTexto: string;
  offline: boolean;
};

/**
 * Panel post-captura («Haz la foto primero, asigna en 1 toque»):
 * muestra la foto recién tomada, sugiere automáticamente el punto más cercano por GPS/EXIF
 * y permite subir la foto (u offline) con opción de marcar el punto como instalado/retirado.
 */
export function ModalFotoRapida({
  captura,
  puntosActivos,
  incluirUbicacion,
  onCambiarIncluirUbicacion,
  onRepetirCamara,
  onElegirGaleria,
  onCerrar,
}: {
  captura: CapturaFoto | null;
  puntosActivos: PuntoActivoAgenda[];
  incluirUbicacion: boolean;
  onCambiarIncluirUbicacion: (valor: boolean) => void;
  onRepetirCamara: () => void;
  onElegirGaleria: () => void;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [gpsEstado, setGpsEstado] = useState<"buscando" | "ok" | "sin_gps">("buscando");
  const [ubicacionFoto, setUbicacionFoto] = useState<{
    latitud: number;
    longitud: number;
    origen: OrigenUbicacion;
  } | null>(null);
  const [coordsOrden, setCoordsOrden] = useState<{ lat: number; lng: number } | null>(null);
  const [resultadoGps, setResultadoGps] = useState<ResultadoUbicacion | null>(null);
  const [tomadaEn, setTomadaEn] = useState<string | undefined>(undefined);

  const [busqueda, setBusqueda] = useState("");
  const [campanaFiltro, setCampanaFiltro] = useState("");
  const [puntoSeleccionadoId, setPuntoSeleccionadoId] = useState<number | null>(null);
  const seleccionManualRef = useRef(false);

  const [marcarCerrado, setMarcarCerrado] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [completado, setCompletado] = useState<EstadoCompletado | null>(null);

  // Preview de la foto recién capturada
  useEffect(() => {
    if (!captura) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(captura.archivo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [captura]);

  // Cierre con Escape (mientras no esté subiendo)
  useEffect(() => {
    if (!captura) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !subiendo) onCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [captura, subiendo, onCerrar]);

  // Al recibir nueva captura: reiniciar estado y resolver GPS / EXIF
  useEffect(() => {
    if (!captura) return;
    let vigente = true;

    setBusqueda("");
    setCampanaFiltro("");
    setPuntoSeleccionadoId(null);
    seleccionManualRef.current = false;
    setMarcarCerrado(false);
    setSubiendo(false);
    setCompletado(null);
    setUbicacionFoto(null);
    setCoordsOrden(null);
    setResultadoGps(null);
    setTomadaEn(undefined);

    async function resolverMetadatos() {
      if (!captura) return;

      if (captura.origenFoto === "camara") {
        if (!captura.promesaUbicacion) {
          if (vigente) setGpsEstado("sin_gps");
          return;
        }
        setGpsEstado("buscando");
        let res = await captura.promesaUbicacion;
        if (!res.posicion && res.motivo !== "denegado") {
          res = await obtenerUbicacion();
        }
        if (!vigente) return;
        setResultadoGps(res);
        if (res.posicion) {
          const lat = res.posicion.coords.latitude;
          const lng = res.posicion.coords.longitude;
          setUbicacionFoto({ latitud: lat, longitud: lng, origen: "gps_camara" });
          setCoordsOrden({ lat, lng });
          setGpsEstado("ok");
        } else {
          setGpsEstado("sin_gps");
        }
        return;
      }

      // Galería: leer EXIF antes de comprimir
      setGpsEstado("buscando");
      const exif = await leerExifFoto(captura.archivo);
      if (!vigente) return;
      if (exif.fecha) setTomadaEn(exif.fecha.toISOString());

      if (exif.latitud !== null && exif.longitud !== null) {
        setCoordsOrden({ lat: exif.latitud, lng: exif.longitud });
        setUbicacionFoto({ latitud: exif.latitud, longitud: exif.longitud, origen: "exif" });
        setGpsEstado("ok");
        return;
      }

      if (captura.promesaUbicacion) {
        const res = await captura.promesaUbicacion;
        if (!vigente) return;
        setResultadoGps(res);
        if (res.posicion) {
          const lat = res.posicion.coords.latitude;
          const lng = res.posicion.coords.longitude;
          setCoordsOrden({ lat, lng });
          setUbicacionFoto({ latitud: lat, longitud: lng, origen: "gps_al_subir" });
          setGpsEstado("ok");
          return;
        }
      }
      if (vigente) setGpsEstado("sin_gps");
    }

    void resolverMetadatos();
    return () => {
      vigente = false;
    };
  }, [captura]);

  const campanas = useMemo(
    () => Array.from(new Set(puntosActivos.map((p) => p.campana))),
    [puntosActivos],
  );

  const { lista: puntosOrdenados, puntoSugeridoId } = useMemo(
    () => ordenarPuntosParaFoto(puntosActivos, coordsOrden),
    [puntosActivos, coordsOrden],
  );

  // Auto-selección del punto sugerido si la persona aún no ha tocado otro manualmente
  useEffect(() => {
    if (!captura || seleccionManualRef.current) return;
    if (puntoSugeridoId != null) {
      setPuntoSeleccionadoId(puntoSugeridoId);
    }
  }, [captura, puntoSugeridoId]);

  const puntosVisibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return puntosOrdenados.filter((p) => {
      if (campanaFiltro && p.campana !== campanaFiltro) return false;
      if (!q) return true;
      return (
        p.punto.toLowerCase().includes(q) ||
        p.campana.toLowerCase().includes(q) ||
        (p.direccion?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [puntosOrdenados, campanaFiltro, busqueda]);

  const seleccionado = useMemo(
    () => puntosOrdenados.find((p) => p.puntoId === puntoSeleccionadoId) ?? null,
    [puntosOrdenados, puntoSeleccionadoId],
  );

  if (!captura) return null;

  const esRetirada = seleccionado?.rolAsignacion === "retirador";

  async function guardar() {
    if (!captura || !seleccionado || subiendo) return;

    let ubicacionFinal = incluirUbicacion ? ubicacionFoto : null;

    if (incluirUbicacion && !ubicacionFinal) {
      if (captura.origenFoto === "camara") {
        let res = resultadoGps;
        if (!res) {
          res = await obtenerUbicacion();
          setResultadoGps(res);
          if (res.posicion) {
            ubicacionFinal = {
              latitud: res.posicion.coords.latitude,
              longitud: res.posicion.coords.longitude,
              origen: "gps_camara",
            };
          }
        }
        if (!ubicacionFinal) {
          const seguir = await confirmar(
            `${mensajeSinUbicacion(res?.motivo)}\n\n¿Subir la foto igualmente, sin ubicación? (El cliente no podrá ver dónde se hizo.)`,
          );
          if (!seguir) return;
        }
      } else {
        const usarActual = await confirmar(
          "Esta foto no incluye ubicación (algunos móviles la quitan al elegir de la galería).\n\n" +
            "Aceptar: usar tu ubicación ACTUAL.\n" +
            "Cancelar: subirla sin ubicación.",
        );
        if (usarActual) {
          const r = await obtenerUbicacion();
          if (r.posicion) {
            ubicacionFinal = {
              latitud: r.posicion.coords.latitude,
              longitud: r.posicion.coords.longitude,
              origen: "gps_al_subir",
            };
          } else if (!(await confirmar(`${mensajeSinUbicacion(r.motivo)}\n\n¿Subirla igualmente, sin ubicación?`))) {
            return;
          }
        }
      }
    }

    setSubiendo(true);
    try {
      const resSubida = await subirOEncolarFotoPunto(
        seleccionado.puntoId,
        seleccionado.asignacionId,
        captura.archivo,
        {
          origenFoto: captura.origenFoto,
          ubicacion: ubicacionFinal,
          tomadaEn,
        },
      );

      if (resSubida === "encolada") {
        setCompletado({
          puntoId: seleccionado.puntoId,
          puntoNombre: seleccionado.punto,
          offline: true,
          estadoTexto: marcarCerrado
            ? "Sin conexión: foto guardada en el móvil. Se enviará al recuperar cobertura (el punto no se ha cerrado todavía)."
            : "Sin conexión: foto guardada en el móvil y se enviará sola cuando haya cobertura.",
        });
        return;
      }

      if (marcarCerrado) {
        if (seleccionado.rolAsignacion === "retirador") {
          await desenvolver(marcarPuntoRetirado(seleccionado.puntoId, seleccionado.asignacionId));
        } else {
          await desenvolver(marcarPuntoInstalado(seleccionado.puntoId, seleccionado.asignacionId));
        }
      }

      router.refresh();
      setCompletado({
        puntoId: seleccionado.puntoId,
        puntoNombre: seleccionado.punto,
        offline: false,
        estadoTexto: marcarCerrado
          ? seleccionado.rolAsignacion === "retirador"
            ? "Foto subida y punto marcado como retirado."
            : "Foto subida y punto marcado como instalado."
          : "Foto guardada en el punto.",
      });
    } catch (err) {
      void avisar(err instanceof Error ? err.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
    }
  }

  return createPortal(
    <div ref={atraparFoco}
      className="fixed inset-0 z-[3000] flex items-end justify-center sm:items-center sm:p-esp4"
      role="dialog"
      aria-modal="true"
      aria-label="Asignar foto"
    >
      <button
        type="button"
        aria-label="Cerrar"
        disabled={subiendo}
        onClick={onCerrar}
        className="animate-velo-entrar fixed inset-0 bg-fondo-velo"
      />
      <div className="animate-hoja-subir sm:animate-modal-entrar relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-xl border border-borde-default bg-fondo-superficie shadow-elevado sm:max-w-md sm:rounded-xl">
        {/* Cabecera */}
        <div className="flex items-center border-b border-borde-default px-esp4 py-esp3">
          <h2 className="flex-1 text-titulo-panel text-texto-primario">
            {completado ? "Foto lista" : "Asignar foto"}
          </h2>
          <button
            type="button"
            disabled={subiendo}
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press disabled:opacity-50"
          >
            <Icono nombre="cerrar" size={20} />
          </button>
        </div>

        {completado ? (
          <div className="flex flex-col gap-esp4 p-esp4">
            <div
              className={cn(
                "flex items-start gap-esp3 rounded-lg border px-esp3 py-esp3 text-sm",
                completado.offline
                  ? "border-borde-aviso-sutil bg-fondo-aviso-sutil text-texto-aviso"
                  : "border-borde-default bg-fondo-exito-sutil text-texto-exito",
              )}
            >
              <Icono nombre={completado.offline ? "reloj" : "check"} size={20} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-texto-primario">{completado.puntoNombre}</p>
                <p className="mt-0.5 text-etiqueta">{completado.estadoTexto}</p>
              </div>
            </div>

            <div className="flex flex-col gap-esp2 sm:flex-row">
              <Boton type="button" variante="secundario" className="flex-1" onClick={onRepetirCamara}>
                <Icono nombre="camara" size={16} />
                Hacer otra foto
              </Boton>
              <Link
                href={`/app/punto/${completado.puntoId}`}
                onClick={onCerrar}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-borde-default bg-fondo-superficie px-esp4 text-etiqueta text-texto-primario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press md:min-h-[42px]"
              >
                Ver punto
              </Link>
              <Boton type="button" className="flex-1" onClick={onCerrar}>
                Listo
              </Boton>
            </div>
          </div>
        ) : (
          <>
            {/* Contenido desplazable */}
            <div className="flex min-h-0 flex-1 flex-col gap-esp4 overflow-y-auto p-esp4">
              {/* Vista previa de la foto + acciones rápidas */}
              <div className="flex items-center gap-esp3 rounded-lg border border-borde-default bg-fondo-sutil p-esp2">
                {previewUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={previewUrl}
                    alt="Vista previa de la foto capturada"
                    className="h-16 w-16 shrink-0 rounded-md border border-borde-default object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-etiqueta font-medium text-texto-primario">
                    {captura.origenFoto === "camara" ? "Foto de cámara" : "Foto de galería"}
                  </p>
                  <p className="mt-0.5 text-micro text-texto-secundario">
                    {!incluirUbicacion
                      ? "Ubicación desactivada"
                      : gpsEstado === "buscando"
                        ? "Obteniendo ubicación…"
                        : gpsEstado === "ok"
                          ? ubicacionFoto?.origen === "exif"
                            ? "Ubicación leída de la foto"
                            : "Ubicación GPS lista"
                          : "Sin señal GPS"}
                  </p>
                  <div className="mt-esp2 flex flex-wrap gap-esp2">
                    <button
                      type="button"
                      disabled={subiendo}
                      onClick={onRepetirCamara}
                      className="text-micro font-semibold text-texto-marca hover:underline disabled:opacity-50"
                    >
                      Repetir
                    </button>
                    <span className="text-micro text-texto-terciario">·</span>
                    <button
                      type="button"
                      disabled={subiendo}
                      onClick={onElegirGaleria}
                      className="text-micro font-semibold text-texto-secundario hover:text-texto-primario disabled:opacity-50"
                    >
                      Elegir de la galería
                    </button>
                  </div>
                </div>
              </div>

              {/* Selección del punto */}
              <div className="flex flex-col gap-esp2">
                <p className="text-etiqueta font-medium text-texto-primario">¿A qué punto corresponde?</p>

                {puntosActivos.length > 3 && (
                  <div className="relative">
                    <Icono
                      nombre="buscar"
                      size={16}
                      className="pointer-events-none absolute left-esp3 top-1/2 -translate-y-1/2 text-icono-secundario"
                    />
                    <input
                      type="search"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar punto, campaña o dirección…"
                      aria-label="Buscar punto o campaña"
                      className="h-11 w-full rounded-lg border border-borde-campo bg-fondo-superficie pl-9 pr-esp3 text-sm text-texto-primario placeholder:text-texto-terciario md:h-10"
                    />
                  </div>
                )}

                {campanas.length >= 2 && (
                  <div className="flex flex-wrap gap-esp1" role="group" aria-label="Filtrar por campaña">
                    <button
                      type="button"
                      onClick={() => setCampanaFiltro("")}
                      className={cn(
                        "min-h-11 md:min-h-8 rounded-completo px-esp3 text-micro font-medium transition-colors duration-rapida ease-suave active:scale-press",
                        !campanaFiltro
                          ? "bg-fondo-marca text-texto-sobre-marca"
                          : "border border-borde-default bg-fondo-superficie text-texto-secundario hover:bg-fondo-sutil",
                      )}
                    >
                      Todas
                    </button>
                    {campanas.map((c) => {
                      const activa = campanaFiltro === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCampanaFiltro(activa ? "" : c)}
                          className={cn(
                            "max-w-[180px] truncate min-h-8 rounded-completo px-esp3 text-micro font-medium transition-colors duration-rapida ease-suave active:scale-press",
                            activa
                              ? "bg-fondo-marca text-texto-sobre-marca"
                              : "border border-borde-default bg-fondo-superficie text-texto-secundario hover:bg-fondo-sutil",
                          )}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex max-h-56 flex-col gap-esp1 overflow-y-auto pr-0.5">
                  {puntosVisibles.map((p) => {
                    const activo = p.puntoId === puntoSeleccionadoId;
                    const esCercano =
                      p.distanciaMetros != null && p.distanciaMetros <= UMBRAL_AUTO_SELECCION_METROS;
                    const retirada = p.rolAsignacion === "retirador";

                    return (
                      <button
                        key={p.asignacionId}
                        type="button"
                        aria-pressed={activo}
                        onClick={() => {
                          seleccionManualRef.current = true;
                          setPuntoSeleccionadoId(p.puntoId);
                        }}
                        className={cn(
                          "flex min-h-[54px] w-full items-center gap-esp3 rounded-lg border px-esp3 py-esp2 text-left transition-colors duration-rapida ease-suave active:scale-press",
                          activo
                            ? "border-borde-foco bg-fondo-marca-sutil/60"
                            : "border-borde-default bg-fondo-superficie hover:bg-fondo-sutil",
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                            activo ? "border-fondo-marca bg-fondo-marca" : "border-borde-campo bg-fondo-superficie",
                          )}
                        >
                          {activo && <span className="h-1.5 w-1.5 rounded-full bg-fondo-superficie" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-texto-primario">{p.punto}</span>
                            <span className="shrink-0 rounded bg-fondo-sutil px-1.5 py-0.5 text-micro font-medium text-texto-secundario">
                              {retirada ? "Retirar" : "Instalar"}
                            </span>
                          </span>
                          <span className="block truncate text-xs text-texto-terciario">
                            {p.campana}
                            {p.direccion ? ` · ${p.direccion}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          {p.distanciaMetros != null ? (
                            <span
                              className={cn(
                                "tabular-nums inline-flex rounded-completo px-2 py-0.5 text-micro font-semibold",
                                esCercano
                                  ? "bg-fondo-exito-sutil text-texto-exito"
                                  : "bg-fondo-sutil text-texto-secundario",
                              )}
                            >
                              {formatearDistancia(p.distanciaMetros)}
                            </span>
                          ) : p.esHoy ? (
                            <span className="inline-flex rounded-completo bg-fondo-marca-sutil px-2 py-0.5 text-micro font-semibold text-texto-marca">
                              Hoy
                            </span>
                          ) : p.esAtrasado ? (
                            <span className="inline-flex rounded-completo bg-fondo-peligro-sutil px-2 py-0.5 text-micro font-semibold text-texto-peligro">
                              Atrasado
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}

                  {puntosVisibles.length === 0 && (
                    <p className="rounded-lg border border-dashed border-borde-default px-esp3 py-esp4 text-center text-xs text-texto-terciario">
                      No hay puntos que coincidan con la búsqueda.
                    </p>
                  )}
                </div>
              </div>

              {/* Opciones rápidas */}
              <div className="flex flex-col gap-esp2 rounded-lg border border-borde-default bg-fondo-sutil/60 px-esp3 py-esp2">
                <label className="flex min-h-9 cursor-pointer items-center gap-esp2 text-xs font-medium text-texto-primario">
                  <input
                    type="checkbox"
                    checked={marcarCerrado}
                    onChange={(e) => setMarcarCerrado(e.target.checked)}
                    disabled={!seleccionado || subiendo}
                    className="h-4 w-4 rounded accent-fondo-marca"
                  />
                  <span>
                    {esRetirada ? "Marcar también como retirado" : "Marcar también como instalado"}
                  </span>
                </label>

                <label className="flex min-h-9 cursor-pointer items-center gap-esp2 text-xs text-texto-secundario">
                  <input
                    type="checkbox"
                    checked={incluirUbicacion}
                    onChange={(e) => onCambiarIncluirUbicacion(e.target.checked)}
                    disabled={subiendo}
                    className="h-4 w-4 rounded accent-fondo-marca"
                  />
                  <span>Incluir ubicación GPS en la foto</span>
                </label>
              </div>
            </div>

            {/* Pie fijo */}
            <div className="border-t border-borde-default bg-fondo-superficie px-esp4 py-esp3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Boton
                type="button"
                cargando={subiendo}
                disabled={!seleccionado || subiendo}
                onClick={guardar}
                className="w-full"
              >
                {subiendo
                  ? "Guardando…"
                  : marcarCerrado
                    ? esRetirada
                      ? "Guardar y marcar retirado"
                      : "Guardar y marcar instalado"
                    : "Guardar foto"}
              </Boton>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
