"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { Icono } from "@/components/ui/iconos";
import { MapaPuntos } from "@/components/mapa/mapa-puntos";
import { SafeMapContainer } from "@/components/shared/SafeMapContainer";
import { ALTURA_MAPA_FICHA } from "@/components/mapa/config-mapa";
import { ETIQUETA_SOPORTE, etiquetaEstado } from "@/lib/etiquetas";
import { fechaMedia } from "@/lib/formato";
import { comprimirImagen } from "@/lib/comprimir-imagen";
import { encolarFoto, esErrorDeRed } from "@/lib/cola-fotos";
import { leerExifFoto } from "@/lib/exif-foto";
import type { OrigenFoto, OrigenUbicacion } from "@/lib/foto-metadatos";
import { mensajeSinUbicacion, obtenerUbicacion, type ResultadoUbicacion } from "@/lib/ubicacion";
import {
  subirFotoPunto,
  eliminarFotoPunto,
  marcarPuntoInstalado,
  marcarPuntoRetirado,
  reabrirPunto,
  reportarIncidencia,
  type EstadosAnteriores,
} from "./acciones";
import { desenvolver } from "@/lib/accion";
import { avisar, confirmar } from "@/components/ui/dialogos";

const MAX_FOTOS_GALERIA = 10;
const SEGUNDOS_DESHACER = 8;
const CLAVE_UBICACION = "creativa.incluirUbicacion";

type Punto = {
  id: number;
  nombre: string;
  tipo_soporte: string;
  direccion: string | null;
  latitud: number;
  longitud: number;
  estado: string;
  notas: string | null;
  incidencia: string | null;
  piezas: number | null;
  fecha_colocacion_prevista: string | null;
  fecha_retirada_prevista: string | null;
  campanas: { nombre: string; descripcion: string | null } | { nombre: string; descripcion: string | null }[] | null;
};

type Foto = {
  id: number;
  tipo: string;
  url: string | null;
  tomada_en: string;
  usuario_id: string | null;
  latitud: number | null;
  longitud: number | null;
  origen_foto: string;
  origen_ubicacion: string | null;
};

type DatosFoto = {
  origenFoto: OrigenFoto;
  ubicacion: { latitud: number; longitud: number; origen: OrigenUbicacion } | null;
  tomadaEn?: string;
};

function etiquetaUbicacion(f: Foto): { texto: string; ayuda: string } {
  switch (f.origen_ubicacion) {
    case "gps_camara":
      return { texto: "📍 GPS", ayuda: "Ubicación del GPS al hacer la foto" };
    case "exif":
      return { texto: "📍 Foto", ayuda: "Ubicación guardada dentro de la propia foto" };
    case "gps_al_subir":
      return { texto: "📍 Al subir", ayuda: "Ubicación del móvil al subir la foto (pudo hacerse antes)" };
    default:
      return { texto: "Sin ubicación", ayuda: "Esta foto no lleva ubicación" };
  }
}

