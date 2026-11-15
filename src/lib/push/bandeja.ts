import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { NotificacionBandeja } from "@/components/avisos/bandeja";

const formato = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

/** Los últimos avisos de la persona con sesión iniciada (la RLS ya limita a los suyos). */
export async function cargarBandeja(limite = 30): Promise<NotificacionBandeja[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notificaciones")
    .select("id, titulo, cuerpo, url, creada_en, leida_en")
    .order("creada_en", { ascending: false })
    .limit(limite);
  if (error) throw new Error(error.message);

  return (data ?? []).map((n) => ({
    id: n.id,
    titulo: n.titulo,
    cuerpo: n.cuerpo,
    url: n.url,
    creada: formato.format(new Date(n.creada_en)),
    leida: n.leida_en != null,
  }));
}

/** Cuántos avisos tiene sin leer (para el contador de la barra). */
export async function contarNoLeidos(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notificaciones")
    .select("id", { count: "exact", head: true })
    .is("leida_en", null);
  return count ?? 0;
}
