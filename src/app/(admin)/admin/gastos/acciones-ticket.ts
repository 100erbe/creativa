"use server";

import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { accion } from "@/lib/accion";
import { aSugerencia, leerTicketGuardado } from "@/lib/ticket-ia";
import { hoyEnEspana } from "./opciones";

/**
 * Lee con IA un ticket ya subido al bucket y devuelve los datos para precompilar el formulario.
 * El empleado solo puede leer sus propios tickets (lo comprueba aquí y la RLS del bucket).
 */
export const leerTicket = accion(async (ruta: string) => {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new Error("Tu sesión ha caducado. Vuelve a entrar.");
  if (usuario.rol !== "admin" && !ruta.startsWith(`${usuario.id}/`)) throw new Error("El archivo no es válido.");

  const supabase = await createClient();
  const { lectura, categorias } = await leerTicketGuardado(supabase, ruta);
  return aSugerencia(lectura, categorias, hoyEnEspana());
});
