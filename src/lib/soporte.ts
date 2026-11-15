import type { Database } from "@/lib/supabase/types";

export type TipoSoporte = Database["public"]["Enums"]["tipo_soporte"];

/** Tipo de soporte (enum de la campaña) que corresponde a un producto del catálogo. */
export function soporteDe(producto: string): TipoSoporte {
  const p = producto.toLowerCase();
  if (p.includes("tótem") || p.includes("totem")) return "totem";
  if (p.includes("valla")) return "valla";
  if (p.includes("lona")) return "lona";
  if (p.includes("banderola")) return "mobiliario_urbano";
  if (p.includes("marquesina")) return "marquesina";
  if (p.includes("pantalla")) return "pantalla";
  if (p.includes("cartel")) return "cartel";
  return "otro";
}
