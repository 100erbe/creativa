"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { anadirContacto, eliminarContacto, cambiarActivo } from "../acciones";

type Contacto = {
  id: number;
  nombre: string;
  cargo: string | null;
  email: string | null;
  telefono: string | null;
  recibe_facturas: boolean;
};

export function Contactos({ clienteId, contactos }: { clienteId: number; contactos: Contacto[] }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [recibeFacturas, setRecibeFacturas] = useState(false);

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

  const entrada =
    "h-9 w-full rounded-md border border-borde-fuerte bg-fondo-superficie px-esp3 text-sm text-texto-primario outline-none focus:border-borde-foco";

  return (
    <div className="flex flex-col gap-esp3">
      {contactos.length > 0 && (
        <div className="flex flex-col divide-y divide-fondo-hover">
          {contactos.map((c) => (
            <div key={c.id} className="flex items-start gap-esp2 py-esp3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-texto-primario">
                  {c.nombre}
                  {c.cargo ? <span className="font-normal text-texto-terciario"> · {c.cargo}</span> : null}
                </p>
                <p className="truncate text-xs text-texto-secundario">
                  {[c.email, c.telefono].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                </p>
                {c.recibe_facturas && <p className="text-xs text-texto-exito">Recibe las facturas</p>}
              </div>
              <button
                aria-label={`Eliminar a ${c.nombre}`}
                disabled={pendiente}
                onClick={() => {
                  if (!confirm(`¿Eliminar el contacto ${c.nombre}?`)) return;
                  ejecutar(() => eliminarContacto(clienteId, c.id));
                }}
                className="text-icono-secundario hover:text-texto-peligro disabled:opacity-50"
              >
                <Icono nombre="eliminar" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      {contactos.length === 0 && !abierto && (
        <p className="text-sm text-texto-terciario">Todavía no hay contactos.</p>
      )}

      {abierto ? (
        <form
          className="flex flex-col gap-esp2"
          onSubmit={(e) => {
            e.preventDefault();
            ejecutar(async () => {
              await anadirContacto(clienteId, { nombre, cargo, email, telefono, recibeFacturas });
              setNombre("");
              setCargo("");
              setEmail("");
              setTelefono("");
              setRecibeFacturas(false);
              setAbierto(false);
            });
          }}
        >
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre *" required className={entrada} />
          <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo" className={entrada} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className={entrada} />
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono" className={entrada} />
          <label className="flex items-center gap-esp2 text-xs text-texto-secundario">
            <input type="checkbox" checked={recibeFacturas} onChange={(e) => setRecibeFacturas(e.target.checked)} />
            Recibe las facturas
          </label>
          <div className="flex gap-esp2">
            <Boton type="submit" tamano="s" cargando={pendiente}>
              Añadir contacto
            </Boton>
            <Boton type="button" tamano="s" variante="secundario" onClick={() => setAbierto(false)}>
              Cancelar
            </Boton>
          </div>
        </form>
      ) : (
        <Boton variante="secundario" tamano="s" onClick={() => setAbierto(true)}>
          <Icono nombre="mas" size={14} />
          Añadir contacto
        </Boton>
      )}

      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}

/** Desactivar/reactivar: los clientes con documentos no se pueden borrar. */
export function BotonActivo({ clienteId, activo }: { clienteId: number; activo: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-esp2">
      <Boton
        variante={activo ? "secundario" : "primario"}
        cargando={pendiente}
        onClick={() => {
          if (activo && !confirm("¿Desactivar este cliente? Dejará de salir al crear documentos nuevos.")) return;
          setError(null);
          iniciar(async () => {
            try {
              await cambiarActivo(clienteId, !activo);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo cambiar el estado.");
            }
          });
        }}
      >
        {activo ? "Desactivar cliente" : "Reactivar cliente"}
      </Boton>
      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}
