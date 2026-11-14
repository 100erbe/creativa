"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const BUCKET_FOTOS = "fotos-puntos";
const MAX_BYTES_FOTO = 512 * 1024; // mismo límite que el bucket
const TIPOS_FOTO: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg" };

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
  const tipo =
    (["antes", "instalacion", "despues", "incidencia"] as const).find(
      (t) => t === formData.get("tipo"),
    ) ?? "instalacion";
  const latitud = formData.get("latitud") ? Number(formData.get("latitud")) : null;
  const longitud = formData.get("longitud") ? Number(formData.get("longitud")) : null;

  if (!archivo || !puntoId) throw new Error("Faltan datos de la foto.");

  // La app comprime antes de subir; aquí se rechaza cualquier cosa que no lo esté.
  if (archivo.size > MAX_BYTES_FOTO) throw new Error("La foto es demasiado grande.");
  const extension = TIPOS_FOTO[archivo.type];
  if (!extension) throw new Error("Formato de foto no permitido.");

  const ruta = `punto_${puntoId}/${Date.now()}.${extension}`;
  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_FOTOS)
    .upload(ruta, archivo, { contentType: archivo.type });
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

/**
 * Borra una foto (fila + archivo). Solo la puede borrar quien la subió o un
 * admin: lo garantizan las políticas RLS de fotos_punto y de storage.objects,
 * no esta función. Si la fila no se borra (no es suya), no se toca el archivo.
 */
export async function eliminarFotoPunto(fotoId: number, puntoId: number) {
  const supabase = await createClient();

  const { data: borradas, error } = await supabase
    .from("fotos_punto")
    .delete()
    .eq("id", fotoId)
    .select("url_foto");
  if (error) throw new Error(error.message);
  const borrada = borradas?.[0];
  if (!borrada) throw new Error("No puedes eliminar esta foto.");

  const { error: errorArchivo } = await supabase.storage
    .from(BUCKET_FOTOS)
    .remove([borrada.url_foto]);
  if (errorArchivo) throw new Error(errorArchivo.message);

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
