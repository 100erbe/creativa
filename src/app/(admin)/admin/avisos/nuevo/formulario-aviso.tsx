"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Boton } from "@/components/ui/boton";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { confirmar } from "@/components/ui/dialogos";
import { desenvolver } from "@/lib/accion";
import { crearAviso, type ResultadoCreacion } from "@/lib/avisos/acciones";

type Persona = { id: string; nombre: string; rol: string; dispositivos: number };

export function FormularioAviso({ personas }: { personas: Persona[] }) {
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [urgente, setUrgente] = useState(true);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set(personas.filter((p) => p.rol === "empleado").map((p) => p.id)));
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<ResultadoCreacion | null>(null);
  const [pendiente, iniciar] = useTransition();

  function alternar(id: string) {
    setElegidas((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (elegidas.size === 0) return setError("Elige al menos una persona.");
    const ok = await confirmar(
      `Se enviará ahora a ${elegidas.size} persona${elegidas.size === 1 ? "" : "s"}${urgente ? " y se repetirá cada 10 minutos hasta que confirmen (máximo 3 veces)" : ""}.`,
      { aceptar: "Enviar", peligro: false },
    );
    if (!ok) return;
    iniciar(async () => {
      try {
        setEnviado(await desenvolver(crearAviso({ titulo, cuerpo, urgente, destinatarios: [...elegidas] })));
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo enviar el aviso.");
      }
    });
  }

  if (enviado) {
    return (
      <div className="flex flex-col gap-esp4 rounded-lg border border-borde-exito bg-fondo-exito-sutil px-esp5 py-esp5">
        <p className="text-sm font-medium text-texto-exito">
          Aviso enviado a {enviado.destinatarios} persona{enviado.destinatarios === 1 ? "" : "s"}.
        </p>
        {enviado.sinDispositivo.length > 0 && (
          <p className="text-sm text-texto-primario">
            <strong>No tienen los avisos activados en el móvil:</strong> {enviado.sinDispositivo.join(", ")}. Verán el aviso
            al abrir la app, pero conviene llamarles.
          </p>
        )}
        <Link href={`/admin/avisos/${enviado.id}`} className="w-fit text-sm font-medium text-texto-marca">
          Ver el seguimiento
        </Link>
      </div>
    );
  }

  const etiqueta = "flex flex-col gap-1 text-xs font-medium text-texto-secundario";
  return (
    <form onSubmit={enviar} className="flex flex-col gap-esp4 rounded-xl border border-borde-default bg-fondo-superficie px-esp5 py-esp5">
      <label className={etiqueta}>
        Título *
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} required placeholder="Ej. Cambio de zona mañana" className={CAMPO} />
      </label>
      <label className={etiqueta}>
        Mensaje *
        <textarea
          value={cuerpo}
          onChange={(e) => setCuerpo(e.target.value)}
          maxLength={600}
          required
          rows={4}
          className="rounded-lg border border-borde-campo bg-fondo-superficie px-esp3 py-esp2 text-base text-texto-primario outline-none focus:border-borde-foco md:text-sm"
        />
        <span className="self-end font-normal text-texto-terciario">{cuerpo.length}/600</span>
      </label>

      <label className="flex items-start gap-esp3 rounded-md bg-fondo-sutil px-esp3 py-esp3">
        <input type="checkbox" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
        <span className="flex flex-col">
          <span className="text-sm font-medium text-texto-primario">Urgente: exigir confirmación de lectura</span>
          <span className="text-xs text-texto-terciario">
            Se repite cada 10 minutos (3 veces como máximo) a quien no confirma, y después te avisamos para que le llames.
            Sin marcar, es un aviso informativo que se envía una sola vez.
          </span>
        </span>
      </label>

      <fieldset className="flex flex-col gap-esp2">
        <div className="flex items-center gap-esp3">
          <legend className="flex-1 text-xs font-medium text-texto-secundario">Destinatarios *</legend>
          <button type="button" onClick={() => setElegidas(new Set(personas.filter((p) => p.rol === "empleado").map((p) => p.id)))} className="text-xs font-medium text-texto-marca">
            Todos los empleados
          </button>
          <button type="button" onClick={() => setElegidas(new Set())} className="text-xs text-texto-secundario">
            Ninguno
          </button>
        </div>
        <div className="flex flex-col divide-y divide-borde-default rounded-md border border-borde-default">
          {personas.map((p) => (
            <label key={p.id} className="flex items-center gap-esp3 px-esp3 py-esp2">
              <input type="checkbox" checked={elegidas.has(p.id)} onChange={() => alternar(p.id)} className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1 text-sm text-texto-primario">
                {p.nombre}
                {p.rol === "admin" && <span className="ml-esp2 text-xs text-texto-terciario">(administración)</span>}
              </span>
              <span className={p.dispositivos > 0 ? "text-xs text-texto-exito" : "text-xs text-texto-aviso"}>
                {p.dispositivos > 0 ? "Avisos activos" : "Sin avisos activados"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p className="text-sm text-texto-peligro">{error}</p>}
      <Boton type="submit" cargando={pendiente} className="min-h-11 self-end">
        Enviar aviso
      </Boton>
    </form>
  );
}
