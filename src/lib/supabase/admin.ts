import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Cliente con la service_role key: se salta la RLS. SOLO para código de
 * servidor (Route Handlers / Server Actions) y siempre detrás de una
 * comprobación propia (p. ej. validar el token del cliente).
 * La variable NO lleva el prefijo NEXT_PUBLIC_, así que nunca llega al navegador.
 * Devuelve null si no está configurada, para degradar sin romper la página.
 */
export function crearClienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return null;

  return createClient<Database>(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
