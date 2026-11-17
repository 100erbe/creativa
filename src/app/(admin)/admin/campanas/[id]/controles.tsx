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
import { CAMPO } from "@/components/ui/panel-busqueda";
import { ETIQUETA_ESTADO_CAMPANA } from "@/lib/etiquetas";
import { fechaMedia } from "@/lib/formato";
import { desenvolver } from "@/lib/accion";
import { confirmar } from "@/components/ui/dialogos";

type Asignado = { id: number; usuarioId: string; nombre: string; estado: string; rol: string };
type Candidato = { id: string; nombre: string };

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
  const [elegido, setElegido] = useState("");
  const [elegidoRetirada, setElegidoRetirada] = useState("");
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
      <FormularioPunto
        campanaId={campanaId}
        articulos={articulos}
        punto={punto}
        fechasCampana={fechasCampana}
        otrosPuntos={otrosPuntos}
        onCerrar={() => setEditando(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-esp2">
      <div className="flex flex-wrap items-center gap-esp2">
        {asignados.map((a) => (
          <span
            key={a.id}
            className="inline-flex items-center gap-esp1 rounded-completo border border-borde-default bg-fondo-sutil px-esp2 py-[2px] text-xs text-texto-secundario"
          >
            {a.nombre}
            <span className="text-texto-terciario">
              · {a.rol === "retirador" ? "retirada, " : ""}
              {etiquetaEstado(a.estado, ETIQUETA_ESTADO_ASIGNACION).toLowerCase()}
            </span>
            <button
              onClick={async () => {
                if (!(await confirmar(`¿Quitar a ${a.nombre} de este punto?`, { aceptar: "Quitar", peligro: true }))) return;
                ejecutar(() => desenvolver(quitarAsignacion(campanaId, a.id)));
              }}
              disabled={pendiente}
              aria-label={`Quitar a ${a.nombre}`}
              className="ml-1 text-texto-terciario hover:text-texto-peligro disabled:opacity-50"
            >
              ✕
            </button>
          </span>
        ))}
        {asignados.length === 0 && (
          <span className="text-xs text-texto-terciario">Sin asignar</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-esp2">
        <select
          value={elegido}
          onChange={(e) => setElegido(e.target.value)}
          className="h-8 rounded-md border border-borde-campo bg-fondo-superficie px-esp2 text-xs text-texto-primario"
        >
          <option value="">Asignar a…</option>
          {libres.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <Boton
          tamano="s"
          variante="secundario"
          disabled={!elegido || pendiente}
          onClick={() =>
            ejecutar(async () => {
              await desenvolver(asignarPunto(campanaId, puntoId, elegido));
              setElegido("");
            })
          }
        >
          Asignar
        </Boton>
        {estado === "instalado" && (
          <Boton
            tamano="s"
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
            disabled={pendiente}
            onClick={() => ejecutar(() => desenvolver(resolverIncidencia(campanaId, puntoId)))}
          >
            <Icono nombre="check" size={14} />
            Resolver incidencia
          </Boton>
        )}
        <Boton tamano="s" variante="fantasma" disabled={pendiente} onClick={() => setEditando(true)}>
          Editar
        </Boton>
        {sePuedeEliminar && (
          <button
            disabled={pendiente}
            onClick={async () => {
              if (!(await confirmar("¿Eliminar este punto? No se puede deshacer."))) return;
              ejecutar(() => desenvolver(eliminarPuntoCampana(campanaId, puntoId)));
            }}
            className="text-xs font-medium text-texto-secundario hover:text-texto-peligro disabled:opacity-50"
          >
            Eliminar
          </button>
        )}
      </div>

      {instalado && (
        <div className="flex flex-wrap items-center gap-esp2 border-t border-fondo-hover pt-esp2">
          <span className="text-xs font-medium text-texto-secundario">Retirada</span>
          {!retiradaPendiente && (
            <>
              <select
                value={elegidoRetirada}
                onChange={(e) => setElegidoRetirada(e.target.value)}
                aria-label="Quién retira el punto"
                className="h-8 rounded-md border border-borde-campo bg-fondo-superficie px-esp2 text-xs text-texto-primario"
              >
                <option value="">Encargar a…</option>
                {candidatos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <Boton
                tamano="s"
                variante="secundario"
                disabled={!elegidoRetirada || pendiente}
                onClick={() =>
                  ejecutar(async () => {
                    await desenvolver(programarRetirada(campanaId, puntoId, elegidoRetirada));
                    setElegidoRetirada("");
                  })
                }
              >
                Programar retirada
              </Boton>
            </>
          )}
          <Boton
            tamano="s"
            variante="fantasma"
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

/** Enlace público para el cliente: copiar o crear si todavía no existe. */
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
      <div className="flex flex-col gap-esp2">
        <p className="text-sm text-texto-secundario">
          El cliente verá el estado y las fotos sin necesidad de iniciar sesión.
        </p>
        <Boton variante="secundario" onClick={crear} cargando={pendiente}>
          <Icono nombre="enlace" size={16} />
          Crear enlace para el cliente
        </Boton>
        {error && <p className="text-xs text-texto-peligro">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-esp2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="h-9 w-full rounded-md border border-borde-campo bg-fondo-sutil px-esp3 text-xs text-texto-secundario"
      />
      <div className="flex items-center gap-esp3">
        <Boton tamano="s" variante="secundario" onClick={copiar}>
          <Icono nombre="copiar" size={14} />
          {copiado ? "Copiado" : "Copiar"}
        </Boton>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-texto-marca"
        >
          Abrir
        </a>
        <span className="ml-auto text-xs text-texto-terciario">
          {vistas} {vistas === 1 ? "visita" : "visitas"}
        </span>
      </div>
      {expiraEn && (
        <p className="text-xs text-texto-terciario">
          {new Date(expiraEn) < new Date() ? "Caducó el " : "Caduca el "}
          {fechaMedia(expiraEn)}
        </p>
      )}
      <div className="flex items-center gap-esp3 border-t border-fondo-hover pt-esp2">
        <button
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
          className="text-xs font-medium text-texto-marca disabled:opacity-50"
        >
          Generar uno nuevo
        </button>
        <button
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
          className="text-xs font-medium text-texto-secundario hover:text-texto-peligro disabled:opacity-50"
        >
          Desactivar
        </button>
      </div>
      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}

/** Botón "Añadir punto" que despliega el formulario con mapa en la propia ficha de la campaña. */
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
  const [abierto, setAbierto] = useState(false);
  if (abierto) {
    return (
      <FormularioPunto
        campanaId={campanaId}
        articulos={articulos}
        fechasCampana={fechasCampana}
        otrosPuntos={otrosPuntos}
        onCerrar={() => setAbierto(false)}
      />
    );
  }
  return (
    <Boton variante="secundario" className="w-fit" onClick={() => setAbierto(true)}>
      <Icono nombre="mas" size={16} />
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
      <Boton variante="secundario" tamano="s" onClick={() => setAbierto(true)}>
        Editar campaña
      </Boton>
    );
  }

  const etiqueta = "flex flex-col gap-1 text-xs font-medium text-texto-secundario";
  return (
    <form
      className="flex max-w-xl flex-col gap-esp3 rounded-lg border border-borde-foco bg-fondo-superficie p-esp4"
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
      <div className="flex gap-esp2">
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
