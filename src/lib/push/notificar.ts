import "server-only";
import { after } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { enviarPush, envioRealPermitido } from "./enviar";

export type Aviso = {
  /** Categoría interna (p. ej. "punto_asignado"); sirve para filtrar y para futuras preferencias. */
  tipo: string;
  titulo: string;
  cuerpo: string;
  /** Pantalla que se abre al tocar el aviso. */
  url?: string;
  /** Un aviso nuevo con la misma etiqueta sustituye al anterior en el móvil. */
  tag?: string;
  urgente?: boolean;
};

/**
 * Guarda el aviso en la bandeja de cada persona y lo envía por push.
 *
 * Nunca lanza: un fallo al avisar no debe romper la acción que lo provocó (asignar un punto, por ejemplo).
 * Fuera de producción no hace nada, porque las previews y el entorno local comparten la base de datos
 * real y avisarían a la gente de verdad (para probar en local: PUSH_HABILITADO=1).
 */
export async function notificar(destinatarios: string[], aviso: Aviso, opciones: { excluir?: string } = {}) {
  const ids = [...new Set(destinatarios)].filter((id) => id && id !== opciones.excluir);
  if (ids.length === 0 || !envioRealPermitido()) return;

  try {
    const admin = crearClienteAdmin();
    if (admin) {
      const { error } = await admin.from("notificaciones").insert(
        ids.map((usuario_id) => ({
          usuario_id,
          tipo: aviso.tipo,
          titulo: aviso.titulo,
          cuerpo: aviso.cuerpo,
          url: aviso.url ?? null,
        })),
      );
      if (error) console.error("notificar (bandeja):", error.message);
    }
    await enviarPush(
      ids,
      { titulo: aviso.titulo, cuerpo: aviso.cuerpo, url: aviso.url, tag: aviso.tag, urgente: aviso.urgente },
      { tipo: "real", urgencia: aviso.urgente ? "high" : "normal" },
    );
  } catch (e) {
    console.error("notificar:", e);
  }
}

/** Todas las personas administradoras activas (para avisarles de lo que pasa en el campo). */
async function idsAdministradores(): Promise<string[]> {
  const admin = crearClienteAdmin();
  if (!admin) return [];
  const { data } = await admin.from("usuarios").select("id").eq("rol", "admin").eq("activo", true);
  return (data ?? []).map((u) => u.id);
}

export async function notificarAdministradores(aviso: Aviso, opciones: { excluir?: string } = {}) {
  await notificar(await idsAdministradores(), aviso, opciones);
}

/**
 * Programa el envío para después de responder al usuario (Next `after`): la pantalla no espera al servicio
 * push. Si se llamara fuera de una petición, se ejecuta directamente.
 */
export function enSegundoPlano(tarea: () => Promise<void>) {
  try {
    after(tarea);
  } catch {
    void tarea();
  }
}

/** "jue, 20 nov" a partir de una fecha AAAA-MM-DD. */
export function fechaAviso(fecha: string | null | undefined) {
  if (!fecha) return "sin fecha";
  return new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${fecha}T12:00:00`),
  );
}
