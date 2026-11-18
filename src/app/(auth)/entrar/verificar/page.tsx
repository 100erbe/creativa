import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rutaSegura } from "@/lib/ruta-segura";
import { Logo } from "@/components/ui/logo";
import { FormularioVerificar } from "./formulario-verificar";

export const dynamic = "force-dynamic";

/**
 * Segundo paso del inicio de sesión: código de 6 cifras de la app de autenticación.
 * Solo llega aquí quien tiene la verificación en dos pasos activada (lo decide el middleware).
 */
export default async function PaginaVerificar({ searchParams }: { searchParams: Promise<{ volver?: string }> }) {
  const { volver } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  // Ya verificada, o sin verificación en dos pasos: a la app.
  if (!nivel || nivel.currentLevel === "aal2" || nivel.nextLevel !== "aal2") redirect(rutaSegura(volver, "/entrar"));

  return (
    <main className="flex min-h-dvh items-center justify-center bg-fondo-lienzo px-esp4">
      <div className="flex w-full max-w-sm flex-col gap-esp6">
        <div className="flex flex-col items-center gap-esp3 text-center">
          <Logo alto={48} />
          <h1 className="text-titulo-panel text-texto-primario">Verificación en dos pasos</h1>
          <p className="text-cuerpo text-texto-secundario">
            Escribe el código de 6 cifras que muestra ahora tu app de autenticación.
          </p>
        </div>
        <FormularioVerificar volver={rutaSegura(volver, "/entrar")} />
      </div>
    </main>
  );
}
