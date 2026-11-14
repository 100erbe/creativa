// Lee de una foto de la galería la ubicación y la fecha en que se hizo (EXIF).
// Solo para el navegador. La librería se carga bajo demanda para no pesar en el resto de la app.
// Ojo: la compresión posterior (comprimir-imagen.ts) elimina el EXIF, así que esto se lee ANTES.
// Algunos móviles (p. ej. Android al usar el selector de fotos) quitan la ubicación al elegir
// una foto de la galería: en ese caso devuelve null y la app lo explica al usuario.

export type ExifFoto = {
  latitud: number | null;
  longitud: number | null;
  fecha: Date | null;
};

export async function leerExifFoto(archivo: File): Promise<ExifFoto> {
  try {
    const exifr = (await import("exifr")).default;
    const [gps, meta] = await Promise.all([
      exifr.gps(archivo).catch(() => undefined),
      exifr.parse(archivo, ["DateTimeOriginal", "CreateDate"]).catch(() => undefined),
    ]);

    const fecha = [meta?.DateTimeOriginal, meta?.CreateDate].find(
      (f): f is Date => f instanceof Date && !Number.isNaN(f.getTime()),
    );

    const latitud = typeof gps?.latitude === "number" && Number.isFinite(gps.latitude) ? gps.latitude : null;
    const longitud = typeof gps?.longitude === "number" && Number.isFinite(gps.longitude) ? gps.longitude : null;
    return latitud !== null && longitud !== null
      ? { latitud, longitud, fecha: fecha ?? null }
      : { latitud: null, longitud: null, fecha: fecha ?? null };
  } catch {
    return { latitud: null, longitud: null, fecha: null };
  }
}
