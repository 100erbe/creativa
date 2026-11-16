/** Longitud mínima de contraseña en la app (Supabase Auth exige 8; aquí se pide más). */
export const MIN_CONTRASENA = 10;

/** Devuelve el error a mostrar, o null si la contraseña vale. */
export function errorContrasena(password: string): string | null {
  if (password.length < MIN_CONTRASENA) return `La contraseña debe tener al menos ${MIN_CONTRASENA} caracteres.`;
  if (password.length > 72) return "La contraseña es demasiado larga (máximo 72 caracteres).";
  return null;
}
