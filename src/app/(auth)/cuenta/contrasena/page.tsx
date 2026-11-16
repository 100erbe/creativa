import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { COOKIE_RECUPERACION, esRecuperacionValida } from "@/lib/recuperacion";
import { Logo } from "@/components/ui/logo";
import { FormularioContrasena } from "./formulario-contrasena";

export const dynamic = "force-dynamic";

/** Cambio de contraseña de la propia persona (administración y miembros). */
export default async function PaginaContrasena() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/entrar?volver=/cuenta/contrasena");

  const recuperacion = esRecuperacionValida((await cookies()).get(COOKIE_RECUPERACION)?.value, usuario.id);
  const inicio = usuario.rol === "admin" ? "/admin/panel" : "/app/agenda";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-fondo-lienzo px-esp4">
      <div className="flex w-full max-w-sm flex-col gap-esp6">
        <div className="flex flex-col items-center gap-esp3">
          <Logo alto={48} />
          <h1 className="text-lg font-semibold text-texto-primario">
            {recuperacion ? "Elige una contraseña nueva" : "Cambiar mi contraseña"}
          </h1>
          <p className="text-center text-sm text-texto-secundario">{usuario.email}</p>
        </div>
        <FormularioContrasena pedirActual={!recuperacion} inicio={inicio} />
        <Link href={inicio} className="text-center text-sm font-medium text-texto-marca">
          Volver a la app
        </Link>
      </div>
    </main>
  );
}
