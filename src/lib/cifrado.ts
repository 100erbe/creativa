import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Cifrado simétrico (AES-256-GCM) de secretos que se guardan en la base de datos, como el
 * refresh token de Gmail. La clave sale de TOKENS_SECRET (solo servidor, mínimo 32 caracteres):
 * aunque alguien leyera la tabla, sin la clave del servidor el token no sirve.
 *
 * Formato guardado: `v1:<iv>:<etiqueta>:<cifrado>` (base64url).
 */
const PREFIJO = "v1:";

function clave(): Buffer | null {
  const secreto = process.env.TOKENS_SECRET;
  if (!secreto || secreto.length < 32) return null;
  return createHash("sha256").update(secreto).digest();
}

export function cifradoConfigurado() {
  return clave() !== null;
}

export function cifrar(texto: string): string {
  const k = clave();
  if (!k) throw new Error("Falta TOKENS_SECRET en el servidor (mínimo 32 caracteres).");
  const iv = randomBytes(12);
  const cifrador = createCipheriv("aes-256-gcm", k, iv);
  const cifrado = Buffer.concat([cifrador.update(texto, "utf8"), cifrador.final()]);
  const etiqueta = cifrador.getAuthTag();
  return `${PREFIJO}${iv.toString("base64url")}:${etiqueta.toString("base64url")}:${cifrado.toString("base64url")}`;
}

/** Descifra un valor guardado con cifrar(). Un valor antiguo sin cifrar se devuelve tal cual. */
export function descifrar(valor: string): string {
  if (!valor.startsWith(PREFIJO)) return valor;
  const k = clave();
  if (!k) throw new Error("Falta TOKENS_SECRET en el servidor (mínimo 32 caracteres).");
  const [iv, etiqueta, cifrado] = valor.slice(PREFIJO.length).split(":");
  if (!iv || !etiqueta || !cifrado) throw new Error("El secreto guardado no es válido.");
  const descifrador = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64url"));
  descifrador.setAuthTag(Buffer.from(etiqueta, "base64url"));
  return Buffer.concat([descifrador.update(Buffer.from(cifrado, "base64url")), descifrador.final()]).toString("utf8");
}
