import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { BarraLateral } from "@/components/admin/barra-lateral";

export default async function LayoutAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await obtenerUsuarioActual();

  // El middleware ya protege /admin, pero comprobamos de nuevo aquí por si
  // esta ruta se renderiza en un contexto distinto (p. ej. tests).
  if (!usuario || usuario.rol !== "admin") redirect("/entrar");

  const iniciales = `${usuario.nombre[0] ?? ""}${usuario.apellidos?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col bg-fondo-lienzo md:flex-row print:block print:bg-white">
      <BarraLateral
        nombre={`${usuario.nombre} ${usuario.apellidos ?? ""}`.trim()}
        rolEtiqueta="Administración"
        iniciales={iniciales}
      />
      <div className="min-w-0 flex-1 px-esp4 py-esp5 md:px-esp8 md:py-esp6 print:p-0">{children}</div>
    </div>
  );
}
