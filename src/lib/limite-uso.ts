import "server-only";
import { crearClienteAdmin } from "@/lib/supabase/admin";

/**
 * Límite de uso por persona y acción (tabla limites_uso, migración 0047). Protege lo que cuesta
 * dinero o molesta a terceros: lectura de tickets con IA, push de prueba, emails de recuperación.
 *
 * Lanza un error legible si se supera. Si el servidor no tiene la clave de servicio (desarrollo)
 * o la base de datos no responde, deja pasar: el límite nunca bloquea el trabajo normal por un fallo suyo.
 */
export async function exigirLimite(clave: string, max: number, segundos: number, mensaje: string) {
  const admin = crearClienteAdmin();
  if (!admin) return;
  const { data, error } = await admin.rpc("consumir_limite", { p_clave: clave, p_max: max, p_segundos: segundos });
  if (error) {
    console.warn(`[limite-uso] ${clave}: ${error.message}`);
    return;
  }
  if (data === false) throw new Error(mensaje);
}
