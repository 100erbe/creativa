"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
  eliminarPuntoCampana,
  resolverIncidencia,
  revocarEnlaceCliente,
  renovarEnlaceCliente,
  programarRetirada,
  marcarRetirado,
  finalizarCampana,
  eliminarCampana,
} from "./acciones";
import { FormularioPunto, type ArticuloPunto, type PuntoEditable } from "./formulario-punto";
import { useAnadirPunto } from "./anadir-punto";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { ETIQUETA_ESTADO_CAMPANA } from "@/lib/etiquetas";
import { fechaMedia } from "@/lib/formato";
import { desenvolver } from "@/lib/accion";
import { confirmar } from "@/components/ui/dialogos";

type Asignado = { id: number; usuarioId: string; nombre: string; estado: string; rol: string };
type Candidato = { id: string; nombre: string };

const CLASE_SELECT_COMPACTO =
  "min-h-11 h-11 md:min-h-8 md:h-8 w-full rounded-md border border-borde-campo bg-fondo-superficie px-esp3 py-[9px] text-base leading-6 text-texto-primario outline-none focus:border-borde-foco disabled:cursor-not-allowed disabled:opacity-50 md:py-[5px] md:text-xs md:leading-5";

const CLASE_ACCION_COMPACTA =
  "inline-flex min-h-11 h-11 md:min-h-8 md:h-8 items-center justify-center gap-1.5 rounded-md px-esp3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 md:text-xs";

