import { cn } from "@/lib/cn";

// Corresponde al componente "Botón" de Figma (Variante × Tamaño).
type Variante = "primario" | "secundario" | "fantasma" | "peligro" | "critico";
type Tamano = "m" | "s";

const variantes: Record<Variante, string> = {
  primario: "bg-fondo-marca text-texto-sobre-marca hover:bg-fondo-marca-hover",
  secundario:
    "bg-fondo-superficie text-texto-primario border border-borde-campo hover:bg-fondo-sutil",
  fantasma: "bg-transparent text-texto-marca hover:bg-fondo-marca-sutil",
  peligro: "bg-fondo-peligro text-texto-inverso hover:bg-fondo-peligro-hover",
  critico: "bg-fondo-critico text-texto-inverso hover:bg-fondo-critico-hover",
};

const tamanos: Record<Tamano, string> = {
  m: "min-h-11 h-11 md:min-h-9 md:h-9 px-esp4 text-sm font-medium",
  s: "min-h-9 h-9 md:min-h-8 md:h-8 px-esp3 text-xs font-medium",
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamano?: Tamano;
  cargando?: boolean;
};

export function Boton({
  variante = "primario",
  tamano = "m",
  cargando,
  disabled,
  className,
  children,
  ...props
}: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-esp2 rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variantes[variante],
        tamanos[tamano],
        className,
      )}
      disabled={disabled || cargando}
      {...props}
    >
      {cargando ? "…" : children}
    </button>
  );
}
