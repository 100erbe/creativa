// Geolocalización para las fotos de los puntos. En el móvil la cámara puede
// suspender la página, así que la ubicación se pide al tocar "Añadir" (antes de
// abrir la cámara) y, si falla, se reintenta al volver.

export type MotivoUbicacion = "denegado" | "sin_senal" | "no_soportado";
export type ResultadoUbicacion = { posicion: GeolocationPosition | null; motivo?: MotivoUbicacion };

type Intento = { pos?: GeolocationPosition; error?: GeolocationPositionError };

function pedir(opciones: PositionOptions): Promise<Intento> {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ pos }),
      (error) => resolve({ error }),
      opciones,
    );
  });
}

/** Primero con GPS preciso; si no hay señal, una posición aproximada (red/wifi) reciente. */
export async function obtenerUbicacion(): Promise<ResultadoUbicacion> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { posicion: null, motivo: "no_soportado" };
  }

  const preciso = await pedir({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  if (preciso.pos) return { posicion: preciso.pos };
  if (preciso.error?.code === 1) return { posicion: null, motivo: "denegado" };

  const aproximado = await pedir({ enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
  if (aproximado.pos) return { posicion: aproximado.pos };
  return { posicion: null, motivo: aproximado.error?.code === 1 ? "denegado" : "sin_senal" };
}

export function mensajeSinUbicacion(motivo?: MotivoUbicacion): string {
  switch (motivo) {
    case "denegado":
      return "El navegador tiene bloqueada la ubicación para este sitio. Actívala en los ajustes del navegador (permisos del sitio) y vuelve a intentarlo.";
    case "no_soportado":
      return "Este dispositivo no permite obtener la ubicación.";
    default:
      return "No se ha podido obtener la ubicación (sin señal GPS). Sal a un sitio abierto y vuelve a intentarlo.";
  }
}
