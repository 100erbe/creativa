import { cn } from "@/lib/cn";

export function TarjetaKpi({
  etiqueta,
  valor,
  detalle,
  colorDetalle = "text-texto-secundario",
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  colorDetalle?: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-esp2 rounded-lg border border-borde-default bg-fondo-superficie px-esp5 py-esp5">
      <p className="text-sm text-texto-secundario">{etiqueta}</p>
      <p className="text-[28px] font-semibold leading-9 tracking-[-0.5px] text-texto-primario">
        {valor}
      </p>
      {detalle && <p className={cn("text-xs", colorDetalle)}>{detalle}</p>}
    </div>
  );
}
