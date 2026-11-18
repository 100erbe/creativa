import { Icono, type NombreIcono } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";

// Estado vacío ("Empty campaign state" de Figma): cuadro 64×64 fondo-sutil radio 16 con icono 28,
// título 16/24 seminegrita, descripción 14/22 secundaria centrada (máx. 352 px) y una acción opcional.
export function EstadoVacio({
  icono,
  titulo,
  descripcion,
  accion,
  className,
}: {
  icono: NombreIcono;
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  accion?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-esp4 py-esp6 text-center", className)}>
      <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-fondo-sutil" aria-hidden="true">
        <Icono nombre={icono} size={28} className="text-icono-default" />
      </span>
      <p className="text-destacado text-texto-primario">{titulo}</p>
      {descripcion && <p className="max-w-[352px] text-cuerpo text-texto-secundario">{descripcion}</p>}
      {accion}
    </div>
  );
}
