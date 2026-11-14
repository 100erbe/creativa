// Metadatos de una foto de punto (origen y ubicación). Lógica pura, sin dependencias del
// navegador: la usa el servidor para validar lo que manda el cliente y se puede probar sola.

export const ORIGENES_FOTO = ["camara", "galeria"] as const;
export const ORIGENES_UBICACION = ["gps_camara", "exif", "gps_al_subir"] as const;

export type OrigenFoto = (typeof ORIGENES_FOTO)[number];
export type OrigenUbicacion = (typeof ORIGENES_UBICACION)[number];

export type MetadatosFoto = {
  origenFoto: OrigenFoto;
  latitud: number | null;
  longitud: number | null;
  origenUbicacion: OrigenUbicacion | null;
  /** ISO. Solo se admite en fotos de galería (la fecha en que se hizo, no en que se subió). */
  tomadaEn: string | null;
};

/** Qué origen de ubicación es coherente con cada origen de foto. */
const UBICACION_PERMITIDA: Record<OrigenFoto, readonly OrigenUbicacion[]> = {
  camara: ["gps_camara"],
  galeria: ["exif", "gps_al_subir"],
};

const MARGEN_FUTURO_MS = 5 * 60 * 1000; // tolerancia por relojes desajustados
const ANTIGUEDAD_MAX_MS = 400 * 24 * 60 * 60 * 1000; // una foto "olvidada" no puede ser de hace años

function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function validarMetadatosFoto(
  entrada: {
    origenFoto?: unknown;
    origenUbicacion?: unknown;
    latitud?: unknown;
    longitud?: unknown;
    tomadaEn?: unknown;
  },
  ahora: Date = new Date(),
): MetadatosFoto {
  const origenFoto = ORIGENES_FOTO.find((o) => o === entrada.origenFoto) ?? "camara";

  // La ubicación solo vale si hay lat y lng válidas Y el origen es coherente con el tipo de foto;
  // en cualquier otro caso se descarta entera (nunca se guarda a medias).
  const latitud = numero(entrada.latitud);
  const longitud = numero(entrada.longitud);
  const origenUbicacion = ORIGENES_UBICACION.find((o) => o === entrada.origenUbicacion) ?? null;
  const ubicacionValida =
    latitud !== null &&
    longitud !== null &&
    latitud >= -90 &&
    latitud <= 90 &&
    longitud >= -180 &&
    longitud <= 180 &&
    origenUbicacion !== null &&
    UBICACION_PERMITIDA[origenFoto].includes(origenUbicacion);

  let tomadaEn: string | null = null;
  if (origenFoto === "galeria" && typeof entrada.tomadaEn === "string") {
    const fecha = new Date(entrada.tomadaEn);
    const t = fecha.getTime();
    if (
      Number.isFinite(t) &&
      t <= ahora.getTime() + MARGEN_FUTURO_MS &&
      t >= ahora.getTime() - ANTIGUEDAD_MAX_MS
    ) {
      tomadaEn = fecha.toISOString();
    }
  }

  return {
    origenFoto,
    latitud: ubicacionValida ? latitud : null,
    longitud: ubicacionValida ? longitud : null,
    origenUbicacion: ubicacionValida ? origenUbicacion : null,
    tomadaEn,
  };
}

export const ETIQUETA_ORIGEN_UBICACION: Record<OrigenUbicacion, string> = {
  gps_camara: "GPS de la cámara",
  exif: "Ubicación guardada en la foto",
  gps_al_subir: "Ubicación al subir la foto",
};
