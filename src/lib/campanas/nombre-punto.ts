/**
 * Nombre automático de un punto nuevo: "Punto N", con N el siguiente al mayor
 * número ya usado en la campaña ("3" o "Punto 3" cuentan como 3).
 * Se usa el mayor y no el total para no repetir números tras borrar puntos.
 */
export function siguienteNombrePunto(nombresExistentes: string[]): string {
  let mayor = 0;
  for (const nombre of nombresExistentes) {
    const m = /^(?:punto\s*)?(\d+)$/i.exec(nombre.trim());
    if (m) mayor = Math.max(mayor, Number(m[1]));
  }
  return `Punto ${mayor + 1}`;
}
