"use client";

import Link from "next/link";
import { Insignia } from "@/components/ui/insignia";
import { cn } from "@/lib/cn";
import { euros } from "@/lib/formato";
import { Fila } from "./lineas-comun";
import type { SituacionCliente } from "./lineas-comun";

/** Situación de facturación y cobros del cliente (compacta en móvil, completa bajo Resumen en escritorio). */
export function TarjetaSituacionCliente({
  clienteId,
  situacion,
  compacta = false,
}: {
  clienteId: number;
  situacion: SituacionCliente;
  compacta?: boolean;
}) {
  const hayVencido = situacion.vencido > 0.01;
  const claseVencido = situacion.tieneCriticas90
    ? "font-semibold text-texto-critico"
    : hayVencido
      ? "font-semibold text-texto-peligro"
      : "font-medium text-texto-exito";

  const bordeTarjeta = situacion.tieneCriticas90
    ? "border-borde-critico-sutil"
    : hayVencido
      ? "border-borde-peligro-sutil"
      : "border-borde-default";

  if (compacta) {
    return (
      <div className={cn("flex flex-col gap-esp2 rounded-xl border bg-fondo-superficie px-esp4 py-esp3", bordeTarjeta)}>
        <div className="flex items-center justify-between gap-esp2">
          <p className="text-xs font-medium uppercase tracking-wide text-texto-terciario">
            Situación del cliente · {situacion.anio}
          </p>
          {situacion.tieneCriticas90 ? (
            <Insignia tono="critico" solido>
              90+ d · {situacion.maxDiasVencido}d
            </Insignia>
          ) : hayVencido ? (
            <Insignia tono="peligro">Vencido · {situacion.maxDiasVencido}d</Insignia>
          ) : (
            <Link href={`/admin/clientes/${clienteId}`} className="text-xs font-medium text-texto-marca">
              Ver ficha
            </Link>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-esp4 gap-y-esp2">
          <div>
            <p className="text-[11px] text-texto-terciario">Facturado {situacion.anio}</p>
            <p className="tabular-nums text-sm font-medium text-texto-primario">{euros(situacion.facturadoAnio)}</p>
          </div>
          <div>
            <p className="text-[11px] text-texto-terciario">Cobrado {situacion.anio}</p>
            <p
              className={cn(
                "tabular-nums text-sm font-medium",
                situacion.cobradoAnio > 0 ? "text-texto-exito" : "text-texto-primario",
              )}
            >
              {euros(situacion.cobradoAnio)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-texto-terciario">Pendiente</p>
            <p className="tabular-nums text-sm font-medium text-texto-primario">{euros(situacion.pendiente)}</p>
          </div>
          <div>
            <p className="text-[11px] text-texto-terciario">Vencido</p>
            <p className={cn("tabular-nums text-sm", claseVencido)}>
              {hayVencido ? `${euros(situacion.vencido)} (${situacion.maxDiasVencido}d)` : "Al día"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-esp3 rounded-xl border bg-fondo-superficie px-esp6 py-esp5", bordeTarjeta)}>
      <div className="flex items-center justify-between gap-esp2">
        <h2 className="text-titulo-panel text-texto-primario">Situación del cliente</h2>
        <Link href={`/admin/clientes/${clienteId}`} className="text-xs font-medium text-texto-marca hover:underline">
          Ver ficha
        </Link>
      </div>

      <div className="flex flex-col gap-esp2">
        <Fila etiqueta={`Facturado ${situacion.anio}`} valor={euros(situacion.facturadoAnio)} />
        <div className="flex items-center">
          <span className="flex-1 text-sm text-texto-secundario">Cobrado {situacion.anio}</span>
          <span
            className={cn(
              "tabular-nums text-sm font-medium",
              situacion.cobradoAnio > 0 ? "text-texto-exito" : "text-texto-primario",
            )}
          >
            {euros(situacion.cobradoAnio)}
          </span>
        </div>
        <Fila etiqueta="Pendiente" valor={euros(situacion.pendiente)} />
      </div>

      <div className="h-px bg-fondo-hover" />

      <div className="flex items-start justify-between gap-esp2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-texto-secundario">Vencido</p>
          {hayVencido && (
            <p className="tabular-nums text-xs text-texto-terciario">
              {situacion.facturasVencidas} factura{situacion.facturasVencidas === 1 ? "" : "s"} · máx.{" "}
              {situacion.maxDiasVencido} {situacion.maxDiasVencido === 1 ? "día" : "días"}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={cn("tabular-nums text-sm", claseVencido)}>
            {hayVencido ? euros(situacion.vencido) : "Al día"}
          </span>
          {situacion.tieneCriticas90 && (
            <Insignia tono="critico" solido>
              90+ días · {situacion.maxDiasVencido}d
            </Insignia>
          )}
        </div>
      </div>

      {situacion.tieneCriticas90 && (
        <Link
          href={`/admin/clientes/${clienteId}/estado-cuenta`}
          className="text-xs font-medium text-texto-critico hover:underline"
        >
          Ver estado de cuenta →
        </Link>
      )}
    </div>
  );
}
