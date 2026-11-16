import type { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";

/** Categorías activas y personas que pueden ser "responsable" de un gasto. */
export async function cargarOpcionesGasto(supabase: Awaited<ReturnType<typeof createClient>>) {
  const resultados = await Promise.all([
    supabase.from("categorias_gasto").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("usuarios").select("id, nombre, apellidos").eq("activo", true).order("nombre"),
  ]);
  lanzarSiError(...resultados);
  const [{ data: categorias }, { data: usuarios }] = resultados;
  return {
    categorias: (categorias ?? []).map((c) => ({ id: c.id, etiqueta: c.nombre })),
    responsables: (usuarios ?? []).map((u) => ({
      id: u.id,
      etiqueta: [u.nombre, u.apellidos].filter(Boolean).join(" "),
    })),
  };
}

export function hoyEnEspana() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
}
