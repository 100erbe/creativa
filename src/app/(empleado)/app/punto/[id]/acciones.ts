"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const BUCKET_FOTOS = "fotos-puntos";

/**
 * Sube una foto tomada en el punto a Supabase Storage y registra la fila en
 * fotos_punto con la posición GPS capturada en el móvil en ese momento.
 *
 * Requiere crear antes el bucket "fotos-puntos" en Supabase Storage
 * (privado, con política de subida para el rol empleado) — ver README.
 */
export async function subirFotoPunto(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");

  const archivo = formData.get("archivo") as File;
  const puntoId = Number(formData.get("puntoId"));
  const asignacionId = Number(formData.get("asignacionId")) || null;
  const tipo = String(formData.get("tipo") ?? "instalacion");
  const latitud = formData.get("latitud") ? Number(formData.get("latitud")) : null;
  const longitud = formData.get("longitud") ? Number(formData.get("longitud")) : null;

  if (!archivo || !puntoId) throw new Error("Faltan datos de la foto.");

  const ruta = `punto_${puntoId}/${Date.now()}_${archivo.name}`;
  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_FOTOS)
    .upload(ruta, archivo);
  if (errorSubida) throw new Error(errorSubida.message);

  const { error: errorInsert } = await supabase.from("fotos_punto").insert({
    punto_id: puntoId,
    asignacion_id: asignacionId,
    usuario_id: user.id,
    tipo,
    url_foto: ruta,
    latitud,
    longitud,
  });
  if (errorInsert) throw new Error(errorInsert.message);

  revalidatePath(`/app/punto/${puntoId}`);
}

export async function marcarPuntoInstalado(puntoId: number, asignacionId: number) {
  const supabase = await createClient();

  const { error: errorPunto } = await supabase
    .from("puntos_campana")
    .update({ estado: "instalado" })
    .eq("id", puntoId);
  if (errorPunto) throw new Error(errorPunto.message);

  const { error: errorAsignacion } = await supabase
    .from("asignaciones_punto")
    .update({ estado: "completada", fecha_completada: new Date().toISOString() })
    .eq("id", asignacionId);
  if (errorAsignacion) throw new Error(errorAsignacion.message);

  revalidatePath(`/app/punto/${puntoId}`);
  revalidatePath("/app/agenda");
}

export async function reportarIncidencia(puntoId: number, notas: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("puntos_campana")
    .update({ estado: "incidencia", notas })
    .eq("id", puntoId);
  if (error) throw new Error(error.message);

  revalidatePath(`/app/punto/${puntoId}`);
  revalidatePath("/app/agenda");
}
