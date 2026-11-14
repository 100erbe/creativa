import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { BarraInferior } from "@/components/empleado/barra-inferior";

export default async function LayoutEmpleado({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "empleado") redirect("/entrar");

  return (
    <div className="flex min-h-dvh flex-col bg-fondo-lienzo">
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>
      <BarraInferior />
    </div>
  );
}
