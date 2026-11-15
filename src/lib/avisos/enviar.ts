import "server-only";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { enviarPush } from "@/lib/push/enviar";
import { notificar } from "@/lib/push/notificar";

/** Cuántos recordatorios se mandan a quien no confirma (además del aviso inicial). */
export const MAX_RECORDATORIOS = 3;
/** Minutos entre un recordatorio y el siguiente. */
export const MINUTOS_ENTRE_RECORDATORIOS = 10;

/**
 * Envía un aviso a las personas indicadas y apunta el envío en su fila de destinatario.
 * - Aviso inicial: se guarda también en la bandeja de cada persona.
 * - Recordatorio: solo push (la bandeja ya lo tiene), con el mismo "tag" para que sustituya al anterior.
 */
export async function enviarAviso(avisoId: number, usuarioIds: string[], { recordatorio }: { recordatorio: boolean }) {
  const admin = crearClienteAdmin();
  if (!admin || usuarioIds.length === 0) return;

  const { data: aviso } = await admin.from("avisos").select("id, titulo, cuerpo, urgente, cerrado_en").eq("id", avisoId).maybeSingle();
  if (!aviso || aviso.cerrado_en) return;

  const payload = {
    tipo: "aviso",
    titulo: recordatorio ? `Recordatorio: ${aviso.titulo}` : aviso.titulo,
    cuerpo: aviso.cuerpo.length > 180 ? `${aviso.cuerpo.slice(0, 177)}…` : aviso.cuerpo,
    url: `/app/avisos/${avisoId}`,
    tag: `aviso-${avisoId}`,
    urgente: aviso.urgente,
  };

  if (recordatorio) {
    await enviarPush(usuarioIds, payload, { tipo: "real", urgencia: "high", ttlSegundos: 60 * 60 });
  } else {
    await notificar(usuarioIds, payload);
  }

  // Se anota el envío aunque la persona no tenga dispositivo: el aviso sigue pendiente en su bandeja y en su app.
  const { data: filas } = await admin
    .from("avisos_destinatarios")
    .select("usuario_id, envios")
    .eq("aviso_id", avisoId)
    .in("usuario_id", usuarioIds);
  const ahora = new Date().toISOString();
  for (const f of filas ?? []) {
    await admin
      .from("avisos_destinatarios")
      .update({ envios: f.envios + 1, ultimo_envio_en: ahora })
      .eq("aviso_id", avisoId)
      .eq("usuario_id", f.usuario_id);
  }
}

/** Cuántos dispositivos con avisos activados tiene cada persona. */
export async function dispositivosPorPersona(usuarioIds: string[]): Promise<Record<string, number>> {
  const admin = crearClienteAdmin();
  if (!admin || usuarioIds.length === 0) return {};
  const { data } = await admin.from("suscripciones_push").select("usuario_id").in("usuario_id", usuarioIds);
  const cuenta: Record<string, number> = {};
  for (const d of data ?? []) cuenta[d.usuario_id] = (cuenta[d.usuario_id] ?? 0) + 1;
  return cuenta;
}
