"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { accion } from "@/lib/accion";
import { envioRealPermitido } from "@/lib/push/enviar";
import { dispositivosPorPersona, enviarAviso } from "./enviar";

function refrescar(avisoId?: number) {
  revalidatePath("/admin/avisos");
  if (avisoId) revalidatePath(`/admin/avisos/${avisoId}`);
  revalidatePath("/app/avisos");
}

export type ResultadoCreacion = { id: number; destinatarios: number; sinDispositivo: string[] };

/** Crea un aviso, lo envía a las personas elegidas y devuelve a quién no puede llegarle por push. */
export const crearAviso = accion(
  async (datos: { titulo: string; cuerpo: string; urgente: boolean; destinatarios: string[] }): Promise<ResultadoCreacion> => {
    const admin = await exigirAdmin();
    const titulo = datos.titulo.trim();
    const cuerpo = datos.cuerpo.trim();
    if (!titulo) throw new Error("Escribe un título.");
    if (titulo.length > 80) throw new Error("El título es demasiado largo (máximo 80 caracteres).");
    if (!cuerpo) throw new Error("Escribe el mensaje.");
    if (cuerpo.length > 600) throw new Error("El mensaje es demasiado largo (máximo 600 caracteres).");
    const ids = [...new Set(datos.destinatarios)];
    if (ids.length === 0) throw new Error("Elige al menos una persona.");
    if (ids.length > 200) throw new Error("Demasiados destinatarios.");

    // Los avisos reales solo se crean donde también se envían: un aviso creado desde local o desde una preview
    // aparecería en la app de la gente sin haberles llegado, y los recordatorios automáticos lo reclamarían.
    if (!envioRealPermitido()) {
      throw new Error("Los avisos solo se pueden crear desde la web publicada (producción).");
    }

    const supabase = await createClient();
    const { data: personas, error: errorPersonas } = await supabase
      .from("usuarios")
      .select("id, nombre")
      .in("id", ids)
      .eq("activo", true);
    if (errorPersonas) throw new Error(errorPersonas.message);
    if ((personas ?? []).length !== ids.length) throw new Error("Alguna de las personas elegidas ya no está activa.");

    const { data: aviso, error } = await supabase
      .from("avisos")
      .insert({ titulo, cuerpo, urgente: datos.urgente, creado_por: admin.id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: errorDest } = await supabase
      .from("avisos_destinatarios")
      .insert(ids.map((usuario_id) => ({ aviso_id: aviso.id, usuario_id })));
    if (errorDest) {
      await supabase.from("avisos").delete().eq("id", aviso.id);
      throw new Error(errorDest.message);
    }

    await enviarAviso(aviso.id, ids, { recordatorio: false });

    const dispositivos = await dispositivosPorPersona(ids);
    const sinDispositivo = (personas ?? []).filter((p) => !dispositivos[p.id]).map((p) => p.nombre);

    refrescar(aviso.id);
    return { id: aviso.id, destinatarios: ids.length, sinDispositivo };
  },
);

/** Vuelve a enviar el aviso ahora a quien aún no lo ha confirmado (o a las personas indicadas). */
export const reenviarAviso = accion(async (avisoId: number, usuarioIds?: string[]) => {
  await exigirAdmin();
  if (!envioRealPermitido()) throw new Error("Los avisos solo se envían desde la web publicada (producción).");
  const supabase = await createClient();

  let consulta = supabase.from("avisos_destinatarios").select("usuario_id").eq("aviso_id", avisoId).is("confirmado_en", null);
  if (usuarioIds && usuarioIds.length > 0) consulta = consulta.in("usuario_id", usuarioIds);
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);

  const ids = (data ?? []).map((d) => d.usuario_id);
  if (ids.length === 0) throw new Error("Todos han confirmado ya.");
  await enviarAviso(avisoId, ids, { recordatorio: true });

  // Un reenvío manual reinicia la cuenta de recordatorios automáticos de esas personas.
  const admin = crearClienteAdmin();
  await admin?.from("avisos_destinatarios").update({ envios: 1, escalado_en: null }).eq("aviso_id", avisoId).in("usuario_id", ids);

  refrescar(avisoId);
  return ids.length;
});

/** Cierra el aviso: se detienen los recordatorios (por ejemplo, porque ya se resolvió por teléfono). */
export const cerrarAviso = accion(async (avisoId: number) => {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("avisos").update({ cerrado_en: new Date().toISOString() }).eq("id", avisoId).is("cerrado_en", null);
  if (error) throw new Error(error.message);
  refrescar(avisoId);
});

/** La persona abre el aviso: se anota que lo ha visto (sin confirmar todavía). */
export const marcarAvisoLeido = accion(async (avisoId: number) => {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return;
  const admin = crearClienteAdmin();
  if (!admin) return;
  await admin
    .from("avisos_destinatarios")
    .update({ leido_en: new Date().toISOString() })
    .eq("aviso_id", avisoId)
    .eq("usuario_id", usuario.id)
    .is("leido_en", null);
  revalidatePath(`/admin/avisos/${avisoId}`);
});

/** La persona confirma que ha leído y entendido el aviso: se detienen sus recordatorios. */
export const confirmarAviso = accion(async (avisoId: number) => {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new Error("Sesión no válida.");
  const admin = crearClienteAdmin();
  if (!admin) throw new Error("Falta la clave de servicio de Supabase en el servidor.");

  const ahora = new Date().toISOString();
  const { data, error } = await admin
    .from("avisos_destinatarios")
    .update({ confirmado_en: ahora, leido_en: ahora })
    .eq("aviso_id", avisoId)
    .eq("usuario_id", usuario.id)
    .is("confirmado_en", null)
    .select("aviso_id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    // Ya estaba confirmado, o el aviso no es suyo: se comprueba para dar el error correcto.
    const { data: existente } = await admin
      .from("avisos_destinatarios")
      .select("confirmado_en")
      .eq("aviso_id", avisoId)
      .eq("usuario_id", usuario.id)
      .maybeSingle();
    if (!existente) throw new Error("Este aviso no es para ti.");
  }

  revalidatePath("/app/avisos");
  revalidatePath(`/app/avisos/${avisoId}`);
  revalidatePath(`/admin/avisos/${avisoId}`);
  revalidatePath("/admin/avisos");
});