export function PanelPunto({
  punto,
  asignacion,
  fotos,
  usuarioId,
  esAdmin,
}: {
  punto: Punto;
  asignacion: { id: number; estado: string; rol_asignacion: string } | null;
  fotos: Foto[];
  usuarioId: string | null;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const inputCamaraRef = useRef<HTMLInputElement>(null);
  const inputGaleriaRef = useRef<HTMLInputElement>(null);
  const ubicacionRef = useRef<{ promesa: Promise<ResultadoUbicacion>; en: number } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [mostrarIncidencia, setMostrarIncidencia] = useState(false);
  const [notaIncidencia, setNotaIncidencia] = useState("");
  const [eliminando, setEliminando] = useState<number | null>(null);

  // Añadir fotos
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [incluirUbicacion, setIncluirUbicacion] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState<{ hecho: number; total: number } | null>(null);
  const [aviso, setAviso] = useState<{ tono: "ok" | "aviso"; texto: string } | null>(null);

  // Deshacer "marcar como instalado"
  const [deshacer, setDeshacer] = useState<{ anteriores: EstadosAnteriores; restantes: number } | null>(null);

  const campana = Array.isArray(punto.campanas) ? punto.campanas[0] : punto.campanas;

  // Se recuerda la última elección de ubicación en este móvil (si el navegador lo permite).
  useEffect(() => {
    try {
      if (localStorage.getItem(CLAVE_UBICACION) === "no") setIncluirUbicacion(false);
    } catch {
      /* sin almacenamiento: se queda en "sí" */
    }
  }, []);

  function cambiarIncluirUbicacion(valor: boolean) {
    setIncluirUbicacion(valor);
    try {
      localStorage.setItem(CLAVE_UBICACION, valor ? "si" : "no");
    } catch {
      /* ignorar */
    }
  }

  // Cuenta atrás del aviso "Deshacer".
  useEffect(() => {
    if (!deshacer) return;
    if (deshacer.restantes <= 0) {
      setDeshacer(null);
      return;
    }
    const t = setTimeout(
      () => setDeshacer((d) => (d ? { ...d, restantes: d.restantes - 1 } : d)),
      1000,
    );
    return () => clearTimeout(t);
  }, [deshacer]);

  /**
   * Comprime y sube una foto con sus metadatos. Sin cobertura la guarda en el móvil para enviarla
   * sola más tarde ("encolada"); cualquier otro fallo se lanza como error.
   */
  async function subirUna(archivo: File, datos: DatosFoto): Promise<"subida" | "encolada"> {
    const comprimida = await comprimirImagen(archivo);
    const formData = new FormData();
    formData.set("archivo", comprimida);
    formData.set("puntoId", String(punto.id));
    if (asignacion) formData.set("asignacionId", String(asignacion.id));
    formData.set("tipo", "instalacion");
    formData.set("origenFoto", datos.origenFoto);
    if (datos.ubicacion) {
      formData.set("latitud", String(datos.ubicacion.latitud));
      formData.set("longitud", String(datos.ubicacion.longitud));
      formData.set("origenUbicacion", datos.ubicacion.origen);
    }
    if (datos.tomadaEn) formData.set("tomadaEn", datos.tomadaEn);
    try {
      await desenvolver(subirFotoPunto(formData));
      return "subida";
    } catch (e) {
      if (esErrorDeRed(e)) {
        const campos: Record<string, string> = {};
        formData.forEach((valor, clave) => {
          if (typeof valor === "string") campos[clave] = valor;
        });
        const guardada = await encolarFoto({
          puntoId: punto.id,
          nombre: comprimida.name || "foto.webp",
          archivo: comprimida,
          campos,
        });
        if (guardada) return "encolada";
      }
      throw e;
    }
  }

  // ── Cámara ────────────────────────────────────────────────────────────────
  // La ubicación se pide al tocar el botón (dentro del gesto del usuario y antes de que la
  // cámara tome el control); al volver de la cámara ya suele estar resuelta.
  function hacerFoto() {
    ubicacionRef.current = incluirUbicacion ? { promesa: obtenerUbicacion(), en: Date.now() } : null;
    inputCamaraRef.current?.click();
  }

  async function onFotoCamara(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir la misma foto
    if (!archivo) return;
    setSubiendo(true);
    setAviso(null);

    try {
      let ubicacion: DatosFoto["ubicacion"] = null;

      if (incluirUbicacion) {
        const pedido = ubicacionRef.current;
        ubicacionRef.current = null;
        const reciente = pedido && Date.now() - pedido.en < 2 * 60 * 1000;
        let resultado = await (reciente ? pedido.promesa : obtenerUbicacion());
        // Si falló (no por permisos), se reintenta ahora que la cámara ya se cerró.
        if (!resultado.posicion && resultado.motivo !== "denegado") resultado = await obtenerUbicacion();

        if (resultado.posicion) {
          ubicacion = {
            latitud: resultado.posicion.coords.latitude,
            longitud: resultado.posicion.coords.longitude,
            origen: "gps_camara",
          };
        } else {
          const seguir = await confirmar(
            `${mensajeSinUbicacion(resultado.motivo)}\n\n¿Subir la foto igualmente, sin ubicación? (El cliente no podrá ver dónde se hizo.)`,
          );
          if (!seguir) return;
        }
      }

      const resultado = await subirUna(archivo, { origenFoto: "camara", ubicacion });
      if (resultado === "encolada") {
        setAviso({ tono: "aviso", texto: "Sin conexión: la foto está guardada en el móvil y se enviará sola cuando haya cobertura." });
        return;
      }
      setAviso(
        ubicacion || !incluirUbicacion
          ? { tono: "ok", texto: "Foto subida." }
          : { tono: "aviso", texto: "Foto subida sin ubicación." },
      );
      router.refresh();
    } catch (err) {
      void avisar(err instanceof Error ? err.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
    }
  }

  // ── Galería ───────────────────────────────────────────────────────────────
  async function onFotosGaleria(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []).slice(0, MAX_FOTOS_GALERIA);
    e.target.value = "";
    if (archivos.length === 0) return;
    setSubiendo(true);
    setAviso(null);

    try {
      // El EXIF se lee antes de comprimir (la compresión lo elimina). Aunque no se quiera
      // ubicación, la fecha en que se hizo la foto sigue siendo útil.
      const exifs = await Promise.all(archivos.map(leerExifFoto));

      let actual: { latitud: number; longitud: number } | null = null;
      const sinGps = incluirUbicacion ? exifs.filter((x) => x.latitud === null).length : 0;
      if (sinGps > 0) {
        const usarActual = await confirmar(
          `${sinGps === 1 ? "Esta foto no incluye ubicación" : `${sinGps} fotos no incluyen ubicación`} (algunos móviles la quitan al elegir de la galería).\n\n` +
            "Aceptar: usar tu ubicación ACTUAL. El cliente verá que es la ubicación del momento de subirla, no necesariamente la de donde se hizo.\n" +
            "Cancelar: subirla sin ubicación.",
        );
        if (usarActual) {
          const r = await obtenerUbicacion();
          if (r.posicion) {
            actual = { latitud: r.posicion.coords.latitude, longitud: r.posicion.coords.longitude };
          } else if (!(await confirmar(`${mensajeSinUbicacion(r.motivo)}\n\n¿Subirla igualmente, sin ubicación?`))) {
            return;
          }
        }
      }

      let subidas = 0;
      let encoladas = 0;
      let sinUbicacion = 0;
      const fallos: string[] = [];

      for (const [i, archivo] of archivos.entries()) {
        setProgreso({ hecho: i, total: archivos.length });
        const exif = exifs[i] ?? { latitud: null, longitud: null, fecha: null };
        let ubicacion: DatosFoto["ubicacion"] = null;
        if (incluirUbicacion && exif.latitud !== null && exif.longitud !== null) {
          ubicacion = { latitud: exif.latitud, longitud: exif.longitud, origen: "exif" };
        } else if (incluirUbicacion && actual) {
          ubicacion = { ...actual, origen: "gps_al_subir" };
        }

        try {
          const resultado = await subirUna(archivo, {
            origenFoto: "galeria",
            ubicacion,
            tomadaEn: exif.fecha?.toISOString(),
          });
          if (resultado === "encolada") encoladas++;
          else subidas++;
          if (!ubicacion) sinUbicacion++;
        } catch (err) {
          fallos.push(`${archivo.name}: ${err instanceof Error ? err.message : "error"}`);
        }
      }

      const partes = [`${subidas} foto${subidas === 1 ? "" : "s"} subida${subidas === 1 ? "" : "s"}`];
      if (encoladas > 0) partes.push(`${encoladas} guardada${encoladas === 1 ? "" : "s"} en el móvil (sin conexión)`);
      if (incluirUbicacion && sinUbicacion > 0) partes.push(`${sinUbicacion} sin ubicación`);
      if (fallos.length > 0) partes.push(`${fallos.length} con error`);
      setAviso({ tono: fallos.length > 0 || encoladas > 0 || (incluirUbicacion && sinUbicacion > 0) ? "aviso" : "ok", texto: partes.join(" · ") + "." });
      if (fallos.length > 0) void avisar(`No se pudieron subir:\n${fallos.join("\n")}`);
      if (subidas > 0) router.refresh();
    } catch (err) {
      void avisar(err instanceof Error ? err.message : "No se pudieron subir las fotos.");
    } finally {
      setProgreso(null);
      setSubiendo(false);
    }
  }

  async function eliminarFoto(fotoId: number) {
    if (!(await confirmar("¿Eliminar esta foto?"))) return;
    setEliminando(fotoId);
    try {
      await desenvolver(eliminarFotoPunto(fotoId, punto.id));
      router.refresh();
    } catch (err) {
      void avisar(err instanceof Error ? err.message : "No se pudo eliminar la foto.");
    } finally {
      setEliminando(null);
    }
  }

  // ── Instalado / deshacer ──────────────────────────────────────────────────
  function completar() {
    if (!asignacion) return;
    iniciar(async () => {
      try {
        const anteriores = await desenvolver(marcarPuntoInstalado(punto.id, asignacion.id));
        setDeshacer({ anteriores, restantes: SEGUNDOS_DESHACER });
        router.refresh();
      } catch (err) {
        void avisar(err instanceof Error ? err.message : "No se pudo marcar el punto.");
      }
    });
  }

  function deshacerAhora() {
    if (!asignacion || !deshacer) return;
    const anteriores = deshacer.anteriores;
    setDeshacer(null);
    iniciar(async () => {
      try {
        await desenvolver(reabrirPunto(punto.id, asignacion.id, anteriores));
        router.refresh();
      } catch (err) {
        void avisar(err instanceof Error ? err.message : "No se pudo deshacer.");
      }
    });
  }

  async function reabrir() {
    if (!asignacion) return;
    if (!(await confirmar("¿Volver a dejar este punto como pendiente? Hazlo solo si lo marcaste como instalado por error."))) return;
    iniciar(async () => {
      try {
        await desenvolver(reabrirPunto(punto.id, asignacion.id));
        setDeshacer(null);
        router.refresh();
      } catch (err) {
        void avisar(err instanceof Error ? err.message : "No se pudo reabrir el punto.");
      }
    });
  }

  async function retirar() {
    if (!asignacion) return;
    if (!(await confirmar("¿Confirmas que el material de este punto ya está retirado?"))) return;
    iniciar(async () => {
      try {
        await desenvolver(marcarPuntoRetirado(punto.id, asignacion.id));
        router.refresh();
      } catch (err) {
        void avisar(err instanceof Error ? err.message : "No se pudo marcar el punto como retirado.");
      }
    });
  }

  function enviarIncidencia() {
    iniciar(async () => {
      try {
        await desenvolver(reportarIncidencia(punto.id, notaIncidencia));
        setMostrarIncidencia(false);
        router.refresh();
      } catch (err) {
        void avisar(err instanceof Error ? err.message : "No se pudo enviar la incidencia.");
      }
    });
  }

  const esRetirada = asignacion?.rol_asignacion === "retirador";
  const instalado = !esRetirada && asignacion?.estado === "completada" && punto.estado === "instalado";
  const retirado = punto.estado === "retirado";
  const verificado = punto.estado === "verificado";

  return (
    <div className="flex flex-col gap-esp5 px-esp4 pt-esp5">
      <div className="flex items-start gap-esp3">
        <Link
          href="/app/agenda"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-icono-secundario"
          aria-label="Volver a mi agenda"
        >
          <Icono nombre="atras" size={22} />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-texto-primario">{punto.nombre}</h1>
          <p className="text-sm text-texto-terciario">
            {ETIQUETA_SOPORTE[punto.tipo_soporte] ?? punto.tipo_soporte} · {campana?.nombre}
          </p>
        </div>
        <Insignia tono={TONO_POR_ESTADO[punto.estado] ?? "neutro"}>{etiquetaEstado(punto.estado)}</Insignia>
      </div>

      <SafeMapContainer
        title={punto.nombre}
        coordinates={{ lat: punto.latitud, lng: punto.longitud }}
        address={punto.direccion}
      >
        <MapaPuntos
          puntos={[
            {
              id: punto.id,
              nombre: punto.nombre,
              latitud: punto.latitud,
              longitud: punto.longitud,
              estado: punto.estado,
            },
          ]}
          altura={ALTURA_MAPA_FICHA}
        />
      </SafeMapContainer>

      {punto.direccion && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${punto.latitud},${punto.longitud}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-esp2 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp3 text-sm text-texto-primario"
        >
          <Icono nombre="ubicacion" size={18} className="text-icono-marca" />
          {punto.direccion}
          <span className="ml-auto text-xs text-texto-terciario">Abrir en Google Maps</span>
        </a>
      )}

      {punto.estado === "incidencia" && punto.incidencia && (
        <div className="rounded-md border border-borde-peligro-sutil bg-fondo-peligro-sutil px-esp4 py-esp3">
          <p className="text-xs font-medium text-texto-peligro">INCIDENCIA REPORTADA</p>
          <p className="text-sm text-texto-primario">{punto.incidencia}</p>
        </div>
      )}

      {/* Qué hay que hacer y cuándo: lo que el administrador dejó escrito al crear el punto. */}
      {(punto.notas || punto.piezas != null || punto.fecha_colocacion_prevista || punto.fecha_retirada_prevista || campana?.descripcion) && (
        <div className="flex flex-col gap-esp2 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-texto-terciario">Trabajo a realizar</h2>
          {punto.notas && <p className="whitespace-pre-line text-sm text-texto-primario">{punto.notas}</p>}
          {(punto.piezas != null || punto.fecha_colocacion_prevista || punto.fecha_retirada_prevista) && (
            <p className="text-xs text-texto-secundario">
              {[
                punto.piezas != null ? `${punto.piezas} ${punto.piezas === 1 ? "pieza" : "piezas"}` : null,
                punto.fecha_colocacion_prevista ? `Colocar el ${fechaMedia(punto.fecha_colocacion_prevista)}` : null,
                punto.fecha_retirada_prevista ? `Retirar el ${fechaMedia(punto.fecha_retirada_prevista)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {campana?.descripcion && (
            <p className="whitespace-pre-line border-t border-fondo-hover pt-esp2 text-xs text-texto-terciario">
              Campaña: {campana.descripcion}
            </p>
          )}
        </div>
      )}

      {/* Fotos */}
      <div className="flex flex-col gap-esp3">
        <div className="flex items-center">
          <h2 className="flex-1 text-sm font-medium text-texto-secundario">Fotos · {fotos.length}</h2>
        </div>
        <div className="grid grid-cols-3 gap-esp2">
          {fotos.map((f) => {
            if (!f.url) return null;
            const ubic = etiquetaUbicacion(f);
            const conUbicacion = f.latitud != null && f.longitud != null;
            return (
              <div key={f.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={f.tipo} className="aspect-square w-full rounded-md object-cover" />
                <span
                  title={ubic.ayuda}
                  className={
                    conUbicacion
                      ? "absolute bottom-1 left-1 rounded-full bg-fondo-velo-fuerte px-1.5 py-0.5 text-micro text-texto-inverso"
                      : "absolute bottom-1 left-1 rounded-full border border-borde-aviso bg-fondo-aviso-sutil px-1.5 py-0.5 text-micro font-medium text-texto-aviso"
                  }
                >
                  {f.origen_foto === "galeria" ? "🖼 " : ""}
                  {ubic.texto}
                </span>
                {(esAdmin || f.usuario_id === usuarioId) && (
                  <button
                    type="button"
                    onClick={() => eliminarFoto(f.id)}
                    disabled={eliminando === f.id}
                    aria-label="Eliminar foto"
                    className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-fondo-velo-fuerte text-sm text-texto-inverso shadow-sm disabled:opacity-50"
                  >
                    {eliminando === f.id ? "…" : "✕"}
                  </button>
                )}
              </div>
            );
          })}
          <button
            onClick={() => setPanelAbierto((v) => !v)}
            disabled={subiendo}
            aria-expanded={panelAbierto}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed border-borde-campo text-texto-terciario disabled:opacity-50"
          >
            <Icono nombre="camara" size={22} />
            <span className="text-xs">
              {progreso ? `Subiendo ${progreso.hecho + 1}/${progreso.total}…` : subiendo ? "Subiendo…" : "Añadir"}
            </span>
          </button>
        </div>

        {panelAbierto && (
          <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie p-esp4">
            <label className="flex items-start gap-esp3">
              <input
                type="checkbox"
                checked={incluirUbicacion}
                onChange={(e) => cambiarIncluirUbicacion(e.target.checked)}
                disabled={subiendo}
                className="mt-0.5 h-5 w-5 shrink-0"
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium text-texto-primario">Incluir la ubicación en la foto</span>
                <span className="text-xs text-texto-terciario">
                  {incluirUbicacion
                    ? "El cliente podrá ver dónde se hizo. En las fotos de la galería se usa la ubicación guardada en la foto, si la tiene."
                    : "La foto se sube sin ubicación y no se guarda ninguna."}
                </span>
              </span>
            </label>
            <div className="flex gap-esp2">
              <Boton className="min-h-12 flex-1" onClick={hacerFoto} disabled={subiendo}>
                <Icono nombre="camara" size={18} />
                Hacer foto
              </Boton>
              <Boton className="min-h-12 flex-1" variante="secundario" onClick={() => inputGaleriaRef.current?.click()} disabled={subiendo}>
                <Icono nombre="imagen" size={18} />
                Galería
              </Boton>
            </div>
            <p className="text-xs text-texto-terciario">
              ¿Olvidaste hacer una foto desde la app? Elige hasta {MAX_FOTOS_GALERIA} de la galería: se guardará la fecha
              en que se hicieron.
            </p>
          </div>
        )}

        {aviso && (
          <p className={aviso.tono === "ok" ? "text-xs text-texto-exito" : "text-xs text-texto-aviso"} role="status">
            {aviso.texto}
          </p>
        )}

        <input
          ref={inputCamaraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFotoCamara}
        />
        <input
          ref={inputGaleriaRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onFotosGaleria}
        />
      </div>

      {/* Acciones */}
      {asignacion && asignacion.estado !== "completada" && esRetirada && (
        <div className="flex flex-col gap-esp2">
          <Boton className="min-h-12 w-full text-base" onClick={retirar} cargando={pendiente}>
            <Icono nombre="check" size={18} />
            Marcar como retirado
          </Boton>
          <p className="text-center text-xs text-texto-terciario">
            Haz una foto del punto ya retirado si el cliente la pide.
          </p>
        </div>
      )}

      {asignacion && asignacion.estado !== "completada" && !esRetirada && (
        <div className="flex flex-col gap-esp2">
          <Boton className="min-h-12 w-full text-base" onClick={completar} cargando={pendiente}>
            <Icono nombre="check" size={18} />
            Marcar como instalado
          </Boton>
          {fotos.length === 0 && (
            <p className="text-center text-xs text-texto-terciario">
              Este punto no tiene fotos. Puedes marcarlo igualmente si el cliente no las requiere.
            </p>
          )}
          <Boton className="min-h-11 w-full" variante="fantasma" onClick={() => setMostrarIncidencia((v) => !v)}>
            <Icono nombre="alerta" size={16} />
            Reportar incidencia
          </Boton>
        </div>
      )}

      {instalado && (
        <div className="flex flex-col gap-esp2 rounded-lg border border-borde-exito bg-fondo-exito-sutil px-esp4 py-esp3">
          <p className="flex items-center gap-esp2 text-sm font-medium text-texto-exito">
            <Icono nombre="check" size={16} />
            Punto marcado como instalado
          </p>
          <Boton variante="fantasma" tamano="s" onClick={reabrir} cargando={pendiente}>
            ¿Marcado por error? Reabrir punto
          </Boton>
        </div>
      )}

      {retirado && (
        <p className="flex items-center gap-esp2 rounded-lg border border-borde-exito bg-fondo-exito-sutil px-esp4 py-esp3 text-sm text-texto-exito">
          <Icono nombre="check" size={16} />
          Punto retirado
        </p>
      )}

      {verificado && !(esRetirada && asignacion?.estado !== "completada") && (
        <p className="rounded-lg border border-borde-exito bg-fondo-exito-sutil px-esp4 py-esp3 text-sm text-texto-exito">
          Verificado por el administrador. Ya no se puede modificar.
        </p>
      )}

      {mostrarIncidencia && (
        <div className="flex flex-col gap-esp2 rounded-lg border border-borde-default bg-fondo-superficie p-esp4">
          <textarea
            value={notaIncidencia}
            onChange={(e) => setNotaIncidencia(e.target.value)}
            placeholder="¿Qué ha pasado?"
            rows={3}
            className="rounded-md border border-borde-campo px-esp3 py-esp2 text-sm outline-none focus:border-borde-foco"
          />
          <Boton variante="peligro" onClick={enviarIncidencia} cargando={pendiente} disabled={!notaIncidencia}>
            Enviar incidencia
          </Boton>
        </div>
      )}

      {/* Aviso "Deshacer" de unos segundos tras marcar como instalado */}
      {deshacer && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-esp4 bottom-24 z-30 mx-auto flex max-w-sm items-center gap-esp3 rounded-lg bg-fondo-inverso px-esp4 py-esp3 text-sm text-texto-inverso shadow-lg"
        >
          <span className="flex-1">Punto marcado como instalado</span>
          <button onClick={deshacerAhora} className="font-semibold underline underline-offset-2">
            Deshacer ({deshacer.restantes})
          </button>
        </div>
      )}
    </div>
  );
}
