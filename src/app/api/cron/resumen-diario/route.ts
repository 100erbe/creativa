import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { fechaAviso, notificar } from "@/lib/push/notificar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resumen diario del trabajo de mañana. Lo llama pg_cron (Supabase) a las 18:00 y a las 19:00 UTC de lunes a
 * viernes; la hora de Madrid decide cuál de las dos ejecuciones envía (las 20:00 caen en una u otra según
 * el horario de verano). Es idempotente: un segundo aviso para la misma persona y el mismo día no sale.
 *
 * Autenticación: `Authorization: Bearer $CRON_SECRET`.
 * Parámetros solo para pruebas (siempre con el secreto):
 *   ?dry=1      no envía nada, devuelve lo que enviaría
 *   ?forzar=1   ignora la comprobación de día y hora
 *   ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD   fuerza el periodo a resumir
 */

function autorizado(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  const recibido = request.headers.get("authorization") ?? "";
  const esperado = `Bearer ${secreto}`;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

const ZONA = "Europe/Madrid";

/** Día de la semana (1 = lunes … 7 = domingo), hora y fecha AAAA-MM-DD en Madrid. */
function ahoraEnMadrid(fecha = new Date()) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: ZONA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      weekday: "short",
    })
      .formatToParts(fecha)
      .map((p) => [p.type, p.value]),
  );
  const dias = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return {
    diaSemana: dias.indexOf(partes.weekday!) + 1,
    hora: Number(partes.hour) % 24,
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
  };
}

function sumarDias(fecha: string, dias: number) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

type Fila = {
  usuario_id: string;
  rol_asignacion: string;
  fecha_programada: string;
  punto: string;
  campana: string;
};

async function resumir(request: NextRequest) {
  if (!autorizado(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const parametros = request.nextUrl.searchParams;
  const dry = parametros.get("dry") === "1";
  const forzar = parametros.get("forzar") === "1";
  const ahora = ahoraEnMadrid();

  if (!forzar) {
    if (ahora.diaSemana > 5) return NextResponse.json({ omitido: "Fin de semana: no se envía resumen." });
    if (ahora.hora !== 20) return NextResponse.json({ omitido: `Son las ${ahora.hora}:xx en Madrid: el resumen sale a las 20:00.` });
  }

  // Lunes a jueves: el día siguiente. Los viernes: sábado, domingo y lunes (no se envía en fin de semana).
  const desde = parametros.get("desde") ?? sumarDias(ahora.fecha, 1);
  const hasta = parametros.get("hasta") ?? (ahora.diaSemana === 5 ? sumarDias(ahora.fecha, 3) : desde);

  const admin = crearClienteAdmin();
  if (!admin) return NextResponse.json({ error: "Falta la clave de servicio de Supabase." }, { status: 500 });

  const { data, error } = await admin
    .from("asignaciones_punto")
    .select("usuario_id, rol_asignacion, fecha_programada, usuarios!inner(activo), puntos_campana!inner(nombre, campanas!inner(nombre))")
    .in("estado", ["pendiente", "en_curso"])
    .gte("fecha_programada", desde)
    .lte("fecha_programada", hasta)
    .eq("usuarios.activo", true)
    .order("fecha_programada");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filas: Fila[] = (data ?? []).flatMap((a) => {
    const punto = Array.isArray(a.puntos_campana) ? a.puntos_campana[0] : a.puntos_campana;
    const campana = Array.isArray(punto?.campanas) ? punto?.campanas[0] : punto?.campanas;
    if (!punto || !a.fecha_programada) return [];
    return [
      {
        usuario_id: a.usuario_id,
        rol_asignacion: a.rol_asignacion,
        fecha_programada: a.fecha_programada,
        punto: punto.nombre,
        campana: campana?.nombre ?? "",
      },
    ];
  });

  const porPersona = new Map<string, Fila[]>();
  for (const f of filas) porPersona.set(f.usuario_id, [...(porPersona.get(f.usuario_id) ?? []), f]);

  const rango = desde === hasta ? `mañana (${fechaAviso(desde)})` : `el próximo día de trabajo (${fechaAviso(desde)} – ${fechaAviso(hasta)})`;
  const resultado: { usuario_id: string; puntos: number; enviado: boolean; motivo?: string }[] = [];

  for (const [usuarioId, lista] of porPersona) {
    const aviso = componerAviso(lista, desde, hasta);

    if (dry) {
      resultado.push({ usuario_id: usuarioId, puntos: lista.length, enviado: false, motivo: `dry: «${aviso.titulo}» — ${aviso.cuerpo}` });
      continue;
    }

    // Idempotencia: la fila única (persona, desde) impide mandar dos veces el mismo resumen.
    const { data: reservado, error: errorReserva } = await admin
      .from("resumenes_enviados")
      .insert({ usuario_id: usuarioId, fecha_objetivo: desde, puntos: lista.length })
      .select("id");
    if (errorReserva || !reservado || reservado.length === 0) {
      resultado.push({ usuario_id: usuarioId, puntos: lista.length, enviado: false, motivo: "ya enviado" });
      continue;
    }

    await notificar([usuarioId], aviso);
    resultado.push({ usuario_id: usuarioId, puntos: lista.length, enviado: true });
  }

  return NextResponse.json({ periodo: rango, desde, hasta, dry, personas: porPersona.size, resultado });
}

function componerAviso(lista: Fila[], desde: string, hasta: string) {
  const instalaciones = lista.filter((f) => f.rol_asignacion !== "retirador").length;
  const retiradas = lista.length - instalaciones;
  const partes = [
    instalaciones > 0 ? `${instalaciones} instalación${instalaciones === 1 ? "" : "es"}` : null,
    retiradas > 0 ? `${retiradas} retirada${retiradas === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  const primero = lista[0]!;
  const otros = lista.length > 1 ? ` y ${lista.length - 1} más` : "";

  return {
    tipo: "resumen_diario",
    titulo: `${desde === hasta ? "Mañana" : "Próximo día de trabajo"}: ${lista.length} punto${lista.length === 1 ? "" : "s"}`,
    cuerpo: `${partes.join(" · ")}. Primero: ${primero.punto}${otros}.`,
    url: "/app/agenda",
    tag: `resumen-${desde}`,
  };
}

export const GET = resumir;
export const POST = resumir;
