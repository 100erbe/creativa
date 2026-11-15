"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { accion } from "@/lib/accion";

function refrescar() {
  revalidatePath("/admin/ajustes/equipo");
}

const ROLES = ["admin", "empleado"] as const;
type Rol = (typeof ROLES)[number];

const esquemaPersona = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  apellidos: z.string().trim(),
  telefono: z.string().trim(),
  rol: z.enum(ROLES, { errorMap: () => ({ message: "Rol no válido." }) }),
});

const esquemaAlta = esquemaPersona.extend({
  email: z.string().trim().toLowerCase().email("El email no es válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
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

    refrescar();
  },
);

/** Para quien olvidó su contraseña: se le fija una nueva y se le comunica. */
export const cambiarContrasena = accion(async (id: string, password: string) => {
  await exigirAdmin();
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  const supabase = await createClient();
  const { data: persona } = await supabase.from("usuarios").select("id").eq("id", id).maybeSingle();
  if (!persona) throw new Error("No se ha encontrado a la persona.");

  const { error } = await clienteAdmin().auth.admin.updateUserById(id, { password });
  if (error) throw new Error(error.message);
});
