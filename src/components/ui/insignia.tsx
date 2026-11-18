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

// Sistema "Documentos": etiqueta rectangular (radio 8, padding 4/8, texto 12/18 seminegrita) sin borde,
// como el estado "Datos parciales" de Figma. Solo la variante crítica conserva un borde para distinguirse.
const tonos: Record<TonoInsignia, string> = {
  neutro: "bg-fondo-hover text-texto-secundario",
  marca: "bg-fondo-marca-sutil text-texto-marca",
  exito: "bg-fondo-exito-sutil text-texto-exito",
  aviso: "bg-fondo-aviso-sutil text-texto-aviso",
  peligro: "bg-fondo-peligro-sutil text-texto-peligro",
  critico: "bg-fondo-critico-sutil text-texto-critico ring-1 ring-inset ring-borde-critico-sutil",
  info: "bg-fondo-info-sutil text-texto-info",
};

const tonosSolidos: Partial<Record<TonoInsignia, string>> = {
  critico: "bg-fondo-critico text-texto-inverso",
  peligro: "bg-fondo-peligro text-texto-inverso",
  marca: "bg-fondo-marca text-texto-sobre-marca",
};

// Mapea los estados de negocio (documentos, campañas, puntos) a un tono.
// Mantener sincronizado con supabase/LEEME.txt.
export const TONO_POR_ESTADO: Record<string, TonoInsignia> = {
  borrador: "neutro",
  pendiente: "aviso",
  emitida: "marca",
  emitido: "marca",
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
        "inline-flex items-center gap-esp1 whitespace-nowrap rounded-md px-esp2 py-esp1 text-etiqueta transition-colors duration-rapida ease-suave",
        solido ? (tonosSolidos[tono] ?? tonos[tono]) : tonos[tono],
        className,
      )}
    >
      {tono === "critico" && solido && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />
      )}
      {children}
    </span>
  );
}
