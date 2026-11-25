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

const GENERICO = "No se pudo completar la acción.";

/**
 * Los mensajes escritos para la persona (en español) pasan tal cual. Los errores internos de
 * Postgres/PostgREST/red (nombres de tablas, columnas, restricciones…) no se enseñan: se registran
 * en el servidor y se muestra un texto genérico.
 */
export function mensajeSeguro(e: unknown): string {
  const texto = e instanceof Error ? e.message : "";
  if (!texto) return GENERICO;
  const interno =
    /violates|constraint|relation "|column "|syntax error|duplicate key|permission denied|row-level security|JWT|PGRST|invalid input syntax|null value in column|foreign key|does not exist|fetch failed|ECONN/i.test(
      texto,
    );
  if (!interno) return texto;
  console.error("[accion]", texto);
  if (/duplicate key/i.test(texto)) return "Ya existe un registro con esos datos.";
  if (/foreign key/i.test(texto)) return "No se puede completar: hay otros datos que dependen de este.";
  if (/row-level security|permission denied/i.test(texto)) return "No tienes permiso para hacer esto.";
  return GENERICO;
}

/** Servidor: envuelve el cuerpo de una Server Action para que devuelva `Resultado`. */
export function accion<A extends unknown[], T>(fn: (...args: A) => Promise<T>) {
  return async (...args: A): Promise<Resultado<T>> => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (e) {
      if (esControlDeFlujo(e)) throw e;
      return { ok: false, error: mensajeSeguro(e) };
    }
  };
}

/** Cliente: devuelve el dato o lanza un `Error` con el mensaje que mandó el servidor. */
export async function desenvolver<T>(resultado: Promise<Resultado<T>>): Promise<T> {
  const r = await resultado;
  if (!r.ok) throw new Error(r.error);
  return r.data;
}
