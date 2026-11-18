import Link from "next/link";
import { EstadoDocumento } from "@/components/ui/estado-documento";
import { Monograma, inicialesDe } from "@/components/ui/monograma";
import { cn } from "@/lib/cn";

// Fila de documento ("Documents / Document row" de Figma): padding 16, radio 16.
// [monograma 40] [cliente 18/26 negrita · número • tipo 13/20] [importe 18/26] [insignia de estado 44]
// Estados: Default (superficie) · Hover (fondo-sutil) · Focus (borde 2px de marca, con :focus-visible).
// Toda la zona izquierda es un enlace al documento; la insignia de estado va aparte (tiene su tooltip).
export function FilaDocumento({
  href,
  cliente,
  numero,
  tipo,
  importe,
  estado,
  textoEstado,
  pago,
  iniciales,
  className,
}: {
  href: string;
  cliente: string | null | undefined;
  numero: string;
  tipo: string;
  /** Importe ya formateado («5.553,90 €»). */
  importe: string;
  /** Estado del documento o de cobro (ver EstadoDocumento). */
  estado: string;
  textoEstado?: string;
  /** Texto bajo el importe (p. ej. «Pagado» en verde). */
  pago?: { texto: string; tono: "exito" | "aviso" | "peligro" | "neutro" };
  iniciales?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-esp3 rounded-xl bg-fondo-superficie p-esp3 transition-[background-color,box-shadow] duration-rapida ease-salida hover:bg-fondo-sutil has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-inset has-[a:focus-visible]:ring-borde-foco md:p-esp4",
        className,
      )}
    >
      <Link
        href={href}
        className="flex min-w-0 flex-1 items-center gap-esp3 rounded-lg focus-visible:outline-none md:gap-esp4"
      >
        <Monograma texto={iniciales ?? inicialesDe(cliente)} />
        <div className="flex min-w-0 flex-1 flex-col gap-esp1">
          <p className="truncate text-base font-bold text-texto-primario md:text-titulo-panel">
            {cliente ?? "Sin cliente"}
          </p>
          <p className="flex min-w-0 items-center gap-esp2 text-meta font-medium text-texto-secundario">
            <span className="tabular-nums truncate">{numero}</span>
            <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-texto-secundario/45" aria-hidden="true" />
            <span className="truncate">{tipo}</span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-esp1 md:w-[142px]">
          <span className="tabular-nums whitespace-nowrap text-sm font-semibold text-texto-primario md:text-importe-fila">
            {importe}
          </span>
          {pago && (
            <span
              className={cn(
                "text-etiqueta",
                pago.tono === "exito" && "text-texto-exito",
                pago.tono === "aviso" && "text-texto-aviso",
                pago.tono === "peligro" && "text-texto-peligro",
                pago.tono === "neutro" && "tabular-nums text-texto-secundario",
              )}
            >
              {pago.texto}
            </span>
          )}
        </div>
      </Link>
      <EstadoDocumento estado={estado} texto={textoEstado} />
    </div>
  );
}
