import { cn } from "@/lib/cn";
import { Icono } from "@/components/ui/iconos";

type Paso = { numero: number; etiqueta: string };

const PASOS: Paso[] = [
  { numero: 1, etiqueta: "Cliente" },
  { numero: 2, etiqueta: "Líneas" },
  { numero: 3, etiqueta: "Revisar y emitir" },
];

export function PasosDocumento({ actual }: { actual: number }) {
  return (
    <div className="flex items-center gap-esp3">
      {PASOS.map((paso, i) => {
        const estado = paso.numero < actual ? "hecho" : paso.numero === actual ? "actual" : "pendiente";
        return (
          <div key={paso.numero} className="flex items-center gap-esp3">
            <div className="flex items-center gap-esp2">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-completo text-xs font-medium",
                  estado === "hecho" && "border border-borde-exito bg-fondo-exito-sutil text-texto-exito",
                  estado === "actual" && "bg-fondo-marca text-texto-sobre-marca",
                  estado === "pendiente" && "border border-borde-fuerte bg-fondo-superficie text-texto-terciario",
                )}
              >
                {estado === "hecho" ? <Icono nombre="check" size={14} /> : paso.numero}
              </div>
              <span
                className={cn(
                  "text-sm",
                  estado === "pendiente" ? "text-texto-terciario" : "text-texto-primario",
                  estado === "actual" && "font-medium",
                )}
              >
                {paso.etiqueta}
              </span>
            </div>
            {i < PASOS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-16 rounded-completo",
                  estado === "hecho" ? "bg-borde-exito" : "bg-fondo-hover",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
