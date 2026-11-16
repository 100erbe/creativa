"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { desenvolver } from "@/lib/accion";
import { MIN_CONTRASENA } from "@/lib/contrasena";
import { cambiarMiContrasena } from "./acciones";

export function FormularioContrasena({ pedirActual, inicio }: { pedirActual: boolean; inicio: string }) {
  const router = useRouter();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await desenvolver(cambiarMiContrasena({ actual, nueva, repetida }));
      setHecho(true);
      setActual("");
      setNueva("");
      setRepetida("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setCargando(false);
    }
  }

  if (hecho) {
    return (
      <div className="flex flex-col gap-esp4">
        <p className="rounded-md border border-borde-exito bg-fondo-exito-sutil px-esp3 py-esp2 text-sm text-texto-exito" role="status">
          Contraseña cambiada. La próxima vez entra con la nueva.
        </p>
        <Boton className="w-full" onClick={() => router.push(inicio)}>
          Continuar
        </Boton>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-esp4">
      {error && (
        <p className="rounded-md border border-borde-peligro-sutil bg-fondo-peligro-sutil px-esp3 py-esp2 text-sm text-texto-peligro">
          {error}
        </p>
      )}
      {pedirActual && (
        <Campo etiqueta="Contraseña actual" tipo="password" valor={actual} onCambio={setActual} requerido autoFocus />
      )}
      <Campo
        etiqueta="Contraseña nueva"
        tipo="password"
        valor={nueva}
        onCambio={setNueva}
        requerido
        autoFocus={!pedirActual}
        ayuda={`Al menos ${MIN_CONTRASENA} caracteres. Mejor una frase que solo tú recuerdes.`}
      />
      <Campo etiqueta="Repite la contraseña nueva" tipo="password" valor={repetida} onCambio={setRepetida} requerido />
      <Boton type="submit" cargando={cargando} className="mt-esp2 w-full" disabled={nueva.length < MIN_CONTRASENA}>
        Guardar contraseña
      </Boton>
    </form>
  );
}
