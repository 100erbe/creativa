"use client";

// Gastos que no se pudieron enviar (sin cobertura o servidor caído): se guardan en el móvil con la
// foto del ticket y se envían solos más tarde. Al llegar, la administración recibe el aviso de siempre.

import { desenvolver } from "@/lib/accion";
import { crearCola, esErrorDeRed } from "@/lib/cola-indexeddb";
import { createClient } from "@/lib/supabase/client";
import { BUCKET_TICKETS } from "@/lib/gastos";
import { enviarGastoGuardado } from "@/app/(admin)/admin/gastos/acciones";

export const EVENTO_COLA_GASTOS = "creativa:cola-gastos";
const MAX_RECHAZOS = 3;

export type GastoPendiente = {
  id?: number;
  creada: number;
  rechazos: number;
  usuarioId: string;
  /** Campos del formulario (todos texto). `ticket_path` se rellena cuando la foto ya está subida. */
  campos: Record<string, string>;
  /** Foto del ticket aún sin subir (null si ya se subió o no había). */
  archivo: Blob | null;
  extension: string;
};

const cola = crearCola<GastoPendiente>("creativa-gastos", EVENTO_COLA_GASTOS);

export const contarGastosPendientes = cola.contar;

/** Guarda el formulario (y la foto si aún no se subió) para enviarlo más tarde. */
export async function encolarGasto(
  formData: FormData,
  usuarioId: string,
  archivo: Blob | null,
): Promise<boolean> {
  const campos: Record<string, string> = {};
  formData.forEach((valor, clave) => {
    if (typeof valor === "string") campos[clave] = valor;
  });
  const extension = archivo?.type === "application/pdf" ? "pdf" : archivo?.type === "image/webp" ? "webp" : "jpg";
  return cola.encolar({ usuarioId, campos, archivo, extension });
}

export type ResultadoSincronizacionGastos = { enviados: number; pendientes: number; descartado: string | null };

let enCurso: Promise<ResultadoSincronizacionGastos> | null = null;

/** Envía los gastos guardados, en orden. Sin conexión se para y se reintenta luego. */
export function sincronizarColaGastos(): Promise<ResultadoSincronizacionGastos> {
  if (enCurso) return enCurso;

  enCurso = (async () => {
    let enviados = 0;
    let descartado: string | null = null;
    for (const gasto of await cola.listar()) {
      try {
        let actual = gasto;
        // 1) Subir la foto (una sola vez: la ruta se guarda para no duplicarla si falla el paso 2).
        if (actual.archivo) {
          const ruta = `${actual.usuarioId}/${crypto.randomUUID()}.${actual.extension}`;
          const { error } = await createClient()
            .storage.from(BUCKET_TICKETS)
            .upload(ruta, actual.archivo, { contentType: actual.archivo.type });
          if (error) throw new Error(error.message);
          actual = { ...actual, archivo: null, campos: { ...actual.campos, ticket_path: ruta } };
          await cola.actualizar(actual);
        }
        // 2) Crear el gasto.
        const datos = new FormData();
        for (const [clave, valor] of Object.entries(actual.campos)) datos.set(clave, valor);
        await desenvolver(enviarGastoGuardado(datos));
        if (actual.id != null) await cola.borrar(actual.id);
        enviados++;
      } catch (e) {
        // Sin cobertura o sesión caducada: no es culpa del gasto, se reintenta luego.
        if (esErrorDeRed(e) || (e instanceof Error && /sesi[oó]n/i.test(e.message))) break;
        const fresco = (await cola.listar()).find((g) => g.id === gasto.id) ?? gasto;
        if (fresco.rechazos + 1 >= MAX_RECHAZOS) {
          if (fresco.id != null) await cola.borrar(fresco.id);
          descartado = `${fresco.campos.concepto || "Gasto"}: ${e instanceof Error ? e.message : "error desconocido"}`;
        } else {
          await cola.actualizar({ ...fresco, rechazos: fresco.rechazos + 1 });
        }
      }
    }
    return { enviados, pendientes: await cola.contar(), descartado };
  })().finally(() => {
    enCurso = null;
  });

  return enCurso;
}
