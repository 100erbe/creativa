"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { accion } from "@/lib/accion";
import { errorContrasena } from "@/lib/contrasena";

function refrescar() {
  revalidatePath("/admin/ajustes/equipo");
}

const ROLES = ["admin", "empleado"] as const;

/** «Ban» de Supabase Auth sin fecha de fin práctica (100 años). */
const BLOQUEO_INDEFINIDO = "876000h";
type Rol = (typeof ROLES)[number];

const esquemaPersona = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  apellidos: z.string().trim(),
  telefono: z.string().trim(),
  rol: z.enum(ROLES, { errorMap: () => ({ message: "Rol no válido." }) }),
});

const esquemaAlta = esquemaPersona.extend({
  email: z.string().trim().toLowerCase().email("El email no es válido."),
  password: z.string().superRefine((p, ctx) => {
    const error = errorContrasena(p);
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
  }),
});

function clienteAdmin() {
  const admin = crearClienteAdmin();
  if (!admin) throw new Error("Falta la clave de servicio de Supabase (SUPABASE_SERVICE_ROLE_KEY) en el servidor.");
  return admin;
}

/** Cuántos administradores activos hay, sin contar a `excepto`. */
async function otrosAdminsActivos(excepto: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("usuarios")
    .select("id", { count: "exact", head: true })
    .eq("rol", "admin")
    .eq("activo", true)
    .neq("id", excepto);
  return count ?? 0;
}

/**
 * Da de alta a una persona: crea su cuenta de acceso (email + contraseña) y su perfil.
 * La contraseña la eliges tú y se la das a la persona; puede cambiarla cuando quiera.
 */
export const crearPersona = accion(
  async (datos: { nombre: string; apellidos: string; email: string; telefono: string; rol: string; password: string }) => {
    await exigirAdmin();
    const analisis = esquemaAlta.safeParse(datos);
    if (!analisis.success) throw new Error(analisis.error.issues[0]?.message ?? "Revisa los datos.");
    const d = analisis.data;
    const admin = clienteAdmin();

    const { data: creado, error: errorAuth } = await admin.auth.admin.createUser({
      email: d.email,
      password: d.password,
      email_confirm: true,
    });
    if (errorAuth || !creado.user) {
      const yaExiste = /already|registered|exists/i.test(errorAuth?.message ?? "");
      throw new Error(yaExiste ? "Ya hay una cuenta con ese email." : (errorAuth?.message ?? "No se pudo crear la cuenta."));
    }

    const { error } = await admin.from("usuarios").insert({
      id: creado.user.id,
      nombre: d.nombre,
      apellidos: d.apellidos || null,
      email: d.email,
      telefono: d.telefono || null,
      rol: d.rol as Rol,
    });
    if (error) {
      // No dejar una cuenta de acceso sin perfil: sería un usuario "fantasma" que no puede entrar.
      await admin.auth.admin.deleteUser(creado.user.id);
      throw new Error(error.message);
    }

    refrescar();
  },
);

/** Nombre, teléfono, rol y estado. El email no se cambia aquí: es la identidad de la cuenta. */
export const actualizarPersona = accion(
  async (id: string, datos: { nombre: string; apellidos: string; telefono: string; rol: string; activo: boolean }) => {
    const yo = await exigirAdmin();
    const analisis = esquemaPersona.safeParse(datos);
    if (!analisis.success) throw new Error(analisis.error.issues[0]?.message ?? "Revisa los datos.");
    const d = analisis.data;
    const supabase = await createClient();

    const { data: actual } = await supabase.from("usuarios").select("rol, activo").eq("id", id).maybeSingle();
    if (!actual) throw new Error("No se ha encontrado a la persona.");

    if (id === yo.id && (d.rol !== actual.rol || datos.activo !== actual.activo)) {
      throw new Error("No puedes cambiar tu propio rol ni desactivarte: pídeselo a otra persona administradora.");
    }
    const dejaDeSerAdminActivo = actual.rol === "admin" && actual.activo && (d.rol !== "admin" || !datos.activo);
    if (dejaDeSerAdminActivo && (await otrosAdminsActivos(id)) === 0) {
      throw new Error("Tiene que quedar al menos una persona administradora activa.");
    }

    const { error } = await supabase
      .from("usuarios")
      .update({
        nombre: d.nombre,
        apellidos: d.apellidos || null,
        telefono: d.telefono || null,
        rol: d.rol,
        activo: datos.activo,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    // Desactivar no basta con la fila de `usuarios`: se bloquea también la cuenta de acceso
    // y se cierran sus sesiones abiertas. Al reactivarla se desbloquea.
    if (datos.activo !== actual.activo) {
      await bloquearAcceso(id, !datos.activo);
    }

    refrescar();
  },
);

/** Bloquea (ban indefinido + cierre de sesiones) o desbloquea la cuenta de acceso en Supabase Auth. */
async function bloquearAcceso(id: string, bloquear: boolean) {
  const admin = clienteAdmin();
  const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: bloquear ? BLOQUEO_INDEFINIDO : "none" });
  if (error) {
    throw new Error(
      bloquear
        ? `La persona queda desactivada en la app, pero no se pudo bloquear su acceso: ${error.message}`
        : `La persona queda activa en la app, pero no se pudo desbloquear su acceso: ${error.message}`,
    );
  }
  if (bloquear) {
    const { error: errorSesiones } = await admin.rpc("cerrar_sesiones_usuario", { p_usuario: id });
    if (errorSesiones) throw new Error(`Acceso bloqueado, pero no se pudieron cerrar sus sesiones: ${errorSesiones.message}`);
  }
}

/** Para quien olvidó su contraseña: se le fija una nueva y se le comunica. */
export const cambiarContrasena = accion(async (id: string, password: string) => {
  const admin = await exigirAdmin();
  const errorPassword = errorContrasena(password);
  if (errorPassword) throw new Error(errorPassword);
  const supabase = await createClient();
  const { data: persona } = await supabase.from("usuarios").select("id").eq("id", id).maybeSingle();
  if (!persona) throw new Error("No se ha encontrado a la persona.");

  const servicio = clienteAdmin();
  const { error } = await servicio.auth.admin.updateUserById(id, { password });
  if (error) throw new Error(error.message);

  // Con la contraseña nueva se cierran sus sesiones abiertas (quien tuviera la antigua queda fuera).
  if (id !== admin.id) {
    const { error: errorSesiones } = await servicio.rpc("cerrar_sesiones_usuario", { p_usuario: id });
    if (errorSesiones) throw new Error(`Contraseña cambiada, pero no se pudieron cerrar sus sesiones: ${errorSesiones.message}`);
  }
});
