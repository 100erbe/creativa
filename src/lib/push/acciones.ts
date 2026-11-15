"use server";

import { createClient } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { accion } from "@/lib/accion";
import { endpointPermitido, enviarPush, type ResultadoEnvio } from "./enviar";

/** Pantalla que se abre al tocar un aviso, según quién lo recibe. */
function pantallaInicial(rol: string) {
  return rol === "admin" ? "/admin/ajustes/avisos" : "/app/avisos";
}

/**
 * Registra este dispositivo para recibir avisos. Se llama al activarlos y cada vez que se abre la app
 * (el navegador puede renovar la suscripción sin avisar). Si el móvil ya estaba registrado con otra
 * persona, pasa a ésta: un teléfono tiene un solo usuario a la vez.
 */
export const guardarSuscripcion = accion(
  async (s: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) => {
    const usuario = await obtenerUsuarioActual();
    if (!usuario) throw new Error("Sesión no válida.");

    if (!endpointPermitido(s.endpoint) || s.endpoint.length > 2048) {
      throw new Error("Este navegador usa un servicio de avisos que no está admitido.");
    }
    if (!s.p256dh || !s.auth || s.p256dh.length > 256 || s.auth.length > 128) {
      throw new Error("La suscripción no es válida.");
    }
    const admin = crearClienteAdmin();
    if (!admin) throw new Error("Falta la clave de servicio de Supabase en el servidor.");

    const { error } = await admin.from("suscripciones_push").upsert(
      {
        usuario_id: usuario.id,
        endpoint: s.endpoint,
        p256dh: s.p256dh,
        auth: s.auth,
        user_agent: s.userAgent?.slice(0, 300) ?? null,
        actualizada_en: new Date().toISOString(),
        fallos_seguidos: 0,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
  },
);

/** Quita este dispositivo (al desactivar los avisos o al cerrar sesión en un móvil compartido). */
export const eliminarSuscripcion = accion(async (endpoint: string) => {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return; // sin sesión no hay nada que la RLS deje borrar
  const supabase = await createClient();
  const { error } = await supabase.from("suscripciones_push").delete().eq("endpoint", endpoint).eq("usuario_id", usuario.id);
  if (error) throw new Error(error.message);
});

const AVISO_PRUEBA = {
  titulo: "Avisos activados ✓",
  cuerpo: "Si ves esto con la app cerrada, recibirás aquí el trabajo de mañana y los cambios de plan.",
  tag: "prueba",
};

/** Manda un aviso de prueba a los dispositivos de la propia persona. */
export const enviarPrueba = accion(async (): Promise<ResultadoEnvio> => {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new Error("Sesión no válida.");
  return enviarPush([usuario.id], { ...AVISO_PRUEBA, url: pantallaInicial(usuario.rol) }, { tipo: "prueba", ttlSegundos: 120 });
});

/** El administrador manda una prueba a una persona del equipo para comprobar que le llegan los avisos. */
export const enviarPruebaA = accion(async (usuarioId: string): Promise<ResultadoEnvio> => {
  await exigirAdmin();
  const supabase = await createClient();
  const { data: persona } = await supabase.from("usuarios").select("id, rol").eq("id", usuarioId).maybeSingle();
  if (!persona) throw new Error("No se ha encontrado a la persona.");
  return enviarPush(
    [persona.id],
    { ...AVISO_PRUEBA, titulo: "Prueba de avisos", cuerpo: "Tu administración está comprobando que los avisos te llegan.", url: pantallaInicial(persona.rol) },
    { tipo: "prueba", ttlSegundos: 120 },
  );
});

/** Marca como leídos todos los avisos de la persona (al abrir la bandeja). */
export const marcarLeidas = accion(async () => {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("notificaciones")
    .update({ leida_en: new Date().toISOString() })
    .eq("usuario_id", usuario.id)
    .is("leida_en", null);
  if (error) throw new Error(error.message);
});
