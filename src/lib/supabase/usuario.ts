import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Rol = "admin" | "empleado";

export type UsuarioActual = {
  id: string;
  nombre: string;
  apellidos: string | null;
  email: string;
  rol: Rol;
  avatarUrl: string | null;
};

/**
 * Devuelve el usuario autenticado junto con su fila en `public.usuarios`
 * (donde vive el rol admin/empleado), o null si no hay sesión o la cuenta
 * está desactivada. Pensado para Server Components, Route Handlers y Server Actions.
 */
export const obtenerUsuarioActual = cache(async function obtenerUsuarioActual(): Promise<UsuarioActual | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: fila, error } = await supabase
    .from("usuarios")
    .select("id, nombre, apellidos, email, rol, avatar_url, activo")
    .eq("id", user.id)
    .single();

  // Una cuenta desactivada no cuenta como sesión válida aunque su token siga vivo.
  if (error || !fila || !fila.activo) return null;

  return {
    id: fila.id,
    nombre: fila.nombre,
    apellidos: fila.apellidos,
    email: fila.email,
    rol: fila.rol,
    avatarUrl: fila.avatar_url,
  };
});
