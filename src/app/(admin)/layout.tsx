import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { BarraLateral } from "@/components/admin/barra-lateral";
import { IniciarAvisos } from "@/components/avisos/panel-avisos";
import { Campana } from "@/components/avisos/campana";
import { contarNoLeidos } from "@/lib/push/bandeja";

export default async function LayoutAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await obtenerUsuarioActual();

  // El middleware ya protege /admin, pero comprobamos de nuevo aquí por si
  // esta ruta se renderiza en un contexto distinto (p. ej. tests).
  if (!usuario || usuario.rol !== "admin") redirect("/entrar");

  const noLeidos = await contarNoLeidos();
  const iniciales = `${usuario.nombre[0] ?? ""}${usuario.apellidos?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col bg-fondo-lienzo md:flex-row print:block print:bg-fondo-superficie">
      <BarraLateral
        nombre={`${usuario.nombre} ${usuario.apellidos ?? ""}`.trim()}
        rolEtiqueta="Administración"
        iniciales={iniciales}
        noLeidos={noLeidos}
      />
      <IniciarAvisos />
      <div className="min-w-0 flex-1 px-esp4 py-esp5 md:px-esp8 md:py-esp6 print:p-0">
        <div className="-mt-esp2 mb-esp2 hidden justify-end md:flex print:hidden">
          <Campana href="/admin/avisos" etiquetaEnlace="Avisos al equipo" noLeidos={noLeidos} />
        </div>
        {children}
      </div>
    </div>
  );
}
