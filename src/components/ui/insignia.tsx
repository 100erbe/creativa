import { cn } from "@/lib/cn";

// Corresponde al componente "Insignia" de Figma (Tono).
// Ver supabase/LEEME.txt para la correspondencia estado → tono.
export type TonoInsignia =
  | "neutro"
  | "marca"
  | "exito"
  | "aviso"
  | "peligro"
  | "info";

const tonos: Record<TonoInsignia, string> = {
  neutro: "bg-fondo-sutil border-borde-default text-texto-secundario",
  marca: "bg-fondo-marca-sutil border-borde-marca text-texto-marca",
  exito: "bg-fondo-exito-sutil border-borde-exito text-texto-exito",
  aviso: "bg-fondo-aviso-sutil border-borde-aviso text-texto-aviso",
  peligro: "bg-fondo-peligro-sutil border-borde-peligro-sutil text-texto-peligro",
  info: "bg-fondo-info-sutil border-borde-info text-texto-info",
};

// Mapea los estados de negocio (documentos, campañas, puntos) a un tono.
// Mantener sincronizado con supabase/LEEME.txt.
export const TONO_POR_ESTADO: Record<string, TonoInsignia> = {
  borrador: "neutro",
  pendiente: "aviso",
  emitida: "aviso",
  emitido: "aviso",
  en_curso: "info",
  entregado: "info",
  planificada: "neutro",
  pagada: "exito",
  completada: "exito",
  verificado: "exito",
  instalado: "exito",
  incidencia: "peligro",
  vencida: "peligro",
  anulado: "peligro",
  cancelada: "peligro",
};

export function Insignia({
  tono,
  children,
  className,
}: {
  tono: TonoInsignia;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-esp1 rounded-completo border px-esp2 py-[2px] text-xs font-medium",
        tonos[tono],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
