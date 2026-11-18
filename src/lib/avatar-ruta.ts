// Fotos de perfil: bucket privado «avatares» (migración 0031). Se guardan como
// «{uid}/avatar-<marca de tiempo>.webp» y se sirven con URL firmada.

export const BUCKET_AVATARES = "avatares";

/** Ruta para una foto nueva de la persona `uid` (nombre distinto cada vez: así no hay caché vieja). */
export function rutaAvatarNueva(uid: string, extension: "webp" | "jpg") {
  return `${uid}/avatar-${Date.now()}.${extension}`;
}
