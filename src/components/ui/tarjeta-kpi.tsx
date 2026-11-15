import Link from "next/link";
import { cn } from "@/lib/cn";

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
    "flex flex-1 flex-col gap-esp2 rounded-lg border border-borde-default bg-fondo-superficie px-esp5 py-esp5",
    href && "transition-colors hover:border-borde-fuerte hover:bg-fondo-sutil",
  );
  const contenido = (
    <>
      <p className="text-sm text-texto-secundario">{etiqueta}</p>
      <p className="text-[28px] font-semibold leading-9 tracking-[-0.5px] text-texto-primario">
        {valor}
      </p>
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
