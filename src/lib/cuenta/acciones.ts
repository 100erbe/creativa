"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { accion } from "@/lib/accion";
import { normalizarTelefono } from "@/lib/perfil";
import { BUCKET_AVATARES } from "@/lib/avatar-ruta";

// Acciones de «Mi cuenta» (administración y app del empleado). Todas actúan solo sobre la
// propia persona: la política de `usuarios` deja cambiar la fila propia salvo rol, estado y email.

function refrescarCuenta() {
  // El nombre y la foto aparecen en la barra lateral, la cabecera del empleado y el saludo del Resumen.
  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");
}

async function exigirUsuario() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new Error("Tu sesión ha caducado. Vuelve a entrar.");
  return usuario;
}

/** Guarda nombre, apellidos y teléfono. */
export const actualizarMiPerfil = accion(async (datos: { nombre: string; apellidos: string; telefono: string }) => {
  const usuario = await exigirUsuario();

  const nombre = datos.nombre.trim().replace(/\s+/g, " ");
  const apellidos = datos.apellidos.trim().replace(/\s+/g, " ");
  if (!nombre) throw new Error("El nombre es obligatorio.");
  if (nombre.length > 60) throw new Error("El nombre no puede tener más de 60 caracteres.");
  if (apellidos.length > 80) throw new Error("Los apellidos no pueden tener más de 80 caracteres.");

  const telefono = datos.telefono.trim() ? normalizarTelefono(datos.telefono) : null;
  if (datos.telefono.trim() && !telefono) {
    throw new Error("El teléfono no es válido: escribe 9 cifras o el prefijo internacional (+34…).");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("usuarios")
    .update({ nombre, apellidos: apellidos || null, telefono })
    .eq("id", usuario.id);
  if (error) throw new Error("No se han podido guardar los cambios. Inténtalo de nuevo.");
  refrescarCuenta();
});

/**
 * Apunta la foto de perfil a un archivo ya subido (desde el navegador) a la carpeta propia
 * del bucket y borra la foto anterior. `ruta` debe empezar por el id de la persona.
 */
export const guardarMiAvatar = accion(async (ruta: string) => {
  const usuario = await exigirUsuario();
  if (!new RegExp(`^${usuario.id}/avatar-\\d+\\.(webp|jpg)$`).test(ruta)) throw new Error("Archivo de foto no válido.");

  const supabase = await createClient();
  const anterior = usuario.avatarUrl;
  const { error } = await supabase.from("usuarios").update({ avatar_url: ruta }).eq("id", usuario.id);
  if (error) throw new Error("No se ha podido guardar la foto.");
  if (anterior && anterior !== ruta && anterior.startsWith(`${usuario.id}/`)) {
    await supabase.storage.from(BUCKET_AVATARES).remove([anterior]);
  }
  refrescarCuenta();
});

/** Quita la foto de perfil (vuelven las iniciales). */
export const quitarMiAvatar = accion(async () => {
  const usuario = await exigirUsuario();
  const supabase = await createClient();
  const { error } = await supabase.from("usuarios").update({ avatar_url: null }).eq("id", usuario.id);
  if (error) throw new Error("No se ha podido quitar la foto.");
  if (usuario.avatarUrl?.startsWith(`${usuario.id}/`)) {
    await supabase.storage.from(BUCKET_AVATARES).remove([usuario.avatarUrl]);
  }
  refrescarCuenta();
});

/** Cierra la sesión en todos los demás dispositivos; este sigue abierto. */
export const cerrarOtrasSesiones = accion(async () => {
  await exigirUsuario();
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) throw new Error("No se han podido cerrar las otras sesiones. Inténtalo de nuevo.");
});
