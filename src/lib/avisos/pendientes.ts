import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Avisos urgentes abiertos que la persona con sesión todavía no ha confirmado (la RLS limita a los suyos). */
export async function avisosUrgentesPendientes(): Promise<{ id: number; titulo: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("avisos_destinatarios")
    .select("aviso_id, avisos!inner(titulo, urgente, cerrado_en, creado_en)")
    .is("confirmado_en", null)
    .eq("avisos.urgente", true)
    .is("avisos.cerrado_en", null)
    .order("aviso_id", { ascending: false });

  return (data ?? []).map((d) => {
    const a = Array.isArray(d.avisos) ? d.avisos[0] : d.avisos;
    return { id: d.aviso_id, titulo: a?.titulo ?? "Aviso" };
  });
}
