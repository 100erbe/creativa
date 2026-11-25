import { cn } from "@/lib/cn";

// Corresponde al componente "Controls / Button" de Figma (sistema "Documentos").
// - primario   → Style=Primary   (fondo de marca, texto blanco)
// - secundario → Style=Quiet     (superficie, borde 1px, texto de marca): la acción secundaria habitual
// - suave      → Style=Secondary (fondo marca-sutil, texto de marca)
// - fantasma   → sin fondo ni borde, texto de marca (enlaces con aspecto de botón)
// - peligro / critico → acciones destructivas (no están en Figma; mismo formato)
type Variante = "primario" | "secundario" | "suave" | "fantasma" | "peligro" | "critico";
type Tamano = "m" | "s";

const variantes: Record<Variante, string> = {
  primario: "bg-fondo-marca text-texto-sobre-marca hover:bg-fondo-marca-hover",
  secundario:
    "bg-fondo-superficie text-texto-marca border border-borde-default hover:border-borde-marca hover:bg-fondo-sutil",
  suave: "bg-fondo-marca-sutil text-texto-marca hover:bg-borde-marca",
  fantasma: "bg-transparent text-texto-marca hover:bg-fondo-marca-sutil",
  peligro: "bg-fondo-peligro text-texto-inverso hover:bg-fondo-peligro-hover",
  critico: "bg-fondo-critico text-texto-inverso hover:bg-fondo-critico-hover",
};

// Figma: alto 42 (padding 12/16, texto 12/18 seminegrita). En móvil, mínimo 44 px de objetivo táctil.
const tamanos: Record<Tamano, string> = {
  m: "min-h-11 h-11 md:min-h-[42px] md:h-[42px] px-esp4 text-etiqueta",
  s: "min-h-11 h-11 md:min-h-8 md:h-8 px-esp3 text-etiqueta",
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamano?: Tamano;
  cargando?: boolean;
};

/** Clases del botón, para dar el mismo aspecto a un <Link> o <a>. */
export function clasesBoton(variante: Variante = "primario", tamano: Tamano = "m", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-esp2 rounded-lg whitespace-nowrap transition-[background-color,border-color,color,opacity,transform] duration-rapida ease-suave active:scale-press disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
    variantes[variante],
    tamanos[tamano],
    className,
  );
}

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
    <button className={clasesBoton(variante, tamano, className)} disabled={disabled || cargando} {...props}>
      {cargando && (
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          className="h-3.5 w-3.5 shrink-0 animate-spin"
        >
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
          <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}
