"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { desenvolver } from "@/lib/accion";
import { crearCampanaNueva } from "./acciones";

type Cliente = { id: number; razon_social: string; nombre_comercial: string | null };

export function FormularioCampana({
  clientes,
  clienteInicialId,
}: {
  clientes: Cliente[];
  clienteInicialId?: number;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState(
    clienteInicialId && clientes.some((c) => c.id === clienteInicialId) ? String(clienteInicialId) : "",
  );
  const [nombre, setNombre] = useState("");
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const etiqueta = "flex flex-col gap-1 text-xs font-medium text-texto-secundario";

  return (
    <form
      className="flex flex-col gap-esp4 rounded-lg border border-borde-default bg-fondo-superficie px-esp5 py-esp5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        iniciar(async () => {
          try {
            const id = await desenvolver(
              crearCampanaNueva({
                clienteId: Number(clienteId),
                nombre,
                fechaInicio: inicio,
                fechaFin: fin,
                descripcion,
              }),
            );
            router.push(`/admin/campanas/${id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo crear la campaña.");
          }
        });
      }}
    >
      <label className={etiqueta}>
        Cliente *
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} required className={CAMPO}>
          <option value="">Elige un cliente…</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre_comercial || c.razon_social}
              {c.nombre_comercial ? ` (${c.razon_social})` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className={etiqueta}>
        Nombre de la campaña *
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          placeholder="Ej. Concierto de verano"
          className={CAMPO}
        />
      </label>
      <div className="grid grid-cols-2 gap-esp3">
        <label className={etiqueta}>
          Inicio (colocación)
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={CAMPO} />
        </label>
        <label className={etiqueta}>
          Fin (retirada)
          <input type="date" value={fin} min={inicio || undefined} onChange={(e) => setFin(e.target.value)} className={CAMPO} />
        </label>
      </div>
      <label className={etiqueta}>
        Indicaciones generales
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          placeholder="Ej. instalar de noche, pedir permiso al ayuntamiento…"
          className="rounded-md border border-borde-fuerte bg-fondo-superficie px-esp3 py-esp2 text-base text-texto-primario outline-none focus:border-borde-foco md:text-sm"
        />
      </label>
      {error && <p className="text-sm text-texto-peligro">{error}</p>}
      <Boton type="submit" cargando={pendiente} className="self-end">
        Crear campaña y marcar puntos
      </Boton>
    </form>
  );
}
