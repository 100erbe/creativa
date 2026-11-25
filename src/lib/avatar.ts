import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_AVATARES } from "@/lib/avatar-ruta";

/**
 * URL firmada (1 hora) de una foto de perfil guardada en el bucket, o null si no hay o falla.
 * Con React.cache(): layout y página piden la misma firma una sola vez por petición.
 */
export const urlAvatar = cache(async function urlAvatar(ruta: string | null | undefined): Promise<string | null> {
  if (!ruta) return null;
  // Compatibilidad: una URL completa guardada antes solo vale si es del propio Supabase (la persona
  // puede escribir esta columna: no se pinta una imagen de cualquier dominio).
  if (/^https?:\/\//.test(ruta)) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    return base && ruta.startsWith(`${base}/storage/`) ? ruta : null;
  }
  // Solo rutas del bucket con forma «<uuid>/<archivo>».
  if (!/^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/.test(ruta)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET_AVATARES).createSignedUrl(ruta, 3600);
  return error ? null : data.signedUrl;
});
