"use client";

import { comprimirImagen } from "@/lib/comprimir-imagen";
import { encolarFoto, esErrorDeRed } from "@/lib/cola-fotos";
import type { OrigenFoto, OrigenUbicacion } from "@/lib/foto-metadatos";
import { desenvolver } from "@/lib/accion";
import { subirFotoPunto } from "@/app/(empleado)/app/punto/[id]/acciones";

export type DatosFotoSubida = {
  origenFoto: OrigenFoto;
  ubicacion: { latitud: number; longitud: number; origen: OrigenUbicacion } | null;
  tomadaEn?: string;
};

/**
 * Comprime y sube una foto de punto con sus metadatos. Sin cobertura la encola en el móvil
 * para enviarla automáticamente más tarde; cualquier otro fallo se propaga.
 */
export async function subirOEncolarFotoPunto(
  puntoId: number,
  asignacionId: number | null,
  archivo: File,
  datos: DatosFotoSubida,
): Promise<"subida" | "encolada"> {
  const comprimida = await comprimirImagen(archivo);
  const formData = new FormData();
  formData.set("archivo", comprimida);
  formData.set("puntoId", String(puntoId));
  if (asignacionId) formData.set("asignacionId", String(asignacionId));
  formData.set("tipo", "instalacion");
  formData.set("origenFoto", datos.origenFoto);
  if (datos.ubicacion) {
    formData.set("latitud", String(datos.ubicacion.latitud));
    formData.set("longitud", String(datos.ubicacion.longitud));
    formData.set("origenUbicacion", datos.ubicacion.origen);
  }
  if (datos.tomadaEn) formData.set("tomadaEn", datos.tomadaEn);

  try {
    await desenvolver(subirFotoPunto(formData));
    return "subida";
  } catch (e) {
    if (esErrorDeRed(e)) {
      const campos: Record<string, string> = {};
      formData.forEach((valor, clave) => {
        if (typeof valor === "string") campos[clave] = valor;
      });
      const guardada = await encolarFoto({
        puntoId,
        nombre: comprimida.name || "foto.webp",
        archivo: comprimida,
        campos,
      });
      if (guardada) return "encolada";
    }
    throw e;
  }
}
