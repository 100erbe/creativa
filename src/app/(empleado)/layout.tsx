import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { BarraInferior } from "@/components/empleado/barra-inferior";
import { Logo } from "@/components/ui/logo";
import { contarNoLeidos } from "@/lib/push/bandeja";
import { avisosUrgentesPendientes } from "@/lib/avisos/pendientes";
import Link from "next/link";
import { BotonSalir } from "@/components/empleado/boton-salir";
import { SincronizarFotos } from "@/components/empleado/sincronizar-fotos";
import { BannerAvisos, IniciarAvisos } from "@/components/avisos/panel-avisos";

export default async function LayoutEmpleado({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "empleado") redirect("/entrar");
  const [noLeidos, urgentes] = await Promise.all([contarNoLeidos(), avisosUrgentesPendientes()]);

  return (
    <div className="flex min-h-dvh flex-col bg-fondo-lienzo">
      <header className="sticky top-0 z-20 flex items-center justify-center border-b border-borde-default bg-fondo-superficie px-esp4 py-esp2">
        <Logo alto={28} />
        <BotonSalir />
      </header>
      <main className="flex-1 overflow-y-auto pb-20">
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
      <BarraInferior noLeidos={noLeidos} />
    </div>
  );
}
