import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { BarraInferior } from "@/components/empleado/barra-inferior";
import { Logo } from "@/components/ui/logo";

export default async function LayoutEmpleado({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "empleado") redirect("/entrar");

  return (
    <div className="flex min-h-dvh flex-col bg-fondo-lienzo">
      <header className="sticky top-0 z-20 flex items-center justify-center border-b border-borde-default bg-fondo-superficie px-esp4 py-esp2">
        <Logo alto={28} />
      </header>
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>
      <BarraInferior />
    </div>
  );
}
