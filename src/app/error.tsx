"use client";

import { useEffect } from "react";
import { Logo } from "@/components/ui/logo";
import { Boton } from "@/components/ui/boton";

/** Error en las páginas fuera del admin y de la app del equipo (acceso, enlace público de campaña…). */
export default function ErrorGeneral({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-esp5 bg-fondo-lienzo px-esp4 text-center">
      <Logo alto={44} />
      <div className="flex max-w-sm flex-col gap-esp2">
        <h1 className="text-2xl font-bold text-texto-primario">Algo no ha ido bien</h1>
        <p className="text-sm text-texto-secundario">
          No hemos podido cargar esta página. Prueba de nuevo en unos segundos.
        </p>
        {error.digest && <p className="text-xs text-texto-terciario">Código: {error.digest}</p>}
      </div>
      <Boton onClick={reset}>Reintentar</Boton>
    </main>
  );
}
