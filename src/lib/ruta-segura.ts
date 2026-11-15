/**
 * Valida el parámetro `volver` del login: solo se aceptan rutas internas de la app
 * (`/admin/...` o `/app/...`). Cualquier otra cosa (URL absoluta, `//otro.sitio`,
 * `/\otro.sitio`) cae en el valor por defecto, para que un enlace manipulado no
 * pueda mandar al usuario a otra web tras iniciar sesión.
 */
export function rutaSegura(volver: string | null | undefined, porDefecto: string): string {
  if (!volver) return porDefecto;
  if (!/^\/(admin|app)(\/|\?|#|$)/.test(volver)) return porDefecto;
  return volver;
}
