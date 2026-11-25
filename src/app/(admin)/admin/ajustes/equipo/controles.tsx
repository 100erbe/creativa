"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { Insignia } from "@/components/ui/insignia";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { desenvolver } from "@/lib/accion";
import { actualizarPersona, cambiarContrasena, crearPersona } from "./acciones";
import { enviarPruebaA } from "@/lib/push/acciones";
import { MIN_CONTRASENA } from "@/lib/contrasena";
import { Tarjeta } from "@/components/ui/tarjeta";

type Persona = {
  id: string;
  nombre: string;
  apellidos: string | null;
  email: string;
  telefono: string | null;
  rol: string;
  activo: boolean;
};

const ETIQUETA_ROL: Record<string, string> = { admin: "Administradora", empleado: "Empleado" };
const etiqueta = "flex flex-col gap-1 text-xs font-medium text-texto-secundario";

function useAccion() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  function ejecutar(fn: () => Promise<string | void>) {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      try {
        const mensaje = await fn();
        if (mensaje) setAviso(mensaje);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
      }
    });
  }
  return { pendiente, error, aviso, ejecutar };
}

type Dispositivos = Record<string, { cantidad: number; fallos: number }>;

export function Equipo({ personas, yoId, dispositivos }: { personas: Persona[]; yoId: string; dispositivos: Dispositivos }) {
  const [editando, setEditando] = useState<string | "nueva" | null>(null);

  return (
    <div className="flex flex-col gap-esp3">
      {editando === "nueva" ? (
        <FormularioPersona onCerrar={() => setEditando(null)} />
      ) : (
        <Boton className="w-fit" onClick={() => setEditando("nueva")}>
          <Icono nombre="mas" size={16} />
          Añadir persona
        </Boton>
      )}

      <Tarjeta disposicion="libre" relleno="ninguno" className="flex flex-col divide-y divide-borde-default px-esp5">
        {personas.map((p) =>
          editando === p.id ? (
            <div key={p.id} className="py-esp3">
              <FormularioPersona persona={p} esYo={p.id === yoId} onCerrar={() => setEditando(null)} />
            </div>
          ) : (
            <div key={p.id} className="flex items-center gap-esp3 py-esp3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-texto-primario">
                  {`${p.nombre} ${p.apellidos ?? ""}`.trim()}
                  {p.id === yoId && <span className="ml-esp2 text-xs font-normal text-texto-terciario">(tú)</span>}
                </p>
                <p className="truncate text-xs text-texto-terciario">
                  {p.email}
                  {p.telefono ? ` · ${p.telefono}` : ""}
                </p>
                <EstadoAvisos personaId={p.id} activa={p.activo} info={dispositivos[p.id]} />
              </div>
              <Insignia tono={p.rol === "admin" ? "info" : "neutro"}>{ETIQUETA_ROL[p.rol] ?? p.rol}</Insignia>
              {!p.activo && <Insignia tono="peligro">Desactivada</Insignia>}
              <button onClick={() => setEditando(p.id)} className="text-sm font-medium text-texto-marca">
                Editar
              </button>
            </div>
          ),
        )}
      </Tarjeta>
    </div>
  );
}

