import type { Posicion } from "@/components/mapa/mapa-selector";

/** Obtiene la dirección aproximada de unas coordenadas vía OpenStreetMap (Nominatim). */
export async function direccionDe(p: Posicion): Promise<string> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&accept-language=es&lat=${p.latitud}&lon=${p.longitud}`,
    );
    const d = (await r.json()) as { display_name?: string; address?: Record<string, string> };
    const a = d.address ?? {};
    const calle = [a.road ?? a.pedestrian ?? a.square, a.house_number].filter(Boolean).join(" ");
    const ciudad = a.city ?? a.town ?? a.village ?? a.municipality;
    return [calle, ciudad].filter(Boolean).join(", ") || d.display_name || "";
  } catch {
    return "";
  }
}

export function formatoPiezas(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",");
}

export function nombreVisiblePunto(nombre: string): string {
  const limpio = nombre.trim();
  return /^\d+$/.test(limpio) ? `Punto ${limpio}` : limpio;
}
