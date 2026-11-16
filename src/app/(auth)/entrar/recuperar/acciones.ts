"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { accion } from "@/lib/accion";

/**
 * Envía el email de recuperación. La respuesta es siempre la misma, exista o no la cuenta,
 * para no revelar qué correos están dados de alta.
 */
export const solicitarRecuperacion = accion(async (email: string) => {
  const analisis = z.string().trim().toLowerCase().email().safeParse(email);
  if (!analisis.success) throw new Error("Escribe un correo electrónico válido.");

  // Dirección pública de la app: la variable si está definida; si no, el origen de esta petición
  // (Supabase solo acepta las URL de su lista «Redirect URLs»; cualquier otra la ignora).
  const cabeceras = await headers();
  const origen = process.env.NEXT_PUBLIC_SITE_URL ?? cabeceras.get("origin") ?? "";
  if (!origen) throw new Error("No se pudo preparar el enlace. Inténtalo de nuevo.");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(analisis.data, {
    redirectTo: `${origen.replace(/\/$/, "")}/auth/confirmar`,
  });
  // Límite de envíos de Supabase: se avisa; cualquier otro error se calla (no se revela nada).
  if (error && /rate|limit|seconds/i.test(error.message)) {
    throw new Error("Has pedido demasiados enlaces seguidos. Espera unos minutos y vuelve a probar.");
  }
});
