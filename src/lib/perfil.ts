// Utilidades del perfil de usuario (lógica pura, compartida por el formulario y la acción del servidor).

/**
 * Normaliza un teléfono: quita espacios, guiones, puntos y paréntesis y acepta
 * 9 cifras (España) o un número internacional con «+» (8 a 15 cifras).
 * Devuelve null si no es válido. Formato guardado: «+34 600 123 456» o «600 123 456».
 */
export function normalizarTelefono(texto: string): string | null {
  const limpio = texto.trim().replace(/[\s\-.()]/g, "");
  if (/^\+\d{8,15}$/.test(limpio)) {
    if (limpio.startsWith("+34") && limpio.length === 12) return `+34 ${agrupar(limpio.slice(3))}`;
    return limpio;
  }
  if (/^00\d{8,15}$/.test(limpio)) return normalizarTelefono(`+${limpio.slice(2)}`);
  if (/^\d{9}$/.test(limpio)) return agrupar(limpio);
  return null;
}

function agrupar(nueveCifras: string) {
  return `${nueveCifras.slice(0, 3)} ${nueveCifras.slice(3, 6)} ${nueveCifras.slice(6)}`;
}

/** Iniciales para el avatar: «Ana María» «López» → «AL». */
export function inicialesPersona(nombre: string, apellidos: string | null | undefined) {
  return `${nombre.trim()[0] ?? ""}${apellidos?.trim()[0] ?? ""}`.toUpperCase() || "?";
}
