import Link from "next/link";
import { cn } from "@/lib/cn";

/** Ancho medio de un carácter de la cifra, en "em" (Inter seminegrita, con separadores de miles). */
const ANCHO_CARACTER = 0.6;

type TonoKpi = "default" | "peligro" | "critico" | "aviso" | "exito";

const TONO_TARJETA: Record<TonoKpi, string> = {
  default: "border-borde-default bg-fondo-superficie",
  peligro: "border-borde-peligro-sutil border-l-4 border-l-borde-peligro bg-fondo-superficie",
  critico: "border-borde-critico-sutil border-l-4 border-l-borde-critico bg-fondo-critico-sutil/40",
  aviso: "border-borde-aviso border-l-4 border-l-texto-aviso bg-fondo-superficie",
  exito: "border-borde-exito bg-fondo-superficie",
};

export function TarjetaKpi({
  etiqueta,
  valor,
  detalle,
  colorDetalle = "text-texto-secundario",
  tono = "default",
  href,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  colorDetalle?: string;
  tono?: TonoKpi;
  /** Si se da, la tarjeta lleva al listado que explica la cifra. */
  href?: string;
}) {
  const clases = cn(
    "flex min-w-0 flex-1 flex-col gap-esp2 rounded-lg border px-esp4 py-esp4 shadow-xs md:px-esp5 md:py-esp5",
    TONO_TARJETA[tono],
    href &&
      "transition-[background-color,border-color,transform] duration-rapida ease-salida hover:-translate-y-[1px] hover:border-borde-campo hover:bg-fondo-sutil/70 active:scale-press",
  );
  const contenido = (
    <>
      <p className="text-xs font-medium text-texto-secundario md:text-sm">{etiqueta}</p>
      {/*
        La cifra se adapta al ancho real de la tarjeta: 100cqw es el ancho del contenedor y se
        reparte entre los caracteres del valor. Va de 14 px (tarjeta estrecha o cifra muy larga)
        a 28 px (tarjeta ancha), así "67.203,75 €" nunca se corta ni se sale.
      */}
      <div className="[container-type:inline-size]">
        <p
          className={cn(
            "tabular-nums whitespace-nowrap font-semibold leading-9 tracking-[-0.5px]",
            tono === "critico" ? "text-texto-critico" : "text-texto-primario",
          )}
          style={{ fontSize: `clamp(0.875rem, calc(100cqw / ${(valor.length * ANCHO_CARACTER).toFixed(2)}), 1.75rem)` }}
        >
          {valor}
        </p>
      </div>
      {detalle && <p className={cn("tabular-nums text-xs", colorDetalle)}>{detalle}</p>}
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
