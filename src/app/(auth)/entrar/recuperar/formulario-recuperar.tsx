"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { desenvolver } from "@/lib/accion";
import { solicitarRecuperacion } from "./acciones";

export function FormularioRecuperar({ enlaceCaducado }: { enlaceCaducado: boolean }) {
  const [email, setEmail] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await desenvolver(solicitarRecuperacion(email));
      setEnviado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el enlace.");
    } finally {
      setCargando(false);
    }
  }

  if (enviado) {
    return (
      <p className="rounded-md border border-borde-exito bg-fondo-exito-sutil px-esp3 py-esp2 text-sm text-texto-exito" role="status">
        Si ese correo tiene cuenta en Creativa, te llegará un enlace en unos minutos. Ábrelo en este mismo dispositivo
        y navegador. Revisa también la carpeta de spam.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-esp4">
      {enlaceCaducado && !error && (
        <p className="rounded-md border border-borde-peligro-sutil bg-fondo-peligro-sutil px-esp3 py-esp2 text-sm text-texto-peligro">
          El enlace no es válido o ha caducado. Pide uno nuevo.
        </p>
      )}
      {error && (
        <p className="rounded-md border border-borde-peligro-sutil bg-fondo-peligro-sutil px-esp3 py-esp2 text-sm text-texto-peligro">
          {error}
        </p>
      )}
      <Campo etiqueta="Correo electrónico" tipo="email" valor={email} onCambio={setEmail} autoFocus requerido />
      <Boton type="submit" cargando={cargando} className="w-full">
        Enviar enlace
      </Boton>
    </form>
  );
}
