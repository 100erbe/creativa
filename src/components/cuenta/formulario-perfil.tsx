"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { desenvolver } from "@/lib/accion";
import { useAccion } from "@/lib/use-accion";
import { normalizarTelefono } from "@/lib/perfil";
import { actualizarMiPerfil } from "@/lib/cuenta/acciones";

export function FormularioPerfil({
  inicial,
}: {
  inicial: { nombre: string; apellidos: string; telefono: string };
}) {
  const [nombre, setNombre] = useState(inicial.nombre);
  const [apellidos, setApellidos] = useState(inicial.apellidos);
  const [telefono, setTelefono] = useState(inicial.telefono);
  const [guardado, setGuardado] = useState(false);
  const { pendiente, error, ejecutar } = useAccion({ refrescar: true });

  const errorTelefono = telefono.trim() && !normalizarTelefono(telefono) ? "Escribe 9 cifras o el prefijo internacional (+34…)." : undefined;
  const cambiado = nombre !== inicial.nombre || apellidos !== inicial.apellidos || telefono !== inicial.telefono;

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardado(false);
    ejecutar(async () => {
      await desenvolver(actualizarMiPerfil({ nombre, apellidos, telefono }));
      const normalizado = telefono.trim() ? (normalizarTelefono(telefono) ?? telefono) : "";
      setTelefono(normalizado);
      setGuardado(true);
    });
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-esp4" noValidate>
      {error && (
        <p role="alert" className="rounded-lg bg-fondo-peligro-sutil px-esp4 py-esp3 text-meta font-medium text-texto-peligro">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-esp4 sm:grid-cols-2">
        <Campo
          etiqueta="Nombre"
          valor={nombre}
          onCambio={(v) => {
            setNombre(v);
            setGuardado(false);
          }}
          requerido
          autoCompletar="given-name"
          maxLength={60}
          error={nombre.trim() ? undefined : "El nombre es obligatorio."}
        />
        <Campo
          etiqueta="Apellidos"
          valor={apellidos}
          onCambio={(v) => {
            setApellidos(v);
            setGuardado(false);
          }}
          autoCompletar="family-name"
          maxLength={80}
        />
      </div>
      <Campo
        etiqueta="Teléfono"
        tipo="tel"
        valor={telefono}
        onCambio={(v) => {
          setTelefono(v);
          setGuardado(false);
        }}
        autoCompletar="tel"
        inputMode="tel"
        placeholder="600 123 456"
        error={errorTelefono}
        ayuda="Opcional. Lo ve el equipo para poder contactarte."
        className="sm:max-w-[calc(50%-8px)]"
      />
      <div className="flex flex-wrap items-center gap-esp3">
        <Boton type="submit" cargando={pendiente} disabled={!cambiado || !nombre.trim() || !!errorTelefono}>
          Guardar cambios
        </Boton>
        {guardado && !cambiado && (
          <p role="status" className="animate-estado-entrar text-etiqueta text-texto-exito">
            Cambios guardados
          </p>
        )}
      </div>
    </form>
  );
}
