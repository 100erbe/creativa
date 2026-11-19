import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { notificarAdministradores } from "@/lib/push/notificar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MINUTO_MS = 60 * 1000;
const VENTANA_MAX_MS = 24 * 60 * 60 * 1000;

/**
 * Envía a la administración los avisos diferidos (~1 minuto de gracia) de puntos marcados
 * como instalados, evitando avisar si el instalador deshizo o reabrió el punto a tiempo.
 *
 * Lo llama pg_cron cada minuto solo cuando hay cierres pendientes.
 */
function autorizado(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  const a = Buffer.from(request.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secreto}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function procesarCierres(request: NextRequest) {
  if (!autorizado(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const dry = request.nextUrl.searchParams.get("dry") === "1";

  const admin = crearClienteAdmin();
  if (!admin) return NextResponse.json({ error: "Falta la clave de servicio de Supabase." }, { status: 500 });

  const ahora = Date.now();
  const limiteSuperior = new Date(ahora - MINUTO_MS).toISOString();
  const limiteInferior = new Date(ahora - VENTANA_MAX_MS).toISOString();

  const { data, error } = await admin
    .from("asignaciones_punto")
    .select(
      "id, usuario_id, puntos_campana!inner(id, nombre, estado, campana_id, campanas(nombre)), usuarios!inner(nombre, apellidos)",
    )
    .eq("estado", "completada")
    .is("cierre_notificado_en", null)
    .lte("fecha_completada", limiteSuperior)
    .gte("fecha_completada", limiteInferior)
    .eq("puntos_campana.estado", "instalado");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pendientes = data ?? [];
  if (dry) {
    return NextResponse.json({ dry: true, pendientes: pendientes.length });
  }

  let notificados = 0;
  for (const fila of pendientes) {
    // Reclamación atómica antes de avisar: evita duplicados y respeta si el usuario reabrió justo antes.
    const { data: reclamada } = await admin
      .from("asignaciones_punto")
      .update({ cierre_notificado_en: new Date().toISOString() })
      .eq("id", fila.id)
      .eq("estado", "completada")
      .is("cierre_notificado_en", null)
      .select("id")
      .maybeSingle();

    if (!reclamada) continue;

    const punto = Array.isArray(fila.puntos_campana) ? fila.puntos_campana[0] : fila.puntos_campana;
    const persona = Array.isArray(fila.usuarios) ? fila.usuarios[0] : fila.usuarios;
    if (!punto) continue;
    const campana = Array.isArray(punto.campanas) ? punto.campanas[0] : punto.campanas;
    const quien = [persona?.nombre, persona?.apellidos].filter(Boolean).join(" ") || "Un miembro";

    await notificarAdministradores(
      {
        tipo: "punto_instalado",
        titulo: `Punto instalado: ${punto.nombre}`,
        cuerpo: `${quien}${campana?.nombre ? ` (${campana.nombre})` : ""}`,
        url: `/admin/campanas/${punto.campana_id}`,
        tag: `cierre-${punto.id}`,
      },
      { excluir: fila.usuario_id },
    );
    notificados += 1;
  }

  return NextResponse.json({ notificados });
}

export const GET = procesarCierres;
export const POST = procesarCierres;
