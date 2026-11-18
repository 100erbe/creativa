import { BotonVolver } from "@/components/ui/boton-volver";
import { PanelAvisos } from "@/components/avisos/panel-avisos";
import { Bandeja } from "@/components/avisos/bandeja";
import { cargarBandeja } from "@/lib/push/bandeja";

export const dynamic = "force-dynamic";

export default async function PaginaAvisos() {
  const avisos = await cargarBandeja();

  return (
    <div className="flex flex-col gap-esp5 px-esp4 pt-esp5">
      <div className="flex flex-col gap-esp2">
        <BotonVolver href="/app/inicio" usarHistorial />
        <div>
          <h1 className="text-2xl font-bold text-texto-primario">Avisos</h1>
          <p className="text-sm text-texto-secundario">Cambios en tu trabajo y comunicaciones de tu administración.</p>
        </div>
      </div>
      <Bandeja avisos={avisos} />
      <PanelAvisos />
    </div>
  );
}