function FormularioPersona({ persona, esYo, onCerrar }: { persona?: Persona; esYo?: boolean; onCerrar: () => void }) {
  const { pendiente, error, aviso, ejecutar } = useAccion();
  const [nombre, setNombre] = useState(persona?.nombre ?? "");
  const [apellidos, setApellidos] = useState(persona?.apellidos ?? "");
  const [email, setEmail] = useState(persona?.email ?? "");
  const [telefono, setTelefono] = useState(persona?.telefono ?? "");
  const [rol, setRol] = useState(persona?.rol ?? "empleado");
  const [activo, setActivo] = useState(persona?.activo ?? true);
  const [password, setPassword] = useState("");

  const esAlta = !persona;

  return (
    <form
      className="flex flex-col gap-esp3 rounded-xl border border-borde-foco bg-fondo-superficie p-esp4"
      onSubmit={(e) => {
        e.preventDefault();
        ejecutar(async () => {
          if (esAlta) {
            await desenvolver(crearPersona({ nombre, apellidos, email, telefono, rol, password }));
          } else {
            await desenvolver(actualizarPersona(persona.id, { nombre, apellidos, telefono, rol, activo }));
          }
          onCerrar();
        });
      }}
    >
      <h2 className="text-titulo-panel text-texto-primario">{esAlta ? "Nueva persona" : "Editar persona"}</h2>
      <div className="grid grid-cols-1 gap-esp3 sm:grid-cols-2">
        <label className={etiqueta}>
          Nombre *
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required className={CAMPO} />
        </label>
        <label className={etiqueta}>
          Apellidos
          <input value={apellidos} onChange={(e) => setApellidos(e.target.value)} className={CAMPO} />
        </label>
        <label className={etiqueta}>
          Email {esAlta ? "*" : "(no se puede cambiar)"}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={!esAlta}
            className={CAMPO}
          />
        </label>
        <label className={etiqueta}>
          Teléfono
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className={CAMPO} />
        </label>
        <label className={etiqueta}>
          Rol
          <select value={rol} onChange={(e) => setRol(e.target.value)} disabled={esYo} className={CAMPO}>
            <option value="empleado">Empleado (app del móvil)</option>
            <option value="admin">Administradora (todo el panel)</option>
          </select>
        </label>
        {esAlta && (
          <label className={etiqueta}>
            Contraseña inicial * (mín. {MIN_CONTRASENA})
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={MIN_CONTRASENA}
              autoComplete="off"
              className={CAMPO}
            />
            <span className="font-normal text-texto-terciario">Se la das tú a la persona.</span>
          </label>
        )}
      </div>
      {!esAlta && (
        <label className="flex items-center gap-esp2 text-sm text-texto-primario">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} disabled={esYo} />
          Cuenta activa
          {esYo && <span className="text-xs text-texto-terciario">(no puedes desactivarte a ti misma)</span>}
        </label>
      )}
      {error && <p className="text-xs text-texto-peligro">{error}</p>}
      <div className="flex flex-wrap items-center gap-esp2">
        <Boton type="submit" cargando={pendiente}>
          {esAlta ? "Crear cuenta" : "Guardar"}
        </Boton>
        <Boton type="button" variante="secundario" onClick={onCerrar} disabled={pendiente}>
          Cancelar
        </Boton>
      </div>
      {persona && <CambiarContrasena id={persona.id} />}
      {aviso && <p className="text-xs text-texto-exito">{aviso}</p>}
    </form>
  );
}

function CambiarContrasena({ id }: { id: string }) {
  const { pendiente, error, aviso, ejecutar } = useAccion();
  const [abierto, setAbierto] = useState(false);
  const [password, setPassword] = useState("");

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="w-fit text-xs font-medium text-texto-marca">
        Cambiar su contraseña
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-esp2 border-t border-fondo-hover pt-esp3">
      <label className={etiqueta}>
        Nueva contraseña (mín. {MIN_CONTRASENA})
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
          className={CAMPO}
        />
      </label>
      <div className="flex items-center gap-esp2">
        <Boton
          type="button"
          tamano="s"
          variante="secundario"
          cargando={pendiente}
          disabled={password.length < MIN_CONTRASENA}
          onClick={() =>
            ejecutar(async () => {
              await desenvolver(cambiarContrasena(id, password));
              setPassword("");
              return "Contraseña cambiada. Comunícasela a la persona.";
            })
          }
        >
          Cambiar contraseña
        </Boton>
        <button type="button" onClick={() => setAbierto(false)} className="text-xs text-texto-secundario">
          Cerrar
        </button>
      </div>
      {error && <p className="text-xs text-texto-peligro">{error}</p>}
      {aviso && <p className="text-xs text-texto-exito">{aviso}</p>}
    </div>
  );
}

/** ¿Le llegan los avisos a esta persona? Cuántos móviles tiene activados y un botón para probarlo. */
function EstadoAvisos({ personaId, activa, info }: { personaId: string; activa: boolean; info?: { cantidad: number; fallos: number } }) {
  const { pendiente, error, aviso, ejecutar } = useAccion();
  if (!activa) return null;

  const sinAvisos = !info || info.cantidad === 0;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-esp3 gap-y-1 text-xs">
      <span className={sinAvisos ? "text-texto-aviso" : info.fallos > 0 ? "text-texto-peligro" : "text-texto-exito"}>
        {sinAvisos
          ? "Sin avisos activados"
          : `Avisos en ${info.cantidad} dispositivo${info.cantidad === 1 ? "" : "s"}${info.fallos > 0 ? " · los últimos envíos han fallado" : ""}`}
      </span>
      {!sinAvisos && (
        <button
          disabled={pendiente}
          onClick={() =>
            ejecutar(async () => {
              const r = await desenvolver(enviarPruebaA(personaId));
              if (r.omitido) throw new Error(r.omitido);
              return r.enviadas > 0 ? "Prueba enviada." : "No se pudo entregar la prueba.";
            })
          }
          className="font-medium text-texto-marca disabled:opacity-50"
        >
          {pendiente ? "Enviando…" : "Enviar prueba"}
        </button>
      )}
      {aviso && <span className="text-texto-exito">{aviso}</span>}
      {error && <span className="text-texto-peligro">{error}</span>}
    </div>
  );
}
