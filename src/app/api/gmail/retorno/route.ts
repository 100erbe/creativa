import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { COOKIE_ESTADO_OAUTH, conectarCuenta } from "@/lib/gmail";

export const dynamic = "force-dynamic";

function mismoValor(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Google vuelve aquí tras el permiso: se guarda la conexión y se vuelve a Ajustes → Gmail. */
export async function GET(request: NextRequest) {
  const origen = request.nextUrl.origin;
  const volver = (parametro: string) => {
    const r = NextResponse.redirect(`${origen}/admin/ajustes/gmail?${parametro}`);
    r.cookies.set(COOKIE_ESTADO_OAUTH, "", { path: "/api/gmail", maxAge: 0 });
    return r;
  };

  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "admin") return new NextResponse("No autorizado", { status: 401 });

  const parametros = request.nextUrl.searchParams;
  const errorGoogle = parametros.get("error");
  if (errorGoogle) {
    return volver(`error=${encodeURIComponent(errorGoogle === "access_denied" ? "Has cancelado el permiso en Google." : `Google: ${errorGoogle}`)}`);
  }

  const estado = parametros.get("state") ?? "";
  const esperado = request.cookies.get(COOKIE_ESTADO_OAUTH)?.value ?? "";
  const codigo = parametros.get("code");
  if (!codigo || !esperado || !mismoValor(estado, esperado)) {
    return volver(`error=${encodeURIComponent("La respuesta de Google no corresponde a esta petición. Vuelve a intentarlo.")}`);
  }

  try {
    await conectarCuenta(codigo, origen, usuario.id);
    return volver("ok=1");
  } catch (e) {
    return volver(`error=${encodeURIComponent(e instanceof Error ? e.message : "No se ha podido conectar Gmail.")}`);
  }
}
