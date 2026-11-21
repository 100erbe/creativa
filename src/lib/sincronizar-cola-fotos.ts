"use client";

import { desenvolver } from "@/lib/accion";
import {
  borrarPendiente,
  contarPendientes,
  esErrorDeRed,
  listarPendientes,
  marcarRechazo,
} from "@/lib/cola-fotos";
import { subirFotoPunto } from "@/app/(empleado)/app/punto/[id]/acciones";

const MAX_RECHAZOS = 3;

export type ResultadoSincronizacionFotos = {
  enviadas: number;
  pendientes: number;
  descartada: string | null;
};

let enCurso: Promise<ResultadoSincronizacionFotos> | null = null;

/**
 * Envía las fotos guardadas en IndexedDB sin solapar envíos si se invoca a la vez
 * desde el sincronizador automático y desde el botón manual en Ajustes.
 */
export function sincronizarColaFotos(): Promise<ResultadoSincronizacionFotos> {
  if (enCurso) return enCurso;

  enCurso = (async () => {
    let enviadas = 0;
    let descartada: string | null = null;
    for (const foto of await listarPendientes()) {
      const datos = new FormData();
      for (const [clave, valor] of Object.entries(foto.campos)) datos.set(clave, valor);
      datos.set("archivo", new File([foto.archivo], foto.nombre, { type: foto.archivo.type }));
      try {
        await desenvolver(subirFotoPunto(datos));
        if (foto.id != null) await borrarPendiente(foto.id);
        enviadas++;
      } catch (e) {
        // Sin cobertura o sesión caducada: no es culpa de la foto, se reintenta luego.
        if (esErrorDeRed(e) || (e instanceof Error && /sesi[oó]n/i.test(e.message))) break;
        if (foto.rechazos + 1 >= MAX_RECHAZOS) {
          if (foto.id != null) await borrarPendiente(foto.id);
          descartada = e instanceof Error ? e.message : "error desconocido";
        } else {
          await marcarRechazo(foto);
        }
      }
    }
    const pendientes = await contarPendientes();
    return { enviadas, pendientes, descartada };
  })().finally(() => {
    enCurso = null;
  });

  return enCurso;
}
