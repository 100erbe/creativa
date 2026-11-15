// En producción Next.js oculta el texto de los errores que lanza una Server Action
// ("An error occurred in the Server Components render…"), así que mensajes como
// "El importe supera lo pendiente" nunca llegarían a la pantalla. Las acciones
// devuelven un resultado explícito y el cliente lo "desenvuelve" para volver a
// lanzar el error con su mensaje original.

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

/** Errores de control de flujo de Next (redirect, notFound) que no deben capturarse. */
function esControlDeFlujo(e: unknown) {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"));
}

/** Servidor: envuelve el cuerpo de una Server Action para que devuelva `Resultado`. */
export function accion<A extends unknown[], T>(fn: (...args: A) => Promise<T>) {
  return async (...args: A): Promise<Resultado<T>> => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (e) {
      if (esControlDeFlujo(e)) throw e;
      return { ok: false, error: e instanceof Error && e.message ? e.message : "No se pudo completar la acción." };
    }
  };
}

/** Cliente: devuelve el dato o lanza un `Error` con el mensaje que mandó el servidor. */
export async function desenvolver<T>(resultado: Promise<Resultado<T>>): Promise<T> {
  const r = await resultado;
  if (!r.ok) throw new Error(r.error);
  return r.data;
}
