"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/boton";
import { confirmar } from "@/components/ui/dialogos";
import { desenvolver } from "@/lib/accion";
import { cerrarOtrasSesiones } from "@/lib/cuenta/acciones";

/** Cierra la sesión en los demás móviles y ordenadores (este sigue abierto). */
export function CerrarOtrasSesiones() {
  const [estado, setEstado] = useState<"listo" | "cargando" | "hecho">("listo");
  const [error, setError] = useState<string | null>(null);

  async function cerrar() {
    const ok = await confirmar(
      "¿Cerrar la sesión en los demás dispositivos? Tendrás que volver a entrar en los otros móviles y ordenadores. Aquí sigues dentro.",
      { aceptar: "Cerrar las demás", peligro: false },
    );
    if (!ok) return;
    setError(null);
    setEstado("cargando");
    try {
      await desenvolver(cerrarOtrasSesiones());
      setEstado("hecho");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se han podido cerrar las sesiones.");
      setEstado("listo");
    }
  }

  return (
    <div className="flex flex-col items-start gap-esp2">
      <Boton variante="secundario" cargando={estado === "cargando"} disabled={estado === "hecho"} onClick={cerrar}>
        Cerrar en otros dispositivos
      </Boton>
      {estado === "hecho" && (
        <p role="status" className="animate-estado-entrar text-etiqueta text-texto-exito">
          Listo: las demás sesiones se han cerrado.
        </p>
      )}
      {error && (
        <p role="alert" className="text-etiqueta text-texto-peligro">
          {error}
        </p>
      )}
    </div>
  );
}
