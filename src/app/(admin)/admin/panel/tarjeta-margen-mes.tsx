"use client";

import Link from "next/link";
import { Icono } from "@/components/ui/iconos";
import { InsigniaMargen } from "@/components/ui/insignia-margen";
import { euros } from "@/lib/formato";
import type { ResumenMargen } from "@/lib/margen";
import { BotonOjoMargenes, useMargenesVisibles } from "@/lib/margenes-visibles";

/** Tarjeta compacta del Panel: margen bruto del mes en curso, con enlace a Rentabilidad. Se oculta con el ojo. */
export function TarjetaMargenMes({
  mes,
  real,
  previsto,
}: {
  mes: string;
  real: ResumenMargen;
  previsto: ResumenMargen;
}) {
  const visible = useMargenesVisibles();
  return (
    <section
      aria-label={`Margen bruto de ${mes}`}
      className="flex flex-wrap items-center gap-x-esp5 gap-y-esp2 rounded-xl border border-borde-default bg-fondo-superficie px-esp4 py-esp3 md:px-esp5"
    >
      <div className="flex min-w-0 items-center gap-esp3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fondo-marca-sutil text-texto-marca">
          <Icono nombre="rentabilidad" size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-texto-primario">Margen bruto · {mes}</p>
          <p className="text-xs text-texto-terciario">Facturas del mes con coste</p>
        </div>
      </div>

      {!visible ? (
        <p className="text-sm text-texto-terciario">Márgenes ocultos</p>
      ) : real.hayDatos ? (
        <div className="flex flex-wrap items-center gap-esp2">
          <span className="tabular-nums text-lg font-semibold text-texto-primario">{euros(real.beneficio)}</span>
          <InsigniaMargen pct={real.pct} />
          {previsto.hayDatos && (
            <span className="tabular-nums text-xs text-texto-secundario">· previsto {euros(previsto.beneficio)}</span>
          )}
        </div>
      ) : (
        <p className="text-sm text-texto-terciario">
          {real.lineasSinCoste > 0 ? `${euros(real.baseSinCoste)} facturados sin coste` : "Aún sin facturas este mes"}
        </p>
      )}

      <div className="ml-auto flex items-center gap-esp1">
        <BotonOjoMargenes />
        <Link
          href="/admin/rentabilidad"
          className="inline-flex min-h-9 items-center gap-1 rounded-md px-esp2 text-sm font-medium text-texto-marca transition-colors duration-rapida ease-suave hover:bg-fondo-marca-sutil"
        >
          Ver rentabilidad
          <Icono nombre="flechaDerecha" size={14} />
        </Link>
      </div>
    </section>
  );
}
