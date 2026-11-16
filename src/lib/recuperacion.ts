import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cookie (httpOnly, 15 min) que marca que la sesión viene del enlace de recuperación por email:
 * en ese caso se puede fijar una contraseña nueva sin escribir la anterior.
 *
 * El valor va firmado en el servidor (HMAC-SHA256 con RECUPERACION_SECRET) y ligado al id del
 * usuario y a su caducidad: `<id>.<caducidad en s>.<firma>`. Quien ya tenga una sesión abierta
 * no puede fabricarlo a mano. Sin el secreto configurado no se emite ni se acepta ninguno
 * (falla cerrado: se pide la contraseña actual).
 */
export const COOKIE_RECUPERACION = "creativa-recuperacion";
export const DURACION_RECUPERACION_S = 15 * 60;

function secreto(): string | null {
  const valor = process.env.RECUPERACION_SECRET;
  return valor && valor.length >= 32 ? valor : null;
}

function firmar(clave: string, usuarioId: string, caducidad: number): Buffer {
  return createHmac("sha256", clave).update(`recuperacion:${usuarioId}:${caducidad}`).digest();
}

/** Valor firmado para la cookie, o null si falta el secreto (no se marca la recuperación). */
export function crearValorRecuperacion(usuarioId: string): string | null {
  const clave = secreto();
  if (!clave) return null;
  const caducidad = Math.floor(Date.now() / 1000) + DURACION_RECUPERACION_S;
  return `${usuarioId}.${caducidad}.${firmar(clave, usuarioId, caducidad).toString("base64url")}`;
}

/** true solo si la cookie es auténtica, de este usuario y no ha caducado. */
export function esRecuperacionValida(valor: string | undefined, usuarioId: string): boolean {
  const clave = secreto();
  if (!clave || !valor) return false;
  const [id, textoCaducidad, firma, ...resto] = valor.split(".");
  if (resto.length > 0 || !id || !textoCaducidad || !firma) return false;
  if (id !== usuarioId || !/^\d+$/.test(textoCaducidad)) return false;
  const caducidad = Number(textoCaducidad);
  if (caducidad < Math.floor(Date.now() / 1000)) return false;

  const esperada = firmar(clave, id, caducidad);
  const recibida = Buffer.from(firma, "base64url");
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}
