import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  // Si ya hay sesión, reparte directamente según el rol.
  if (user) {
    const { data: fila } = await supabase
      .from("usuarios")
      .select("rol")
      .eq("id", user.id)
      .single();

    if (fila?.rol === "admin") redirect(volver ?? "/admin/panel");
    if (fila?.rol === "empleado") redirect(volver ?? "/app/agenda");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-fondo-lienzo px-esp4">
      <div className="w-full max-w-sm">
        <div className="mb-esp8 flex flex-col items-center gap-esp3">
          <Logo alto={64} />
          <h1 className="sr-only">Creativa · acceso</h1>
        </div>
        <FormularioEntrar
          cuentaInactiva={error === "cuenta-inactiva"}
          volver={volver}
        />
      </div>
    </main>
  );
}
