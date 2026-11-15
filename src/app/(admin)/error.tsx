"use client";

import { useEffect } from "react";
import { Boton } from "@/components/ui/boton";

export default function ErrorAdmin({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-esp4 py-esp8 text-center">
      <h1 className="text-xl font-semibold text-texto-primario">No se han podido cargar los datos</h1>
      <p className="text-sm text-texto-secundario">
        Ha habido un problema al consultar la información. Tus datos no se han perdido: prueba de nuevo y, si
        sigue fallando, avisa a quien administra la app.
      </p>
      {error.digest && <p className="text-xs text-texto-terciario">Código: {error.digest}</p>}
      <Boton onClick={reset}>Reintentar</Boton>
    </div>
  );
}
