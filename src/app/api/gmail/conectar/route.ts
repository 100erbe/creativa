import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { COOKIE_ESTADO_OAUTH, gmailConfigurado, urlAutorizacion } from "@/lib/gmail";

export const dynamic = "force-dynamic";

/** Lleva al administrador a la pantalla de permiso de Google. */
export async function GET(request: NextRequest) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "admin") return new NextResponse("No autorizado", { status: 401 });

  const origen = request.nextUrl.origin;
  if (!gmailConfigurado()) {
    return NextResponse.redirect(`${origen}/admin/ajustes/gmail?error=${encodeURIComponent("Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el servidor.")}`);
  }

  // Valor aleatorio que Google devuelve tal cual: así solo se acepta la respuesta a esta petición.
  const estado = randomBytes(24).toString("hex");
  const respuesta = NextResponse.redirect(urlAutorizacion(origen, estado));
  respuesta.cookies.set(COOKIE_ESTADO_OAUTH, estado, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/api/gmail",
    maxAge: 600,
  });
  return respuesta;
}
