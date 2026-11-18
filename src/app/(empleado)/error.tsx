"use client";

import { useEffect } from "react";
import { Boton } from "@/components/ui/boton";

export default function ErrorEmpleado({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-esp4 px-esp4 py-esp8 text-center">
      <h1 className="text-titulo-panel text-texto-primario">No se han podido cargar tus puntos</h1>
      <p className="text-sm text-texto-secundario">
        Comprueba que tienes cobertura y vuelve a intentarlo. Lo que ya hayas subido está guardado.
      </p>
      <Boton onClick={reset}>Reintentar</Boton>
    </div>
  );
}
