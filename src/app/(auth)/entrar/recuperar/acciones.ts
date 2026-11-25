"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { accion } from "@/lib/accion";
import { urlPublicaApp } from "@/lib/url-publica";

/**
 * Envía el email de recuperación. La respuesta es siempre la misma, exista o no la cuenta,
 * para no revelar qué correos están dados de alta.
 */
export const solicitarRecuperacion = accion(async (email: string) => {
  const analisis = z.string().trim().toLowerCase().email().safeParse(email);
  if (!analisis.success) throw new Error("Escribe un correo electrónico válido.");

  // Dirección pública fija de la app (nunca la cabecera Origin de la petición).
  // Supabase además solo acepta las URL de su lista «Redirect URLs».
  const origen = urlPublicaApp();
  if (!origen) throw new Error("No se pudo preparar el enlace. Inténtalo de nuevo.");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(analisis.data, {
    redirectTo: `${origen}/auth/confirmar`,
  });
  // Límite de envíos de Supabase: se avisa; cualquier otro error se calla (no se revela nada).
  if (error && /rate|limit|seconds/i.test(error.message)) {
    throw new Error("Has pedido demasiados enlaces seguidos. Espera unos minutos y vuelve a probar.");
  }
});
