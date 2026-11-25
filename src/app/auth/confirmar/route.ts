import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_RECUPERACION, DURACION_RECUPERACION_S, crearValorRecuperacion } from "@/lib/recuperacion";

/**
 * Destino del enlace de «He olvidado mi contraseña». Admite los dos formatos de Supabase:
 * `?code=` (PKCE, el que usa @supabase/ssr por defecto) y `?token_hash=&type=recovery`
 * (si la plantilla del email se personaliza).
 *
 * GET no consume el enlace: lleva a una página con un botón «Continuar» que hace POST aquí.
 * Así los antivirus y vistas previas del correo, que abren los enlaces solos, no lo gastan.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const destino = url.clone();
  destino.pathname = "/entrar/recuperar/continuar";
  destino.search = "";
  // sb_flow_id: identifica el flujo PKCE (qué verificador usar) cuando hay varios abiertos.
  for (const clave of ["code", "token_hash", "type", "sb_flow_id"]) {
    const valor = url.searchParams.get(clave);
    if (valor) destino.searchParams.set(clave, valor);
  }
  return NextResponse.redirect(destino);
}

/** Canjea el enlace, abre la sesión y lleva a elegir contraseña. */
export async function POST(request: NextRequest) {
  const datos = await request.formData();
  const texto = (k: string) => {
    const v = datos.get(k);
    return typeof v === "string" && v ? v : null;
  };
  const code = texto("code");
  const tokenHash = texto("token_hash");
  const tipo = texto("type");
  const flujo = texto("sb_flow_id");

  const supabase = await createClient();
  let usuarioId: string | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code, flujo ? { flowId: flujo } : undefined);
    // Solo un código que viene de «He olvidado mi contraseña» (redirectType = recovery)
    // permite fijar contraseña sin escribir la actual. auth-js lo devuelve aunque sus tipos no lo declaren.
    const redirectType = (data as { redirectType?: string | null }).redirectType;
    if (!error && redirectType === "recovery") usuarioId = data.user?.id ?? null;
  } else if (tokenHash && tipo === "recovery") {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    if (!error) usuarioId = data.user?.id ?? null;
  }

  const destino = request.nextUrl.clone();
  destino.search = "";
  if (!usuarioId) {
    destino.pathname = "/entrar/recuperar";
    destino.searchParams.set("error", "enlace");
    return NextResponse.redirect(destino, 303);
  }

  destino.pathname = "/cuenta/contrasena";
  const respuesta = NextResponse.redirect(destino, 303);
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
