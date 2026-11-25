/**
 * Dirección pública de la app (sin barra final), para enlaces que salen de ella: emails de
 * recuperación, enlaces de campaña para el cliente, retorno de OAuth…
 *
 * Nunca se toma de la petición (cabecera Origin/Host), que la puede falsear quien llama.
 * Orden: NEXT_PUBLIC_SITE_URL → dominio de producción que Vercel define solo
 * (VERCEL_PROJECT_PRODUCTION_URL) → en el navegador, la dirección actual → null.
 * Funciona en servidor y en cliente (las NEXT_PUBLIC_* se incrustan al compilar).
 */
export function urlPublicaApp(): string | null {
  const explicita = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicita) return explicita.replace(/\/$/, "");
  const vercel = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  return null;
}
