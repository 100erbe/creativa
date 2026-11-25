import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Se ejecuta en cada petición (ver middleware.ts en la raíz).
 * 1. Refresca la sesión de Supabase (necesario con @supabase/ssr).
 * 2. Protege las rutas /admin y /app según el rol guardado en public.usuarios.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const esRutaAdmin = pathname.startsWith("/admin");
  const esRutaEmpleado = pathname.startsWith("/app");
  const esRutaCuenta = pathname.startsWith("/cuenta");
  // Las tareas programadas (/api/cron) se autentican con su propio secreto, no con la sesión.
  const esRutaApi = pathname.startsWith("/api") && !pathname.startsWith("/api/cron");

  // Verificación en dos pasos: quien la tiene activada (nextLevel = aal2) y aún no ha escrito
  // el código en esta sesión (currentLevel = aal1) no entra en la app, ni en su cuenta, ni en la API.
  if (user && (esRutaAdmin || esRutaEmpleado || esRutaCuenta || esRutaApi)) {
    const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (nivel && nivel.nextLevel === "aal2" && nivel.currentLevel !== "aal2") {
      if (esRutaApi) {
        return NextResponse.json({ error: "Falta la verificación en dos pasos." }, { status: 401 });
      }
      const url = request.nextUrl.clone();
      url.pathname = "/entrar/verificar";
      url.search = "";
      url.searchParams.set("volver", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (!user && (esRutaAdmin || esRutaEmpleado)) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.searchParams.set("volver", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (esRutaAdmin || esRutaEmpleado)) {
    const { data: fila } = await supabase
      .from("usuarios")
      .select("rol, activo")
      .eq("id", user.id)
      .single();

    const rol = fila?.rol as "admin" | "empleado" | undefined;

    if (!fila || !fila.activo) {
      const url = request.nextUrl.clone();
      url.pathname = "/entrar";
      url.searchParams.set("error", "cuenta-inactiva");
      return NextResponse.redirect(url);
    }

    if (esRutaAdmin && rol !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/app/inicio";
      return NextResponse.redirect(url);
    }

    if (esRutaEmpleado && rol !== "empleado") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/panel";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