/** Asignar / quitar personas de un punto y marcarlo como verificado. */
export function ControlesPunto({
  campanaId,
  puntoId,
  estado,
  asignados,
  candidatos,
  punto,
  articulos,
  tieneFotos,
  fechasCampana,
  otrosPuntos,
}: {
  campanaId: number;
  puntoId: number;
  estado: string;
  asignados: Asignado[];
  candidatos: Candidato[];
  punto: PuntoEditable;
  articulos: ArticuloPunto[];
  tieneFotos: boolean;
  fechasCampana: { inicio: string | null; fin: string | null };
  otrosPuntos: { id: number; nombre: string; latitud: number; longitud: number }[];
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [editando, setEditando] = useState(false);
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
  const sePuedeEliminar = (estado === "pendiente" || estado === "incidencia") && !tieneFotos;

  if (editando) {
    return (
      <div className="mt-esp2 w-full basis-full">
        <FormularioPunto
          campanaId={campanaId}
          articulos={articulos}
          punto={punto}
          fechasCampana={fechasCampana}
          otrosPuntos={otrosPuntos}
          onCerrar={() => setEditando(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-esp2 lg:w-auto lg:items-end">
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
                className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded text-texto-terciario transition-colors hover:bg-fondo-peligro-sutil hover:text-texto-peligro disabled:opacity-50"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-esp2 lg:justify-end">
        <div className="min-w-[148px] flex-1 sm:flex-initial">
          <select
            value=""
            disabled={pendiente || libres.length === 0}
            onChange={(e) => {
              const usuarioId = e.target.value;
              if (!usuarioId) return;
              ejecutar(() => desenvolver(asignarPunto(campanaId, puntoId, usuarioId)));
            }}
            aria-label={`Asignar responsable para ${punto.nombre}`}
            className={CLASE_SELECT_COMPACTO}
          >
            <option value="">{libres.length === 0 ? "Todos asignados" : "Asignar a…"}</option>
            {libres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        {estado === "instalado" && (
          <Boton
            tamano="s"
            className="!min-h-11 !h-11 md:!min-h-8 md:!h-8 !text-sm md:!text-xs"
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
            className="!min-h-11 !h-11 md:!min-h-8 md:!h-8 !text-sm md:!text-xs"
            disabled={pendiente}
            onClick={() => ejecutar(() => desenvolver(resolverIncidencia(campanaId, puntoId)))}
          >
            <Icono nombre="check" size={14} />
            Resolver incidencia
          </Boton>
        )}
        <button
          type="button"
          disabled={pendiente}
          onClick={() => setEditando(true)}
          className={`${CLASE_ACCION_COMPACTA} border border-borde-campo bg-fondo-superficie text-texto-primario hover:bg-fondo-sutil`}
        >
          Editar
        </button>
        {sePuedeEliminar && (
          <button
            type="button"
            disabled={pendiente}
            title="Eliminar punto"
            aria-label={`Eliminar punto ${punto.nombre}`}
            onClick={async () => {
              if (!(await confirmar("¿Eliminar este punto? No se puede deshacer."))) return;
              ejecutar(() => desenvolver(eliminarPuntoCampana(campanaId, puntoId)));
            }}
            className="inline-flex min-h-11 h-11 w-11 shrink-0 items-center justify-center rounded-md border border-borde-default bg-fondo-superficie text-texto-secundario transition-colors hover:border-borde-peligro-sutil hover:bg-fondo-peligro-sutil hover:text-texto-peligro disabled:cursor-not-allowed disabled:opacity-50 md:min-h-8 md:h-8 md:w-8"
          >
            <Icono nombre="eliminar" size={15} />
          </button>
        )}
      </div>

      {instalado && (
        <div className="flex flex-wrap items-center gap-esp2 border-t border-fondo-hover pt-esp2 lg:justify-end">
          <span className="text-xs font-medium text-texto-secundario">Retirada</span>
          {!retiradaPendiente && (
            <div className="min-w-[148px] flex-1 sm:flex-initial">
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
            </div>
          )}
          <Boton
            tamano="s"
            variante="fantasma"
            className="!min-h-11 !h-11 md:!min-h-8 md:!h-8 !text-sm md:!text-xs"
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
          className="h-9 min-w-[200px] flex-1 rounded-md border border-borde-campo bg-fondo-sutil px-esp3 font-mono text-xs text-texto-secundario md:h-8"
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
          className="inline-flex min-h-9 items-center rounded-md px-esp2 text-xs font-medium text-texto-marca transition-colors hover:bg-fondo-marca-sutil md:min-h-8"
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

/** Botón "Añadir punto" que despliega el formulario con mapa a ancho completo. */
export function BotonAnadirPunto({
  campanaId,
  articulos,
  fechasCampana,
  otrosPuntos,
}: {
  campanaId: number;
  articulos: ArticuloPunto[];
  fechasCampana: { inicio: string | null; fin: string | null };
  otrosPuntos: { id: number; nombre: string; latitud: number; longitud: number }[];
}) {
  const { abierto, desdeMapa, abrir, cerrar } = useAnadirPunto();
  const contenedor = useRef<HTMLDivElement>(null);

  // Al llegar desde el mapa (pulsación larga), se lleva el formulario a la vista.
  useEffect(() => {
    if (!desdeMapa) return;
    const t = setTimeout(() => contenedor.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desdeMapa?.version]);

  if (abierto) {
    return (
      <div ref={contenedor} className="w-full basis-full scroll-mt-esp3">
        <FormularioPunto
          campanaId={campanaId}
          articulos={articulos}
          fechasCampana={fechasCampana}
          otrosPuntos={otrosPuntos}
          desdeMapa={desdeMapa}
          onCerrar={cerrar}
        />
      </div>
    );
  }
  return (
    <Boton
      tamano="s"
      className="!min-h-10 !h-10 md:!min-h-8 md:!h-8 w-fit"
      onClick={() => abrir()}
    >
      <Icono nombre="mas" size={15} />
      Añadir punto
    </Boton>
  );
}

/** Nombre, estado, fechas y descripción de la campaña. */
export function EditarCampana({
  campanaId,
  inicial,
  eliminable,
  contenido,
}: {
  campanaId: number;
  /** Sin documentos vinculados se puede borrar; con documento solo se puede cancelar. */
  eliminable: boolean;
  /** Lo que se borra con ella, para avisar en la confirmación. */
  contenido: { puntos: number; fotos: number };
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
      className="mt-esp3 flex w-full basis-full max-w-2xl flex-col gap-esp3 rounded-lg border border-borde-foco bg-fondo-superficie p-esp4 shadow-xs"
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
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={CAMPO} />
        </label>
        <label className={etiqueta}>
          Fin
          <input type="date" value={fin} min={inicio || undefined} onChange={(e) => setFin(e.target.value)} className={CAMPO} />
        </label>
      </div>
      <label className={etiqueta}>
        Indicaciones generales
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={2}
          className="rounded-md border border-borde-campo bg-fondo-superficie px-esp3 py-esp2 text-base text-texto-primario outline-none focus:border-borde-foco md:text-sm"
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
        <button
          type="button"
          disabled={pendiente || !eliminable}
          title={eliminable ? undefined : "Vinculada a un documento: no se puede eliminar. Cámbiala a «Cancelada»."}
          onClick={async () => {
            const partes = [
              contenido.puntos ? `${contenido.puntos} punto${contenido.puntos === 1 ? "" : "s"}` : "",
              contenido.fotos ? `${contenido.fotos} foto${contenido.fotos === 1 ? "" : "s"}` : "",
            ].filter(Boolean);
            const con = partes.length ? ` Se borrarán también ${partes.join(" y ")}.` : "";
            if (!(await confirmar(`¿Eliminar la campaña «${inicial.nombre}»?${con} No se puede deshacer.`))) return;
            setError(null);
            iniciar(async () => {
              try {
                await desenvolver(eliminarCampana(campanaId));
                router.push("/admin/campanas");
              } catch (err) {
                setError(err instanceof Error ? err.message : "No se pudo eliminar la campaña.");
              }
            });
          }}
          className="ml-auto text-xs font-medium text-texto-secundario hover:text-texto-peligro disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-texto-secundario"
        >
          Eliminar campaña
        </button>
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
    <div className="flex flex-wrap items-center gap-esp3 rounded-md border border-borde-exito bg-fondo-exito-sutil px-esp4 py-esp3">
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
