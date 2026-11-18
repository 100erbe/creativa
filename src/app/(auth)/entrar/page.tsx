import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rutaSegura } from "@/lib/ruta-segura";
import { Logo } from "@/components/ui/logo";
import { FormularioEntrar } from "./formulario-entrar";

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string; error?: string }>;
}) {
  const { volver, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Hay sesión pero la cuenta no sirve (sin perfil o desactivada): se queda en esta
  // página con el aviso y un botón para cerrar la sesión. Redirigir aquí crearía un
  // bucle con el middleware, que devuelve a /entrar a las cuentas inactivas.
  let sesionSinAcceso = false;

  if (user) {
    const { data: fila } = await supabase
      .from("usuarios")
      .select("rol, activo")
      .eq("id", user.id)
      .single();

    if (fila?.activo && fila.rol === "admin") redirect(rutaSegura(volver, "/admin/panel"));
    if (fila?.activo && fila.rol === "empleado") redirect(rutaSegura(volver, "/app/inicio"));
    sesionSinAcceso = true;
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-fondo-lienzo px-esp4">
      <div className="w-full max-w-sm">
        <div className="mb-esp8 flex flex-col items-center gap-esp3">
          <Logo alto={64} />
          <h1 className="sr-only">Creativa · acceso</h1>
        </div>
        <FormularioEntrar
          cuentaInactiva={error === "cuenta-inactiva" || sesionSinAcceso}
          sesionAbierta={sesionSinAcceso}
          volver={rutaSegura(volver, "")}
        />
      </div>
    </main>
  );
}
