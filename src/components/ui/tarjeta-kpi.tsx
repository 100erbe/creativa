import Link from "next/link";
import { cn } from "@/lib/cn";

// Tarjeta KPI estática (misma anatomía que la dinámica de "KPI / *" en Figma, sin pestañas ni gráfico):
// métrica 14/22 · cifra 28/38 negrita · significado 12/18 secundario · nota opcional.
// Superficie blanca, borde 1px, radio 16, padding 20, sin sombra.

/** Ancho medio de un carácter de la cifra, en "em" (Manrope negrita, con separadores de miles). */
const ANCHO_CARACTER = 0.62;

type TonoKpi = "default" | "peligro" | "critico" | "aviso" | "exito";

const COLOR_NOTA: Record<TonoKpi, string> = {
  default: "text-texto-secundario",
  peligro: "text-texto-peligro",
  critico: "text-texto-critico",
  aviso: "text-texto-aviso",
  exito: "text-texto-exito",
};

/**
 * Cifra que se adapta al ancho real de la tarjeta: 100cqw es el ancho del contenedor y se reparte
 * entre los caracteres del valor. Va de 14 px (tarjeta estrecha o cifra muy larga) a 28 px.
 */
export function CifraKpi({ valor, className }: { valor: string; className?: string }) {
  return (
    <div className="[container-type:inline-size]">
      <p
        className={cn("tabular-nums whitespace-nowrap font-bold leading-[1.357]", className)}
        style={{ fontSize: `clamp(0.875rem, calc(100cqw / ${(valor.length * ANCHO_CARACTER).toFixed(2)}), 1.75rem)` }}
      >
        {valor}
      </p>
    </div>
  );
}

export function TarjetaKpi({
  etiqueta,
  valor,
  significado,
  detalle,
  colorDetalle,
  tono = "default",
  href,
}: {
  etiqueta: string;
  valor: string;
  /** Qué mide la cifra (12/18 secundario bajo el valor). */
  significado?: string;
  /** Nota final (cuenta, estado…). */
  detalle?: string;
  /** Clase de color de la nota; por defecto la del tono. */
  colorDetalle?: string;
  tono?: TonoKpi;
  /** Si se da, la tarjeta lleva al listado que explica la cifra. */
  href?: string;
}) {
  const clases = cn(
    "grid min-w-0 row-span-4 grid-cols-1 grid-rows-subgrid gap-y-0 rounded-xl border border-borde-default bg-fondo-superficie p-esp4 md:p-esp5",
    href &&
      "transition-[background-color,border-color,transform] duration-rapida ease-salida hover:border-borde-fuerte hover:bg-fondo-sutil active:scale-press",
  );
  const contenido = (
    <>
      <p className="self-start text-cuerpo text-texto-primario">{etiqueta}</p>
      <CifraKpi
        valor={valor}
        className={cn("mt-esp1", tono === "critico" ? "text-texto-critico" : "text-texto-primario")}
      />
      {significado ? (
        <p className="mt-esp1 self-start text-etiqueta text-texto-secundario">{significado}</p>
      ) : (
        <span aria-hidden="true" />
      )}
      {detalle ? (
        <p className={cn("tabular-nums self-end pt-esp2 text-etiqueta", colorDetalle ?? COLOR_NOTA[tono])}>{detalle}</p>
      ) : (
        <span aria-hidden="true" />
      )}
    </>
  );
  return href ? (
    <Link href={href} className={clases}>
      {contenido}
    </Link>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}
