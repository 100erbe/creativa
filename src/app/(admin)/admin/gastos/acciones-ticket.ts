"use server";

import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { accion } from "@/lib/accion";
import { aSugerencia, leerTicketGuardado } from "@/lib/ticket-ia";
import { rutaTicketConFormato, rutaTicketValida } from "@/lib/gastos";
import { exigirLimite } from "@/lib/limite-uso";
import { hoyEnEspana } from "./opciones";

/**
 * Lee con IA un ticket ya subido al bucket y devuelve los datos para precompilar el formulario.
 * El empleado solo puede leer sus propios tickets (lo comprueba aquí y la RLS del bucket).
 */
export const leerTicket = accion(async (ruta: string) => {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new Error("Tu sesión ha caducado. Vuelve a entrar.");
  if (typeof ruta !== "string") throw new Error("El archivo no es válido.");
  // Formato estricto (sin «..»); el empleado solo lee tickets de su propia carpeta.
  const valida = usuario.rol === "admin" ? rutaTicketConFormato(ruta) : rutaTicketValida(ruta, [usuario.id]);
  if (!valida) throw new Error("El archivo no es válido.");
  // Cada lectura llama a Gemini: límite por persona para que un bucle no agote la cuota.
  await exigirLimite(`ticket-ia:${usuario.id}`, 40, 3600, "Has leído muchos tickets seguidos. Espera un rato o rellena los datos a mano.");

  const supabase = await createClient();
  const { lectura, categorias } = await leerTicketGuardado(supabase, ruta);
  return aSugerencia(lectura, categorias, hoyEnEspana());
});
