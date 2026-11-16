import Link from "next/link";
import { cn } from "@/lib/cn";

/** Ancho medio de un carácter de la cifra, en "em" (Inter seminegrita, con separadores de miles). */
const ANCHO_CARACTER = 0.6;

export function TarjetaKpi({
  etiqueta,
  valor,
  detalle,
  colorDetalle = "text-texto-secundario",
  href,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  colorDetalle?: string;
  /** Si se da, la tarjeta lleva al listado que explica la cifra. */
  href?: string;
}) {
  const clases = cn(
    "flex min-w-0 flex-1 flex-col gap-esp2 rounded-lg border border-borde-default bg-fondo-superficie px-esp5 py-esp5",
    href && "transition-colors hover:border-borde-campo hover:bg-fondo-sutil",
  );
  const contenido = (
    <>
      <p className="text-sm text-texto-secundario">{etiqueta}</p>
      {/*
        La cifra se adapta al ancho real de la tarjeta: 100cqw es el ancho del contenedor y se
        reparte entre los caracteres del valor. Va de 14 px (tarjeta estrecha o cifra muy larga)
        a 28 px (tarjeta ancha), así "67.203,75 €" nunca se corta ni se sale.
      */}
      <div className="[container-type:inline-size]">
        <p
          className="whitespace-nowrap font-semibold leading-9 tracking-[-0.5px] text-texto-primario"
          style={{ fontSize: `clamp(0.875rem, calc(100cqw / ${(valor.length * ANCHO_CARACTER).toFixed(2)}), 1.75rem)` }}
        >
          {valor}
        </p>
      </div>
      {detalle && <p className={cn("text-xs", colorDetalle)}>{detalle}</p>}
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
