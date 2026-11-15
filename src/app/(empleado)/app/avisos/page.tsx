import { PanelAvisos } from "@/components/avisos/panel-avisos";

export default function PaginaAvisos() {
  return (
    <div className="flex flex-col gap-esp5 px-esp4 pt-esp5">
      <div>
        <h1 className="text-xl font-semibold text-texto-primario">Avisos</h1>
        <p className="text-sm text-texto-secundario">Notificaciones de tu trabajo en este móvil.</p>
      </div>
      <PanelAvisos />
    </div>
  );
}
