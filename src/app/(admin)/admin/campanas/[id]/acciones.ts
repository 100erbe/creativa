"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";

// La RLS ya limita estas tablas al admin; se comprueba también aquí para dar
// un error claro y no depender solo de la base de datos.
async function exigirAdmin() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "admin") {
    throw new Error("Solo un administrador puede hacer esto.");
  }
  return usuario;
}

function refrescar(campanaId: number) {
  revalidatePath(`/admin/campanas/${campanaId}`);
  revalidatePath("/admin/campanas");
}

export async function asignarPunto(campanaId: number, puntoId: number, usuarioId: string) {
  await exigirAdmin();
  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("asignaciones_punto")
    .select("id")
    .eq("punto_id", puntoId)
    .eq("usuario_id", usuarioId)
    .in("estado", ["pendiente", "en_curso"])
    .limit(1);
  if (existente && existente.length > 0) return; // ya tiene este punto asignado

  const { error } = await supabase
    .from("asignaciones_punto")
    .insert({ punto_id: puntoId, usuario_id: usuarioId, estado: "pendiente" });
  if (error) throw new Error(error.message);

  refrescar(campanaId);
}

export async function quitarAsignacion(campanaId: number, asignacionId: number) {
  await exigirAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("asignaciones_punto").delete().eq("id", asignacionId);
  if (error) throw new Error(error.message);

  refrescar(campanaId);
}

export async function verificarPunto(campanaId: number, puntoId: number) {
  await exigirAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("puntos_campana")
    .update({ estado: "verificado" })
    .eq("id", puntoId);
  if (error) throw new Error(error.message);

  refrescar(campanaId);
}

export async function crearEnlaceCliente(campanaId: number) {
  const admin = await exigirAdmin();
  const supabase = await createClient();

  const expira = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("enlaces_cliente")
    .insert({ campana_id: campanaId, creado_por: admin.id, expira_en: expira });
  if (error) throw new Error(error.message);

  refrescar(campanaId);
}
