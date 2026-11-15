/**
 * Las consultas de Supabase no lanzan: devuelven `{ data: null, error }`. Con `data ?? []`
 * un fallo (red, permisos, columna que falta) acabaría pareciendo "no hay datos". Esto lo
 * convierte en un error de verdad, que recoge el `error.tsx` de la sección.
 */
export function lanzarSiError(...resultados: { error: { message: string } | null; data?: unknown }[]) {
  const fallo = resultados.find((r) => r.error)?.error;
  if (fallo) throw new Error(fallo.message);
}
