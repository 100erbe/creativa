import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Foto de una campaña para el cliente, sin login. El bucket es privado:
 * solo se entrega si la ruta pertenece a una foto de la campaña que enseña
 * ese token (comprobado con obtener_fotos_publicas, que además valida que el
 * enlace esté activo y no haya caducado). Luego se firma una URL de 60 s con la
 * service_role key y se redirige a ella.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const ruta = request.nextUrl.searchParams.get("ruta");
  if (!ruta) return new NextResponse("Falta la ruta", { status: 400 });

  const supabase = await createClient();
  const { data: fotos } = await supabase.rpc("obtener_fotos_publicas", { p_token: token });
  if (!fotos?.some((f) => f.url_foto === ruta)) {
    return new NextResponse("No encontrada", { status: 404 });
  }

  const admin = crearClienteAdmin();
  if (!admin) {
    return new NextResponse("Las fotos no están disponibles todavía.", { status: 503 });
  }

  const { data, error } = await admin.storage.from("fotos-puntos").createSignedUrl(ruta, 60);
  if (error || !data?.signedUrl) return new NextResponse("No encontrada", { status: 404 });

  const respuesta = NextResponse.redirect(data.signedUrl, 302);
  respuesta.headers.set("Cache-Control", "private, max-age=30");
  return respuesta;
}
