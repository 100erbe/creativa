"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Ejecuta una acción del servidor mostrando "cargando" y el mensaje de error si falla.
 * Con `refrescar: true` recarga los datos de la página cuando termina bien.
 *
 *   const { pendiente, error, ejecutar } = useAccion({ refrescar: true });
 *   ejecutar(() => desenvolver(miAccion(id)));
 */
export function useAccion({ refrescar = false }: { refrescar?: boolean } = {}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function ejecutar(accion: () => Promise<void>) {
    setError(null);
    iniciar(async () => {
      try {
        await accion();
        if (refrescar) router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
      }
    });
  }

  return { router, pendiente, error, setError, ejecutar };
}
