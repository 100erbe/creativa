"use client";

import { InsigniaMargen } from "@/components/ui/insignia-margen";
import { cn } from "@/lib/cn";
import { euros } from "@/lib/formato";
import { MARGEN_BUENO_PCT, nivelMargen, type ResumenMargen } from "@/lib/margen";
import { BotonOjoMargenes, useMargenesVisibles } from "@/lib/margenes-visibles";

const COLOR_BARRA = { bajo: "bg-texto-peligro", medio: "bg-texto-aviso", bueno: "bg-texto-exito" } as const;

/**
 * Bloque «Margen bruto» / «Margen previsto» (presupuestos) de un documento.
 * Solo pantallas internas: NUNCA en la impresión, el PDF ni el enlace del cliente.
 * Con el ojo se oculta en este dispositivo.
 */
export function BloqueMargen({
  resumen,
  previsto = false,
  className,
}: {
  resumen: ResumenMargen;
  previsto?: boolean;
  className?: string;
}) {
  const visible = useMargenesVisibles();
  const titulo = previsto ? "Margen previsto" : "Margen bruto";
  const nivel = nivelMargen(resumen.pct);
  // La barra llega al 100 % con el doble del margen «bueno» (70 %): así se ve la diferencia entre 20 y 40.
  const ancho = resumen.pct == null ? 0 : Math.max(0, Math.min(100, (resumen.pct / (MARGEN_BUENO_PCT * 2)) * 100));

  return (
    <section
      aria-label={titulo}
      className={cn("flex flex-col gap-esp2 rounded-lg border border-dashed border-borde-default bg-fondo-sutil/60 p-esp3", className)}
    >
      <div className="flex items-center gap-esp2">
        <h3 className="flex-1 text-sm font-semibold text-texto-primario">{titulo}</h3>
        <BotonOjoMargenes className="-my-esp2 -mr-esp2" />
      </div>

      {!visible ? (
        <p className="text-xs text-texto-terciario">Márgenes ocultos en este dispositivo.</p>
      ) : !resumen.hayDatos ? (
        <p className="text-xs text-texto-terciario">
          Ninguna línea tiene coste todavía. Añade el coste en las líneas o en el catálogo para ver el margen.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-texto-secundario">Coste</span>
              <span className="tabular-nums text-texto-primario">{euros(resumen.coste)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-texto-secundario">Beneficio</span>
              <span className="tabular-nums font-semibold text-texto-primario">{euros(resumen.beneficio)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-texto-secundario">Margen</span>
              <InsigniaMargen pct={resumen.pct} />
            </div>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-completo bg-fondo-hover"
            role="presentation"
          >
            <div className={cn("h-full rounded-completo", nivel ? COLOR_BARRA[nivel] : "")} style={{ width: `${ancho}%` }} />
          </div>
          {resumen.lineasSinCoste > 0 && (
            <p className="text-xs text-texto-terciario">
              {resumen.lineasSinCoste === 1 ? "1 línea sin coste" : `${resumen.lineasSinCoste} líneas sin coste`} (
              {euros(resumen.baseSinCoste)}) fuera del cálculo.
            </p>
          )}
        </>
      )}
    </section>
  );
}
