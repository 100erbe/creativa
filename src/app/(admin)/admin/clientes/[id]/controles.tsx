"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { Insignia } from "@/components/ui/insignia";
import { actualizarContacto, anadirContacto, eliminarCliente, eliminarContacto, cambiarActivo } from "../acciones";
import { desenvolver } from "@/lib/accion";
import { confirmar } from "@/components/ui/dialogos";
import { inicialesCliente } from "@/lib/clientes";

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
  const [editandoId, setEditandoId] = useState<number | null>(null);

  function abrir(c?: Contacto) {
    setEditandoId(c?.id ?? null);
    setNombre(c?.nombre ?? "");
    setCargo(c?.cargo ?? "");
    setEmail(c?.email ?? "");
    setTelefono(c?.telefono ?? "");
    setRecibeFacturas(c?.recibe_facturas ?? false);
    setAbierto(true);
  }

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
    "min-h-11 h-11 md:min-h-9 md:h-9 w-full rounded-md border border-borde-campo bg-fondo-superficie px-esp3 text-base md:text-sm text-texto-primario outline-none focus:border-borde-foco focus:ring-2 focus:ring-borde-foco/20";

  return (
    <div className="flex flex-col gap-esp3">
      {contactos.length > 0 && (
        <div className="flex flex-col divide-y divide-borde-default">
          {contactos.map((c) => (
            <div key={c.id} className="flex items-start gap-esp3 py-esp3">
              <div
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fondo-sutil text-xs font-semibold text-texto-secundario"
              >
                {inicialesCliente(c.nombre)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-medium text-texto-primario">{c.nombre}</p>
                  {c.recibe_facturas && <Insignia tono="exito">Facturación</Insignia>}
                </div>
                {c.cargo && <p className="text-xs text-texto-terciario">{c.cargo}</p>}
                <div className="mt-1 flex flex-col gap-0.5 text-xs">
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="truncate text-texto-marca hover:underline">
                      {c.email}
                    </a>
                  )}
                  {c.telefono && (
                    <a
                      href={`tel:${c.telefono.replace(/\s+/g, "")}`}
                      className="tabular-nums text-texto-secundario hover:text-texto-primario"
                    >
                      {c.telefono}
                    </a>
                  )}
                  {!c.email && !c.telefono && <span className="text-texto-terciario">Sin datos de contacto</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label={`Editar a ${c.nombre}`}
                  disabled={pendiente}
                  onClick={() => abrir(c)}
                  className="inline-flex min-h-9 items-center rounded-md border border-borde-default px-esp2 text-xs font-medium text-texto-primario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press disabled:opacity-50"
                >
                  Editar
                </button>
                <button
                  type="button"
                  aria-label={`Eliminar a ${c.nombre}`}
                  disabled={pendiente}
                  onClick={async () => {
                    if (!(await confirmar(`¿Eliminar el contacto ${c.nombre}?`))) return;
                    ejecutar(() => desenvolver(eliminarContacto(clienteId, c.id)));
                  }}
                  className="flex min-h-9 min-w-9 items-center justify-center rounded-md text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-peligro-sutil hover:text-texto-peligro active:scale-press disabled:opacity-50"
                >
                  <Icono nombre="eliminar" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {contactos.length === 0 && !abierto && (
        <p className="text-sm text-texto-terciario">Todavía no hay contactos.</p>
      )}

      {abierto ? (
        <form
          className="animate-estado-entrar flex flex-col gap-esp2 rounded-lg border border-borde-default bg-fondo-sutil/60 p-esp3"
          onSubmit={(e) => {
            e.preventDefault();
            ejecutar(async () => {
              const datos = { nombre, cargo, email, telefono, recibeFacturas };
              if (editandoId != null) await desenvolver(actualizarContacto(clienteId, editandoId, datos));
              else await desenvolver(anadirContacto(clienteId, datos));
              setEditandoId(null);
              setNombre("");
              setCargo("");
              setEmail("");
              setTelefono("");
              setRecibeFacturas(false);
              setAbierto(false);
            });
          }}
        >
          <p className="text-xs font-semibold text-texto-primario">
            {editandoId != null ? "Editar contacto" : "Nuevo contacto"}
          </p>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre *" aria-label="Nombre" required className={entrada} />
          <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo" aria-label="Cargo" className={entrada} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" aria-label="Email" type="email" className={entrada} />
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono" aria-label="Teléfono" className={entrada} />
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-esp2 text-xs text-texto-secundario">
            <input type="checkbox" checked={recibeFacturas} onChange={(e) => setRecibeFacturas(e.target.checked)} className="h-4 w-4" />
            Recibe las facturas por email
          </label>
          <div className="flex gap-esp2 pt-1">
            <Boton type="submit" tamano="s" cargando={pendiente}>
              {editandoId != null ? "Guardar contacto" : "Añadir contacto"}
            </Boton>
            <Boton type="button" tamano="s" variante="secundario" onClick={() => setAbierto(false)}>
              Cancelar
            </Boton>
          </div>
        </form>
      ) : (
        <Boton variante="secundario" tamano="s" onClick={() => abrir()}>
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
        onClick={async () => {
          if (activo && !(await confirmar("¿Desactivar este cliente? Dejará de salir al crear documentos nuevos."))) return;
          setError(null);
          iniciar(async () => {
            try {
              await desenvolver(cambiarActivo(clienteId, !activo));
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

/** Borrado de un cliente creado por error (solo si no tiene historial). */
export function BotonEliminarCliente({ clienteId, puedeEliminar }: { clienteId: number; puedeEliminar: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!puedeEliminar) return null;
  return (
    <div className="flex flex-col gap-esp2 border-t border-borde-default pt-esp3">
      <p className="text-xs text-texto-terciario">
        ¿Lo creaste por error? Como no tiene documentos ni campañas, puedes eliminarlo del todo.
      </p>
      <Boton
        variante="peligro"
        tamano="s"
        className="w-fit"
        cargando={pendiente}
        onClick={async () => {
          if (!(await confirmar("¿Eliminar este cliente y sus contactos? No se puede deshacer."))) return;
          setError(null);
          iniciar(async () => {
            try {
              await desenvolver(eliminarCliente(clienteId));
              router.push("/admin/clientes");
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo eliminar el cliente.");
            }
          });
        }}
      >
        Eliminar cliente
      </Boton>
      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}
