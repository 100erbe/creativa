import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { dispositivosPorPersona, enviarAviso, MAX_RECORDATORIOS, MINUTOS_ENTRE_RECORDATORIOS } from "@/lib/avisos/enviar";
import { notificarAdministradores } from "@/lib/push/notificar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Recordatorios de los avisos urgentes. Lo llama pg_cron cada minuto, pero solo cuando la base de datos ve
 * que hay algo pendiente.
 *
 * - A quien no ha confirmado, cada 10 minutos, hasta 3 recordatorios (4 envíos en total contando el inicial).
 * - Tras el último, o si la persona no tiene ningún dispositivo con avisos, se avisa UNA vez a la administración
 *   para que la llame (queda anotado en `escalado_en`).
 *
 * Autenticación: `Authorization: Bearer $CRON_SECRET`. `?dry=1` no envía nada.
 */

function autorizado(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  const a = Buffer.from(request.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secreto}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function recordar(request: NextRequest) {
  if (!autorizado(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const dry = request.nextUrl.searchParams.get("dry") === "1";

  const admin = crearClienteAdmin();
  if (!admin) return NextResponse.json({ error: "Falta la clave de servicio de Supabase." }, { status: 500 });

  const limite = new Date(Date.now() - MINUTOS_ENTRE_RECORDATORIOS * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("avisos_destinatarios")
    .select("aviso_id, usuario_id, envios, escalado_en, avisos!inner(titulo, urgente, cerrado_en), usuarios!inner(nombre, activo)")
    .is("confirmado_en", null)
    .gte("envios", 1)
    .lte("ultimo_envio_en", limite)
    .eq("avisos.urgente", true)
    .is("avisos.cerrado_en", null)
    .eq("usuarios.activo", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pendientes = (data ?? []).map((d) => {
    const aviso = Array.isArray(d.avisos) ? d.avisos[0] : d.avisos;
    const persona = Array.isArray(d.usuarios) ? d.usuarios[0] : d.usuarios;
    return { avisoId: d.aviso_id, usuarioId: d.usuario_id, envios: d.envios, escalado: d.escalado_en != null, titulo: aviso?.titulo ?? "", nombre: persona?.nombre ?? "" };
  });

  const dispositivos = await dispositivosPorPersona([...new Set(pendientes.map((p) => p.usuarioId))]);

  // Quién recibe un recordatorio y quién ya toca escalar (se agotaron los recordatorios o no tiene dónde recibirlos).
  const recordatorios = pendientes.filter((p) => p.envios <= MAX_RECORDATORIOS && dispositivos[p.usuarioId]);
  const escalar = pendientes.filter((p) => !p.escalado && (p.envios > MAX_RECORDATORIOS || !dispositivos[p.usuarioId]));

  if (dry) {
    return NextResponse.json({ dry: true, recordatorios: recordatorios.length, escalar: escalar.map((p) => `${p.nombre}: ${p.titulo}`) });
  }

  // Recordatorios agrupados por aviso (un envío por aviso a todas las personas que lo necesitan).
  const porAviso = new Map<number, string[]>();
  for (const r of recordatorios) porAviso.set(r.avisoId, [...(porAviso.get(r.avisoId) ?? []), r.usuarioId]);
  for (const [avisoId, ids] of porAviso) await enviarAviso(avisoId, ids, { recordatorio: true });

  // Escalado: una sola notificación por aviso a la administración, con los nombres de quien no ha confirmado.
  const escaladosPorAviso = new Map<number, { titulo: string; nombres: string[]; ids: string[] }>();
  for (const p of escalar) {
    const actual: { titulo: string; nombres: string[]; ids: string[] } = escaladosPorAviso.get(p.avisoId) ?? {
      titulo: p.titulo,
      nombres: [],
      ids: [],
    };
    actual.nombres.push(p.nombre);
    actual.ids.push(p.usuarioId);
    escaladosPorAviso.set(p.avisoId, actual);
  }
  for (const [avisoId, e] of escaladosPorAviso) {
    // Se marca antes de avisar: si algo falla a medias, es mejor no avisar dos veces que bombardear a la administración.
    await admin
      .from("avisos_destinatarios")
      .update({ escalado_en: new Date().toISOString() })
      .eq("aviso_id", avisoId)
      .in("usuario_id", e.ids)
      .is("escalado_en", null);
    await notificarAdministradores({
      tipo: "aviso_sin_confirmar",
      titulo: `Sin confirmar: ${e.titulo}`,
      cuerpo: `${e.nombres.join(", ")} no ${e.nombres.length === 1 ? "ha" : "han"} confirmado el aviso. Conviene llamar.`,
      url: `/admin/avisos/${avisoId}`,
      tag: `escalado-${avisoId}`,
      urgente: true,
    });
  }

  return NextResponse.json({ recordatorios: recordatorios.length, escalados: escalar.length });
}

export const GET = recordar;
export const POST = recordar;
