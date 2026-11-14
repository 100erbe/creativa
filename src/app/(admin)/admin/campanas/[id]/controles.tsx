"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import {
  asignarPunto,
  quitarAsignacion,
  verificarPunto,
  crearEnlaceCliente,
} from "./acciones";

type Asignado = { id: number; usuarioId: string; nombre: string; estado: string };
type Candidato = { id: string; nombre: string };

/** Asignar / quitar personas de un punto y marcarlo como verificado. */
export function ControlesPunto({
  campanaId,
  puntoId,
  estado,
  asignados,
  candidatos,
}: {
  campanaId: number;
  puntoId: number;
  estado: string;
  asignados: Asignado[];
  candidatos: Candidato[];
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [elegido, setElegido] = useState("");
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

  const libres = candidatos.filter((c) => !asignados.some((a) => a.usuarioId === c.id));

  return (
    <div className="flex flex-col gap-esp2">
      <div className="flex flex-wrap items-center gap-esp2">
        {asignados.map((a) => (
          <span
            key={a.id}
            className="inline-flex items-center gap-esp1 rounded-completo border border-borde-default bg-fondo-sutil px-esp2 py-[2px] text-xs text-texto-secundario"
          >
            {a.nombre}
            <span className="text-texto-terciario">· {a.estado.replace("_", " ")}</span>
            <button
              onClick={() => ejecutar(() => quitarAsignacion(campanaId, a.id))}
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
          className="h-8 rounded-md border border-borde-fuerte bg-fondo-superficie px-esp2 text-xs text-texto-primario"
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
              await asignarPunto(campanaId, puntoId, elegido);
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
            onClick={() => ejecutar(() => verificarPunto(campanaId, puntoId))}
          >
            <Icono nombre="check" size={14} />
            Verificar
          </Boton>
        )}
      </div>

      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}

/** Enlace público para el cliente: copiar o crear si todavía no existe. */
export function EnlaceCliente({
  campanaId,
  url,
  vistas,
}: {
  campanaId: number;
  url: string | null;
  vistas: number;
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
        await crearEnlaceCliente(campanaId);
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
        className="h-9 w-full rounded-md border border-borde-fuerte bg-fondo-sutil px-esp3 text-xs text-texto-secundario"
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
      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}
