import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { reglaVencimiento, type ReglaVencimiento } from "@/lib/documentos";

/** Listas desplegables del formulario de cliente (grupos, formas de pago, cuentas) y ajuste general de vencimiento. */
export async function cargarOpciones(supabase: SupabaseClient<Database>) {
  const [{ data: grupos }, { data: formasPago }, { data: cuentas }, { data: empresa }] = await Promise.all([
    supabase.from("grupos_empresariales").select("id, nombre").order("nombre"),
    supabase.from("formas_pago").select("id, nombre").order("id"),
    supabase.from("cuentas_bancarias").select("id, banco, iban").eq("activa", true).order("id"),
    supabase.from("empresa").select("vencimiento_defecto_dias, vencimiento_defecto_dia_mes").eq("id", 1).maybeSingle(),
  ]);

  return {
    grupos: (grupos ?? []).map((g) => ({ id: g.id, etiqueta: g.nombre })),
    formasPago: (formasPago ?? []).map((f) => ({ id: f.id, etiqueta: f.nombre })),
    cuentas: (cuentas ?? []).map((c) => ({ id: c.id, etiqueta: `${c.banco} · …${c.iban.slice(-4)}` })),
    vencimientoGeneral: (reglaVencimiento(empresa?.vencimiento_defecto_dias ?? 30, empresa?.vencimiento_defecto_dia_mes) ??
      { dias: 30 }) as ReglaVencimiento,
  };
}
