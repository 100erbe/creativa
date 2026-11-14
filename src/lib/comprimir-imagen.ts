/**
 * Reduce una foto del móvil a un archivo muy ligero antes de subirla.
 * Al cliente solo le hace falta ver que el trabajo está hecho (la ubicación
 * se guarda aparte en fotos_punto), así que 1280 px de lado largo y calidad
 * moderada bastan: normalmente 80–200 KB en vez de 3–8 MB.
 *
 * Usa WebP si el navegador sabe codificarlo y JPEG si no (Safari antiguo).
 * Aplica la orientación EXIF; el resultado no conserva metadatos EXIF.
 */

const LADO_MAX_PX = 1280;
const OBJETIVO_BYTES = 200 * 1024;
const CALIDADES: readonly number[] = [0.7, 0.6, 0.5, 0.4];
const CALIDAD_INICIAL = 0.7;

function aBlob(canvas: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, calidad));
}

export async function comprimirImagen(archivo: File): Promise<File> {
  const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });

  const escala = Math.min(1, LADO_MAX_PX / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  // Si el navegador no sabe codificar WebP devuelve PNG: en ese caso, JPEG.
  let tipo = "image/webp";
  let resultado = await aBlob(canvas, tipo, CALIDAD_INICIAL);
  if (!resultado || resultado.type !== "image/webp") {
    tipo = "image/jpeg";
    resultado = await aBlob(canvas, tipo, CALIDAD_INICIAL);
  }

  for (let i = 1; resultado && resultado.size > OBJETIVO_BYTES && i < CALIDADES.length; i++) {
    const intento = await aBlob(canvas, tipo, CALIDADES[i] ?? CALIDAD_INICIAL);
    if (!intento) break;
    resultado = intento;
  }

  if (!resultado) throw new Error("No se pudo comprimir la imagen.");

  const extension = tipo === "image/webp" ? "webp" : "jpg";
  return new File([resultado], `foto.${extension}`, { type: tipo });
}
