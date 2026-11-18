import { cn } from "@/lib/cn";

// Tarjeta base del sistema "Documentos" (paneles de Figma): superficie blanca, borde 1px, radio 16, sin sombra.
// - panel: padding 24 (paneles del panel de control y de las fichas)
// - kpi:   padding 20 (tarjetas KPI)
// - lista: padding 16 (listados densos: las filas llevan su propio padding)
// - ninguno: sin padding (tablas que llegan al borde)
type Relleno = "panel" | "kpi" | "lista" | "ninguno";

const RELLENO: Record<Relleno, string> = {
  panel: "p-esp4 md:p-esp6",
  kpi: "p-esp4 md:p-esp5",
  lista: "p-esp2 md:p-esp4",
  ninguno: "",
};

type Props = React.HTMLAttributes<HTMLElement> & {
  relleno?: Relleno;
  /** Elemento HTML: `section` cuando la tarjeta tiene título propio (con aria-labelledby). */
  como?: "div" | "section" | "article" | "aside";
};

export function Tarjeta({ relleno = "panel", como: Etiqueta = "div", className, children, ...props }: Props) {
  return (
    <Etiqueta
      className={cn(
        "flex min-w-0 flex-col gap-esp4 rounded-xl border border-borde-default bg-fondo-superficie md:gap-esp5",
        RELLENO[relleno],
        className,
      )}
      {...props}
    >
      {children}
    </Etiqueta>
  );
}

/**
 * Cabecera de tarjeta: título 18/26 negrita, descripción opcional, y a la derecha un estado de los datos
 * (p. ej. <Insignia tono="aviso">Datos parciales</Insignia>) y/o una acción (botón secundario «Ver todos»).
 */
export function CabeceraTarjeta({
  titulo,
  id,
  descripcion,
  estado,
  accion,
  nivel = 2,
  className,
}: {
  titulo: React.ReactNode;
  /** Id del título, para el aria-labelledby de la tarjeta. */
  id?: string;
  descripcion?: React.ReactNode;
  estado?: React.ReactNode;
  accion?: React.ReactNode;
  nivel?: 2 | 3;
  className?: string;
}) {
  const Titulo = nivel === 2 ? "h2" : "h3";
  return (
    <div className={cn("flex min-w-0 items-center gap-esp3", className)}>
      <div className="min-w-0 flex-1">
        <Titulo id={id} className="text-titulo-panel text-texto-primario">
          {titulo}
        </Titulo>
        {descripcion && <p className="mt-0.5 text-meta font-medium text-texto-secundario">{descripcion}</p>}
      </div>
      {estado && <div className="shrink-0">{estado}</div>}
      {accion && <div className="shrink-0">{accion}</div>}
    </div>
  );
}
