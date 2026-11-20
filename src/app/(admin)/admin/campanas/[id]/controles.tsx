"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { etiquetaEstado, ETIQUETA_ESTADO_ASIGNACION } from "@/lib/etiquetas";
import {
  asignarPunto,
  quitarAsignacion,
  verificarPunto,
  crearEnlaceCliente,
  actualizarCampana,
  resolverIncidencia,
  revocarEnlaceCliente,
  renovarEnlaceCliente,
  programarRetirada,
  marcarRetirado,
  finalizarCampana,
} from "./acciones";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { SelectorFecha } from "@/components/ui/selector-fecha";
import { ETIQUETA_ESTADO_CAMPANA } from "@/lib/etiquetas";
import { fechaMedia } from "@/lib/formato";
import { desenvolver } from "@/lib/accion";
import { confirmar } from "@/components/ui/dialogos";

type Asignado = { id: number; usuarioId: string; nombre: string; estado: string; rol: string };
type Candidato = { id: string; nombre: string };

const CLASE_SELECT_COMPACTO =
  "min-h-9 h-9 md:min-h-8 md:h-8 rounded-lg border border-borde-default bg-fondo-sutil px-esp2.5 py-1 text-xs font-medium text-texto-secundario outline-none transition-colors duration-rapida ease-suave hover:border-borde-campo hover:text-texto-primario focus:border-borde-foco disabled:cursor-not-allowed disabled:opacity-50";

