/**
 * Prepara una foto de perfil en el navegador: recorte cuadrado centrado, 256 × 256 px,
 * WebP (o JPEG si el navegador no sabe codificar WebP). Aplica la orientación EXIF y no
 * conserva metadatos (ni ubicación ni cámara). Resultado típico: 10–30 KB.
 *
 * El bucket «avatares» (migración 0031) solo admite image/webp e image/jpeg de hasta 300 KB:
 * si una foto saliera más pesada se baja la calidad y, en último caso, se rechaza con un mensaje.
 */
export const LADO_AVATAR = 256;
/** Límite del bucket «avatares» (file_size_limit = 307200 bytes). */
export const LIMITE_AVATAR_BYTES = 300 * 1024;
const CALIDADES = [0.85, 0.7, 0.55, 0.4] as const;

export async function recortarAvatar(archivo: File): Promise<{ archivo: File; extension: "webp" | "jpg" }> {
  if (!archivo.type.startsWith("image/")) throw new Error("Elige una imagen (JPG, PNG, WebP o HEIC).");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  } catch {
    throw new Error("No se ha podido leer la imagen. Prueba con otra foto (JPG o PNG).");
  }
  const lado = Math.min(bitmap.width, bitmap.height);
  const x = (bitmap.width - lado) / 2;
  const y = (bitmap.height - lado) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = LADO_AVATAR;
  canvas.height = LADO_AVATAR;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se ha podido procesar la imagen.");
  // Fondo blanco: un PNG con transparencia no queda negro al pasarlo a JPEG.
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, LADO_AVATAR, LADO_AVATAR);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, x, y, lado, lado, 0, 0, LADO_AVATAR, LADO_AVATAR);
  bitmap.close();

  const aBlob = (tipo: string, calidad: number) =>
    new Promise<Blob | null>((r) => canvas.toBlob(r, tipo, calidad));

  // Si el navegador no sabe codificar WebP devuelve PNG: entonces, JPEG.
  const pruebaWebp = await aBlob("image/webp", CALIDADES[0]);
  const tipo = pruebaWebp?.type === "image/webp" ? "image/webp" : "image/jpeg";
  const extension: "webp" | "jpg" = tipo === "image/webp" ? "webp" : "jpg";

  let blob: Blob | null = tipo === "image/webp" ? pruebaWebp : await aBlob(tipo, CALIDADES[0]);
  for (let i = 1; blob && blob.size > LIMITE_AVATAR_BYTES && i < CALIDADES.length; i++) {
    blob = await aBlob(tipo, CALIDADES[i]!);
  }
  if (!blob || blob.type !== tipo) throw new Error("No se ha podido preparar la foto.");
  if (blob.size > LIMITE_AVATAR_BYTES) throw new Error("La foto pesa demasiado incluso reducida. Prueba con otra.");

  return { archivo: new File([blob], `avatar.${extension}`, { type: tipo }), extension };
}
