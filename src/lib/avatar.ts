import "server-only";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_AVATARES } from "@/lib/avatar-ruta";

/** URL firmada (1 hora) de una foto de perfil guardada en el bucket, o null si no hay o falla. */
export async function urlAvatar(ruta: string | null | undefined): Promise<string | null> {
  if (!ruta) return null;
  // Compatibilidad: si algún día se guardó una URL completa, se usa tal cual.
  if (/^https?:\/\//.test(ruta)) return ruta;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET_AVATARES).createSignedUrl(ruta, 3600);
  return error ? null : data.signedUrl;
}
