"use client";

import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { avisar } from "@/components/ui/dialogos";

// Eliminación optimista: el elemento desaparece de la pantalla en cuanto se confirma el borrado y la
// acción del servidor sigue en segundo plano. Si el servidor falla, el elemento vuelve a aparecer y
// se avisa con el mensaje de error.
//
// Uso:
//   <Ocultable clave={`campana:${c.id}`}> …fila o tarjeta… </Ocultable>
//   await eliminarOptimista(`campana:${id}`, () => desenvolver(eliminarCampana(id)));
//
// Las claves eliminadas con éxito se quedan ocultas: los datos nuevos del servidor ya no traen ese
// elemento, y así no reaparece un instante mientras llegan.

const ocultos = new Set<string>();
const escuchas = new Set<() => void>();
let version = 0;

function emitir() {
  version++;
  for (const f of escuchas) f();
}

function suscribir(f: () => void) {
  escuchas.add(f);
  return () => {
    escuchas.delete(f);
  };
}

/** `true` mientras el elemento con esa clave se está eliminando (o ya se eliminó). */
export function useOculto(clave: string) {
  return useSyncExternalStore(
    suscribir,
    () => ocultos.has(clave),
    () => false,
  );
}

/**
 * Quita de una lista los elementos que se están eliminando:
 *   const visibles = useSinOcultos(puntos, (p) => `punto:${p.id}`);
 */
export function useSinOcultos<T>(items: T[], clave: (item: T) => string): T[] {
  const v = useSyncExternalStore(
    suscribir,
    () => version,
    () => 0,
  );
  // `v` cambia cada vez que se oculta o se muestra algo: fuerza a recalcular la lista.
  return useMemo(
    () => (ocultos.size === 0 ? items : items.filter((i) => !ocultos.has(clave(i)))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, v],
  );
}

/** No pinta nada mientras su clave esté oculta. Sirve para envolver filas desde componentes de servidor. */
export function Ocultable({ clave, children }: { clave: string; children: ReactNode }) {
  return useOculto(clave) ? null : <>{children}</>;
}

/**
 * Oculta al instante las claves indicadas y ejecuta la acción. Devuelve `true` si fue bien; si falla,
 * vuelve a mostrar los elementos, avisa con el mensaje y devuelve `false`.
 */
export async function eliminarOptimista(
  clave: string | string[],
  accion: () => Promise<unknown>,
  { mensajeError = "No se pudo eliminar.", alFallar }: { mensajeError?: string; alFallar?: () => void } = {},
): Promise<boolean> {
  const claves = Array.isArray(clave) ? clave : [clave];
  for (const c of claves) ocultos.add(c);
  emitir();
  try {
    await accion();
    return true;
  } catch (e) {
    for (const c of claves) ocultos.delete(c);
    emitir();
    alFallar?.();
    void avisar(e instanceof Error ? e.message : mensajeError);
    return false;
  }
}