/** Asignar / quitar personas de un punto y marcarlo como verificado. */
export function ControlesPunto({
  campanaId,
  puntoId,
  puntoNombre,
  estado,
  asignados,
  candidatos,
}: {
  campanaId: number;
  puntoId: number;
  puntoNombre: string;
  estado: string;
  asignados: Asignado[];
  candidatos: Candidato[];
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function ejecutar(accion: () => Promise<void>) {
    setError(null);
    iniciar(async () => {
      try {
        await accion();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
      }
    });
  }

  const libres = candidatos.filter((c) => !asignados.some((a) => a.usuarioId === c.id && a.rol !== "retirador"));
  const instalado = estado === "instalado" || estado === "verificado";
  const retiradaPendiente = asignados.some((a) => a.rol === "retirador" && a.estado !== "completada");

  return (
    <div data-accion-fila="" className="flex flex-col gap-esp2 pl-9 lg:w-auto lg:items-end lg:pl-0">
      {asignados.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
          {asignados.map((a) => (
            <span
              key={a.id}
              className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-borde-default bg-fondo-sutil px-esp2 py-0.5 text-xs font-medium text-texto-primario"
            >
              <span>{a.nombre}</span>
              <span className="font-normal text-texto-terciario">
                · {a.rol === "retirador" ? "retirada, " : ""}
                {etiquetaEstado(a.estado, ETIQUETA_ESTADO_ASIGNACION).toLowerCase()}
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (!(await confirmar(`¿Quitar a ${a.nombre} de este punto?`, { aceptar: "Quitar", peligro: true }))) return;
                  ejecutar(() => desenvolver(quitarAsignacion(campanaId, a.id)));
                }}
                disabled={pendiente}
                aria-label={`Quitar a ${a.nombre}`}
                className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded text-texto-terciario transition-colors duration-rapida ease-suave hover:bg-fondo-peligro-sutil hover:text-texto-peligro disabled:opacity-50"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-esp2 lg:justify-end">
        <select
          value=""
          disabled={pendiente || libres.length === 0}
          onChange={(e) => {
            const usuarioId = e.target.value;
            if (!usuarioId) return;
            ejecutar(() => desenvolver(asignarPunto(campanaId, puntoId, usuarioId)));
          }}
          aria-label={`Asignar responsable para ${puntoNombre}`}
          className={CLASE_SELECT_COMPACTO}
        >
          <option value="">{libres.length === 0 ? "Todos asignados" : "Asignar a…"}</option>
          {libres.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        {estado === "instalado" && (
          <Boton
            tamano="s"
            className="!min-h-9 !h-9 md:!min-h-8 md:!h-8 !text-xs"
            disabled={pendiente}
            onClick={() => ejecutar(() => desenvolver(verificarPunto(campanaId, puntoId)))}
          >
            <Icono nombre="check" size={14} />
            Verificar
          </Boton>
        )}
        {estado === "incidencia" && (
          <Boton
            tamano="s"
            className="!min-h-9 !h-9 md:!min-h-8 md:!h-8 !text-xs"
            disabled={pendiente}
            onClick={() => ejecutar(() => desenvolver(resolverIncidencia(campanaId, puntoId)))}
          >
            <Icono nombre="check" size={14} />
            Resolver incidencia
          </Boton>
        )}
      </div>

      {instalado && (
        <div className="flex flex-wrap items-center gap-esp2 border-t border-borde-default pt-esp2 lg:justify-end">
          <span className="text-xs font-medium text-texto-secundario">Retirada</span>
          {!retiradaPendiente && (
            <select
              value=""
              disabled={pendiente}
              onChange={(e) => {
                const usuarioId = e.target.value;
                if (!usuarioId) return;
                ejecutar(() => desenvolver(programarRetirada(campanaId, puntoId, usuarioId)));
              }}
              aria-label="Quién retira el punto"
              className={CLASE_SELECT_COMPACTO}
            >
              <option value="">Encargar a…</option>
              {candidatos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          )}
          <Boton
            tamano="s"
            variante="fantasma"
            className="!min-h-9 !h-9 md:!min-h-8 md:!h-8 !text-xs"
            disabled={pendiente}
            onClick={async () => {
              if (!(await confirmar("¿Marcar este punto como retirado?"))) return;
              ejecutar(() => desenvolver(marcarRetirado(campanaId, puntoId)));
            }}
          >
            Marcar retirado
          </Boton>
        </div>
      )}

      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}

/** Enlace público para el cliente: barra compacta para crear, copiar o gestionar. */
export function EnlaceCliente({
  campanaId,
  url,
  vistas,
  expiraEn,
}: {
  campanaId: number;
  url: string | null;
  vistas: number;
  expiraEn: string | null;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copiar() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No se pudo copiar; selecciona el enlace a mano.");
    }
  }

  function crear() {
    setError(null);
    iniciar(async () => {
      try {
        await desenvolver(crearEnlaceCliente(campanaId));
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo crear el enlace.");
      }
    });
  }

  if (!url) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-esp2">
          <p className="flex items-center gap-esp2 text-xs text-texto-secundario">
            <Icono nombre="enlace" size={14} className="text-icono-secundario" />
            <span>Comparte el avance y las fotos con el cliente sin iniciar sesión.</span>
          </p>
          <Boton
            tamano="s"
            variante="secundario"
            className="!min-h-10 !h-10 md:!min-h-8 md:!h-8 text-xs"
            onClick={crear}
            cargando={pendiente}
          >
            <Icono nombre="enlace" size={14} />
            Crear enlace público
          </Boton>
        </div>
        {error && <p className="text-xs text-texto-peligro">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-esp2">
        <input
          readOnly
          value={url}
          aria-label="Enlace público para el cliente"
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 min-w-[200px] flex-1 rounded-lg border border-borde-campo bg-fondo-sutil px-esp3 font-mono text-xs text-texto-secundario md:h-8"
        />
        <Boton
          tamano="s"
          variante="secundario"
          className="min-h-9 h-9 md:min-h-8 md:h-8 text-xs"
          onClick={copiar}
        >
          <Icono nombre="copiar" size={14} />
          {copiado ? "Copiado" : "Copiar"}
        </Boton>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 items-center rounded-md px-esp2 text-xs font-medium text-texto-marca transition-colors duration-rapida ease-suave hover:bg-fondo-marca-sutil active:scale-press md:min-h-8"
        >
          Abrir ↗
        </a>
        <span className="tabular-nums text-xs text-texto-terciario">
          {vistas} {vistas === 1 ? "visita" : "visitas"}
          {expiraEn
            ? ` · ${new Date(expiraEn) < new Date() ? "caducó " : "caduca "}${fechaMedia(expiraEn)}`
            : ""}
        </span>
        <div className="flex items-center gap-esp2 border-l border-borde-default pl-esp2">
          <button
            type="button"
            disabled={pendiente}
            onClick={async () => {
              if (!(await confirmar("Se desactivará el enlace actual y se creará uno nuevo. El cliente tendrá que usar el nuevo. ¿Continuar?"))) return;
              setError(null);
              iniciar(async () => {
                try {
                  await desenvolver(renovarEnlaceCliente(campanaId));
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "No se pudo renovar el enlace.");
                }
              });
            }}
            className="min-h-8 text-xs font-medium text-texto-marca hover:underline disabled:opacity-50"
          >
            Renovar
          </button>
          <button
            type="button"
            disabled={pendiente}
            onClick={async () => {
              if (!(await confirmar("El cliente dejará de poder ver la campaña con este enlace. ¿Desactivarlo?"))) return;
              setError(null);
              iniciar(async () => {
                try {
                  await desenvolver(revocarEnlaceCliente(campanaId));
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "No se pudo desactivar el enlace.");
                }
              });
            }}
            className="min-h-8 text-xs font-medium text-texto-secundario hover:text-texto-peligro disabled:opacity-50"
          >
            Desactivar
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}

/** Nombre, estado, fechas y descripción de la campaña. */
export function EditarCampana({
  campanaId,
  inicial,
}: {
  campanaId: number;
  inicial: { nombre: string; estado: string; fechaInicio: string | null; fechaFin: string | null; descripcion: string | null };
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState(inicial.nombre);
  const [estado, setEstado] = useState(inicial.estado);
  const [inicio, setInicio] = useState(inicial.fechaInicio ?? "");
  const [fin, setFin] = useState(inicial.fechaFin ?? "");
  const [descripcion, setDescripcion] = useState(inicial.descripcion ?? "");

  if (!abierto) {
    return (
      <Boton
        variante="secundario"
        tamano="s"
        className="!min-h-10 !h-10 md:!min-h-8 md:!h-8 shrink-0"
        onClick={() => setAbierto(true)}
      >
        Editar campaña
      </Boton>
    );
  }

  const etiqueta = "flex flex-col gap-1 text-xs font-medium text-texto-secundario";
  return (
    <form
      className="animate-estado-entrar mt-esp3 flex w-full basis-full max-w-2xl flex-col gap-esp3 rounded-xl border border-borde-foco bg-fondo-superficie p-esp4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        iniciar(async () => {
          try {
            await desenvolver(
              actualizarCampana(campanaId, { nombre, estado, fechaInicio: inicio, fechaFin: fin, descripcion }),
            );
            router.refresh();
            setAbierto(false);
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo guardar la campaña.");
          }
        });
      }}
    >
      <label className={etiqueta}>
        Nombre *
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} required className={CAMPO} />
      </label>
      <div className="grid grid-cols-1 gap-esp3 sm:grid-cols-3">
        <label className={etiqueta}>
          Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className={CAMPO}>
            {Object.entries(ETIQUETA_ESTADO_CAMPANA).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </select>
        </label>
        <label className={etiqueta}>
          Inicio
          <SelectorFecha
            value={inicio}
            onChange={(v) => {
              setInicio(v);
              if (fin && v && fin < v) setFin("");
            }}
          />
        </label>
        <label className={etiqueta}>
          Fin
          <SelectorFecha value={fin} min={inicio || undefined} onChange={setFin} />
        </label>
      </div>
      <label className={etiqueta}>
        Indicaciones generales
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={2}
          className="rounded-lg border border-borde-campo bg-fondo-superficie px-esp3 py-esp2 text-base text-texto-primario outline-none focus:border-borde-foco md:text-sm"
        />
      </label>
      {error && <p className="text-xs text-texto-peligro">{error}</p>}
      <div className="flex flex-wrap items-center gap-esp2">
        <Boton type="submit" cargando={pendiente}>
          Guardar
        </Boton>
        <Boton type="button" variante="secundario" onClick={() => setAbierto(false)} disabled={pendiente}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}

/** Aviso cuando ya no queda nada instalado: se puede cerrar la campaña. */
export function AvisoFinalizar({ campanaId }: { campanaId: number }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="animate-estado-entrar flex flex-wrap items-center gap-esp3 rounded-md border border-borde-exito bg-fondo-exito-sutil px-esp4 py-esp3">
      <Icono nombre="check" size={18} className="text-texto-exito" />
      <p className="min-w-0 flex-1 text-sm text-texto-primario">Todos los puntos están retirados. ¿Cerramos la campaña?</p>
      <Boton
        tamano="s"
        cargando={pendiente}
        onClick={() => {
          setError(null);
          iniciar(async () => {
            try {
              await desenvolver(finalizarCampana(campanaId));
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo finalizar la campaña.");
            }
          });
        }}
      >
        Finalizar campaña
      </Boton>
      {error && <p className="w-full text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}
