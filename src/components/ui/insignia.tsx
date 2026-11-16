import { cn } from "@/lib/cn";

// Corresponde al componente "Insignia" de Figma (Tono).
// Ver supabase/LEEME.txt para la correspondencia estado → tono.
export type TonoInsignia =
  | "neutro"
  | "marca"
  | "exito"
  | "aviso"
  | "peligro"
  | "critico"
  | "info";

const tonos: Record<TonoInsignia, string> = {
  neutro: "bg-fondo-sutil border-borde-default text-texto-secundario",
  marca: "bg-fondo-marca-sutil border-borde-marca text-texto-marca",
  exito: "bg-fondo-exito-sutil border-borde-exito text-texto-exito",
  aviso: "bg-fondo-aviso-sutil border-borde-aviso text-texto-aviso",
  peligro: "bg-fondo-peligro-sutil border-borde-peligro-sutil text-texto-peligro",
  critico: "bg-fondo-critico-sutil border-borde-critico-sutil text-texto-critico font-semibold",
  info: "bg-fondo-info-sutil border-borde-info text-texto-info",
};

const tonosSolidos: Partial<Record<TonoInsignia, string>> = {
  critico: "bg-fondo-critico border-borde-critico text-texto-inverso font-semibold",
  peligro: "bg-fondo-peligro border-borde-peligro text-texto-inverso font-semibold",
  marca: "bg-fondo-marca border-fondo-marca text-texto-sobre-marca font-semibold",
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
  enviado: "info",
  aceptado: "exito",
  cobrada: "exito",
  parcial: "info",
  facturado: "neutro",
  sustituido: "neutro",
  rechazado: "peligro",
  caducado: "neutro",
  incidencia: "peligro",
  vencida: "peligro",
  vencida_90: "critico",
  anulado: "peligro",
  cancelada: "peligro",
};

export function Insignia({
  tono,
  solido = false,
  children,
  className,
}: {
  tono: TonoInsignia;
  solido?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-esp1 rounded-completo border px-esp2 py-[2px] text-xs font-medium",
        solido ? (tonosSolidos[tono] ?? tonos[tono]) : tonos[tono],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}
