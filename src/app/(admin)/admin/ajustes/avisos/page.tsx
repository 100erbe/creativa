import Link from "next/link";
import { Icono } from "@/components/ui/iconos";
import { PanelAvisos } from "@/components/avisos/panel-avisos";
import { Bandeja } from "@/components/avisos/bandeja";
import { cargarBandeja } from "@/lib/push/bandeja";

export const dynamic = "force-dynamic";

export default async function PaginaAvisosAdmin() {
  const avisos = await cargarBandeja();
  return (
    <div className="flex max-w-2xl flex-col gap-esp5">
      <div className="flex flex-col gap-esp2">
        <Link
          href="/admin/ajustes"
          className="flex w-fit items-center gap-esp1 text-sm text-texto-secundario hover:text-texto-primario"
        >
          <Icono nombre="atras" size={16} />
          Ajustes
        </Link>
        <h1 className="text-2xl font-semibold text-texto-primario">Avisos en este dispositivo</h1>
        <p className="text-sm text-texto-secundario">
          Activa los avisos en tu móvil u ordenador para enterarte de lo que pasa en el campo (por ejemplo, una
          incidencia) sin tener la app abierta. Cada dispositivo se activa por separado.
        </p>
      </div>
      <section className="flex flex-col gap-esp3">
        <h2 className="text-base font-semibold text-texto-primario">Últimos avisos</h2>
        <Bandeja avisos={avisos} />
      </section>
      <PanelAvisos />
    </div>
  );
}
