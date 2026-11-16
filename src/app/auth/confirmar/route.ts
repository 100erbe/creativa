import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_RECUPERACION, DURACION_RECUPERACION_S, crearValorRecuperacion } from "@/lib/recuperacion";

/**
 * Destino del enlace de «He olvidado mi contraseña». Admite los dos formatos de Supabase:
 * `?code=` (PKCE, el que usa @supabase/ssr por defecto) y `?token_hash=&type=recovery`
 * (si la plantilla del email se personaliza). Abre la sesión y lleva a elegir contraseña.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let usuarioId: string | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) usuarioId = data.user?.id ?? null;
  } else if (tokenHash && tipo === "recovery") {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    if (!error) usuarioId = data.user?.id ?? null;
  }

  const destino = url.clone();
  destino.search = "";
  if (!usuarioId) {
    destino.pathname = "/entrar/recuperar";
    destino.searchParams.set("error", "enlace");
    return NextResponse.redirect(destino);
  }

  destino.pathname = "/cuenta/contrasena";
  const respuesta = NextResponse.redirect(destino);
  const valor = crearValorRecuperacion(usuarioId);
  if (!valor) {
    // Sin RECUPERACION_SECRET no se marca la recuperación: la página pedirá la contraseña actual.
    console.error("RECUPERACION_SECRET no configurado: la recuperación por email no puede fijar contraseña.");
    return respuesta;
  }
  respuesta.cookies.set(COOKIE_RECUPERACION, valor, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_RECUPERACION_S,
  });
  return respuesta;
}
