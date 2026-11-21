import Link from "next/link";
import { Bandeja } from "@/components/avisos/bandeja";
import { clasesBoton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { cargarBandeja } from "@/lib/push/bandeja";

export const dynamic = "force-dynamic";

export default async function PaginaAvisos() {
  const avisos = await cargarBandeja();

  return (
    <div className="flex flex-col gap-esp5 px-esp4 pt-esp5">
      <div className="flex items-start justify-between gap-esp3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-texto-primario">Avisos</h1>
          <p className="text-sm text-texto-secundario">Cambios en tu trabajo y comunicaciones de tu administración.</p>
        </div>
        <Link href="/app/ajustes" className={clasesBoton("secundario", "s", "shrink-0")}>
          <Icono nombre="ajustes" size={16} />
          Configurar
        </Link>
      </div>
      <Bandeja avisos={avisos} />
    </div>
  );
}
