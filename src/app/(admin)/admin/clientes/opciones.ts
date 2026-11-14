import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Listas desplegables del formulario de cliente (grupos, formas de pago, cuentas). */
export async function cargarOpciones(supabase: SupabaseClient<Database>) {
  const [{ data: grupos }, { data: formasPago }, { data: cuentas }] = await Promise.all([
    supabase.from("grupos_empresariales").select("id, nombre").order("nombre"),
    supabase.from("formas_pago").select("id, nombre").order("id"),
    supabase.from("cuentas_bancarias").select("id, banco, iban").eq("activa", true).order("id"),
  ]);

  return {
    grupos: (grupos ?? []).map((g) => ({ id: g.id, etiqueta: g.nombre })),
    formasPago: (formasPago ?? []).map((f) => ({ id: f.id, etiqueta: f.nombre })),
    cuentas: (cuentas ?? []).map((c) => ({ id: c.id, etiqueta: `${c.banco} · …${c.iban.slice(-4)}` })),
  };
}
