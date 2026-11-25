"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Último recurso: un fallo en el propio layout raíz. Sustituye a todo el documento,
 * por eso lleva su propio <html> y no depende de ningún componente de la app.
 */
export default function ErrorGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="bg-fondo-lienzo">
        <main className="flex min-h-dvh flex-col items-center justify-center gap-esp4 px-esp4 text-center">
          <h1 className="text-2xl font-bold text-texto-primario">Algo no ha ido bien</h1>
          <p className="max-w-sm text-sm text-texto-secundario">
            La aplicación no ha podido cargarse. Prueba de nuevo y, si sigue fallando, avisa a quien la administra.
          </p>
          {error.digest && <p className="text-xs text-texto-terciario">Código: {error.digest}</p>}
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-lg bg-fondo-marca px-esp4 text-etiqueta text-texto-sobre-marca"
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
