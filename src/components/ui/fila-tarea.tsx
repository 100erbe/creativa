import Link from "next/link";
import { clasesBoton } from "@/components/ui/boton";
import { cn } from "@/lib/cn";

// Fila de tarea pendiente ("Lists / Task row" de Figma): padding vertical 8, título 12/18 seminegrita,
// detalle 13/20 secundario y el botón secundario «Abrir». Las filas se separan con divide-y en el padre.
export function FilaTarea({
  titulo,
  detalle,
  href,
  etiquetaAccion = "Abrir",
  className,
}: {
  titulo: React.ReactNode;
  detalle?: React.ReactNode;
  href: string;
  etiquetaAccion?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-esp3 py-esp3", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-esp1">
        <p className="text-etiqueta text-texto-primario">{titulo}</p>
        {detalle && <p className="tabular-nums text-meta font-medium text-texto-secundario">{detalle}</p>}
      </div>
      <Link
        href={href}
        className={clasesBoton("secundario", "m", "shrink-0")}
        aria-label={typeof titulo === "string" ? `${etiquetaAccion}: ${titulo}` : undefined}
      >
        {etiquetaAccion}
      </Link>
    </div>
  );
}
