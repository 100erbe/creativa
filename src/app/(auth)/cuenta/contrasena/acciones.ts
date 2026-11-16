"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { accion } from "@/lib/accion";
import { errorContrasena } from "@/lib/contrasena";
import { COOKIE_RECUPERACION, esRecuperacionValida } from "@/lib/recuperacion";

/**
 * Cambia la contraseña de la propia persona. Fuera de la recuperación por email se pide la
 * actual: una sesión abierta en un móvil prestado no basta para quedarse con la cuenta.
 */
export const cambiarMiContrasena = accion(async (datos: { actual: string; nueva: string; repetida: string }) => {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new Error("Tu sesión ha caducado. Vuelve a entrar.");

  const errorNueva = errorContrasena(datos.nueva);
  if (errorNueva) throw new Error(errorNueva);
  if (datos.nueva !== datos.repetida) throw new Error("Las dos contraseñas nuevas no coinciden.");

  const almacen = await cookies();
  const vieneDeRecuperacion = esRecuperacionValida(almacen.get(COOKIE_RECUPERACION)?.value, usuario.id);
  const supabase = await createClient();

  if (!vieneDeRecuperacion) {
    if (!datos.actual) throw new Error("Escribe tu contraseña actual.");
    const { error: errorActual } = await supabase.auth.signInWithPassword({
      email: usuario.email,
      password: datos.actual,
    });
    if (errorActual) throw new Error("La contraseña actual no es correcta.");
  }

  const { error } = await supabase.auth.updateUser({ password: datos.nueva });
  if (error) {
    if (/different|same/i.test(error.message)) throw new Error("La contraseña nueva tiene que ser distinta de la actual.");
    if (/weak|pwned|leaked/i.test(error.message)) {
      throw new Error("Esa contraseña es demasiado débil o ha aparecido en filtraciones: elige otra.");
    }
    throw new Error(error.message);
  }

  almacen.delete(COOKIE_RECUPERACION);
});
