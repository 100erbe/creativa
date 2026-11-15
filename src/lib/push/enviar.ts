import "server-only";
import * as webpush from "web-push";
import { crearClienteAdmin } from "@/lib/supabase/admin";

export type PayloadPush = {
  titulo: string;
  cuerpo: string;
  /** Pantalla que se abre al tocar el aviso. */
  url?: string;
  /** Un aviso nuevo con la misma etiqueta sustituye al anterior en el móvil. */
  tag?: string;
  /** Se queda en pantalla hasta que se toque (donde el sistema lo permita). */
  urgente?: boolean;
};

export type ResultadoEnvio = {
  /** Dispositivos a los que se intentó enviar. */
  dispositivos: number;
  enviadas: number;
  fallidas: number;
  /** Personas sin ningún dispositivo con avisos activados. */
  sinDispositivo: string[];
  /** Motivo por el que no se envió nada (p. ej. entorno que no es producción). */
  omitido?: string;
};

type Opciones = {
  /** "prueba" se permite en cualquier entorno; "real" solo en producción (o con PUSH_HABILITADO=1). */
  tipo?: "prueba" | "real";
  /** Cuánto tiempo guarda el servicio push el aviso si el móvil no está disponible. */
  ttlSegundos?: number;
  urgencia?: "very-low" | "low" | "normal" | "high";
};

/**
 * Los servicios push de los navegadores. El servidor hace una petición POST a la URL de cada suscripción,
 * así que se aceptan solo estos dominios: sin esta lista, cualquiera podría registrar una "suscripción" con
 * una URL cualquiera y hacer que el servidor la llamara.
 */
const DOMINIOS_PUSH = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  ".push.services.mozilla.com",
  ".push.apple.com",
  ".notify.windows.com",
];

export function endpointPermitido(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    return DOMINIOS_PUSH.some((d) => (d.startsWith(".") ? url.hostname.endsWith(d) : url.hostname === d));
  } catch {
    return false;
  }
}

/** Fuera de producción (previews de Vercel, desarrollo) no se mandan avisos reales: comparten la base de datos. */
export function envioRealPermitido() {
  return process.env.VERCEL_ENV === "production" || process.env.PUSH_HABILITADO === "1";
}

let configurado = false;
function configurar(): boolean {
  if (configurado) return true;
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  const contacto = process.env.VAPID_SUBJECT;
  if (!publica || !privada || !contacto) return false;
  webpush.setVapidDetails(contacto, publica, privada);
  configurado = true;
  return true;
}

/**
 * Envía un aviso a todos los dispositivos de las personas indicadas.
 * Borra las suscripciones que el servicio push da por muertas (404/410) y cuenta los fallos de las demás.
 */
export async function enviarPush(
  usuarioIds: string[],
  payload: PayloadPush,
  { tipo = "real", ttlSegundos = 60 * 60 * 12, urgencia = "normal" }: Opciones = {},
): Promise<ResultadoEnvio> {
  const vacio: ResultadoEnvio = { dispositivos: 0, enviadas: 0, fallidas: 0, sinDispositivo: [...usuarioIds] };

  if (usuarioIds.length === 0) return { ...vacio, sinDispositivo: [] };
  if (tipo === "real" && !envioRealPermitido()) {
    return { ...vacio, omitido: "Fuera de producción no se envían avisos reales." };
  }
  if (!configurar()) return { ...vacio, omitido: "Faltan las claves VAPID en el servidor." };
  const admin = crearClienteAdmin();
  if (!admin) return { ...vacio, omitido: "Falta la clave de servicio de Supabase en el servidor." };

  const { data: suscripciones, error } = await admin
    .from("suscripciones_push")
    .select("id, usuario_id, endpoint, p256dh, auth, fallos_seguidos")
    .in("usuario_id", usuarioIds);
  if (error) throw new Error(error.message);

  const lista = (suscripciones ?? []).filter((s) => endpointPermitido(s.endpoint));
  const conDispositivo = new Set(lista.map((s) => s.usuario_id));
  const cuerpo = JSON.stringify(payload);

  const resultados = await Promise.allSettled(
    lista.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, cuerpo, {
        TTL: ttlSegundos,
        urgency: urgencia,
      }),
    ),
  );

  let enviadas = 0;
  const muertas: number[] = [];
  const correctas: number[] = [];
  const falladas: { id: number; fallos: number }[] = [];

  resultados.forEach((r, i) => {
    const s = lista[i]!;
    if (r.status === "fulfilled") {
      enviadas++;
      correctas.push(s.id);
      return;
    }
    const estado = (r.reason as { statusCode?: number } | null)?.statusCode;
    if (estado === 404 || estado === 410) muertas.push(s.id);
    else falladas.push({ id: s.id, fallos: s.fallos_seguidos + 1 });
  });

  if (muertas.length > 0) await admin.from("suscripciones_push").delete().in("id", muertas);
  if (correctas.length > 0) {
    await admin
      .from("suscripciones_push")
      .update({ ultimo_envio_ok: new Date().toISOString(), fallos_seguidos: 0 })
      .in("id", correctas);
  }
  for (const f of falladas) {
    await admin.from("suscripciones_push").update({ fallos_seguidos: f.fallos }).eq("id", f.id);
  }

  return {
    dispositivos: lista.length,
    enviadas,
    fallidas: lista.length - enviadas,
    sinDispositivo: usuarioIds.filter((id) => !conDispositivo.has(id)),
  };
}
