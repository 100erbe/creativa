import { obtenerUsuarioActual } from "@/lib/supabase/usuario";

/**
 * Para Server Actions: corta con un error claro si quien llama no es admin.
 * La RLS de la base de datos ya lo impone; esto evita depender solo de ella.
 */
export async function exigirAdmin() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "admin") {
    throw new Error("Solo un administrador puede hacer esto.");
  }
  return usuario;
}
