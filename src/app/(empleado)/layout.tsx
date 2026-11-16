import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { CabeceraEmpleado } from "@/components/empleado/cabecera-empleado";
import { contarNoLeidos } from "@/lib/push/bandeja";
import { avisosUrgentesPendientes } from "@/lib/avisos/pendientes";
import Link from "next/link";
import { SincronizarFotos } from "@/components/empleado/sincronizar-fotos";
import { BannerAvisos, IniciarAvisos } from "@/components/avisos/panel-avisos";

export default async function LayoutEmpleado({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "empleado") redirect("/entrar");
  const iniciales = `${usuario.nombre[0] ?? ""}${usuario.apellidos?.[0] ?? ""}`.toUpperCase();
  const [noLeidos, urgentes] = await Promise.all([contarNoLeidos(), avisosUrgentesPendientes()]);

  return (
    <div className="flex min-h-dvh flex-col bg-fondo-lienzo">
      <CabeceraEmpleado nombre={usuario.nombre} iniciales={iniciales} noLeidos={noLeidos} />
      <main className="flex-1 overflow-y-auto pb-8">
        <IniciarAvisos />
        {urgentes.length > 0 && (
          <Link
            href={`/app/avisos/${urgentes[0]!.id}`}
            className="mx-esp4 mt-esp3 flex items-center gap-esp3 rounded-md border border-borde-peligro bg-fondo-peligro-sutil px-esp3 py-esp3 text-sm text-texto-primario"
          >
            <span className="min-w-0 flex-1">
              <strong className="text-texto-peligro">Aviso urgente sin confirmar</strong>
              <span className="block truncate">{urgentes[0]!.titulo}</span>
              {urgentes.length > 1 && <span className="text-xs text-texto-terciario">y {urgentes.length - 1} más</span>}
            </span>
            <span className="shrink-0 font-semibold text-texto-marca">Abrir</span>
          </Link>
        )}
        <SincronizarFotos />
        <BannerAvisos />
        {children}
      </main>
    </div>
  );
}
