"use client";

import { useState } from "react";
import Link from "next/link";
import { Icono } from "@/components/ui/iconos";
import { TarjetaPunto, type FilaEnriquecida } from "@/components/empleado/tarjeta-punto";
import { cn } from "@/lib/cn";

type ClaveFiltro = "hoy" | "pendientes" | "atrasados";

/**
 * Strip de las 3 tarjetas KPI principales en /app/inicio.
 * Al tocar una tarjeta se despliega justo debajo un panel animado con los resultados ya filtrados.
 */
export function KpiStripDesplegable({
  deHoy,
  pendientes,
  atrasados,
  criticosCount,
}: {
  deHoy: FilaEnriquecida[];
  pendientes: FilaEnriquecida[];
  atrasados: FilaEnriquecida[];
  criticosCount: number;
}) {
  const [activo, setActivo] = useState<ClaveFiltro | null>(null);

  const tarjetas: {
    clave: ClaveFiltro;
    etiqueta: string;
    cantidad: number;
    items: FilaEnriquecida[];
    agendaHref: string;
    vacio: string;
    tono: "normal" | "peligro" | "critico";
  }[] = [
    {
      clave: "hoy",
      etiqueta: "Para hoy",
      cantidad: deHoy.length,
      items: deHoy,
      agendaHref: "/app/agenda?filtro=hoy",
      vacio: "No tienes instalaciones programadas para hoy.",
      tono: "normal",
    },
    {
      clave: "pendientes",
      etiqueta: "Pendientes",
      cantidad: pendientes.length,
      items: pendientes,
      agendaHref: "/app/agenda",
      vacio: "No tienes instalaciones pendientes.",
      tono: "normal",
    },
    {
      clave: "atrasados",
      etiqueta: "Atrasados",
      cantidad: atrasados.length,
      items: atrasados,
      agendaHref: "/app/agenda?filtro=atrasados",
      vacio: "No tienes puntos atrasados ni incidencias.",
      tono: criticosCount > 0 ? "critico" : atrasados.length > 0 ? "peligro" : "normal",
    },
  ];

  const tarjetaActiva = tarjetas.find((t) => t.clave === activo) ?? null;

  return (
    <div className="flex flex-col gap-esp3">
      <div className="grid grid-cols-3 gap-esp2 sm:gap-esp3">
        {tarjetas.map((t) => {
          const abierta = activo === t.clave;
          const baseCard =
            t.tono === "critico"
              ? "rounded-lg border border-borde-critico-sutil border-l-4 border-l-borde-critico bg-fondo-critico-sutil/60 hover:bg-fondo-critico-sutil"
              : t.tono === "peligro"
                ? "rounded-lg border border-borde-peligro-sutil border-l-4 border-l-borde-peligro bg-fondo-peligro-sutil/60 hover:bg-fondo-peligro-sutil"
                : "rounded-xl border border-borde-default bg-fondo-superficie hover:bg-fondo-sutil";

          const colorTexto =
            t.tono === "critico"
              ? "text-texto-critico"
              : t.tono === "peligro"
                ? "text-texto-peligro"
                : "text-texto-secundario";

          const colorNumero =
            t.tono === "critico"
              ? "text-texto-critico"
              : t.tono === "peligro"
                ? "text-texto-peligro"
                : "text-texto-primario";

          return (
            <button
              key={t.clave}
              type="button"
              aria-expanded={abierta}
              aria-controls="panel-kpi-desplegable"
              onClick={() => setActivo((prev) => (prev === t.clave ? null : t.clave))}
              className={cn(
                "flex min-h-[72px] flex-col justify-between gap-0.5 px-esp3 py-esp3 text-left transition-[background-color,border-color,transform] duration-rapida ease-suave active:scale-press",
                baseCard,
                abierta &&
                  (t.tono === "critico"
                    ? "ring-2 ring-borde-critico/30"
                    : t.tono === "peligro"
                      ? "ring-2 ring-borde-peligro/30"
                      : "border-borde-foco ring-2 ring-borde-foco/20"),
              )}
            >
              <span className="flex w-full items-center justify-between gap-1">
                <span className={cn("truncate text-micro font-medium", colorTexto)}>{t.etiqueta}</span>
                <Icono
                  nombre="chevron"
                  size={14}
                  className={cn(
                    "shrink-0 transition-transform duration-media ease-salida",
                    abierta ? "-rotate-90 text-icono-marca" : "rotate-90 text-icono-secundario",
                  )}
                />
              </span>
              <span className={cn("tabular-nums text-xl font-semibold", colorNumero)}>{t.cantidad}</span>
            </button>
          );
        })}
      </div>

      {tarjetaActiva && (
        <section
          key={tarjetaActiva.clave}
          id="panel-kpi-desplegable"
          aria-label={`Detalle de ${tarjetaActiva.etiqueta}`}
          className="animate-estado-entrar flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie p-esp3 shadow-sm sm:p-esp4"
        >
          <div className="flex items-center justify-between gap-esp2 border-b border-borde-sutil pb-esp2">
            <div className="flex items-center gap-esp2">
              <h3 className="text-sm font-semibold text-texto-primario">
                {tarjetaActiva.etiqueta} · {tarjetaActiva.cantidad}
              </h3>
            </div>
            <div className="flex items-center gap-esp2">
              <Link
                href={tarjetaActiva.agendaHref}
                className="text-xs font-medium text-texto-marca hover:underline"
              >
                Ver en Agenda →
              </Link>
              <button
                type="button"
                aria-label="Cerrar desplegable"
                onClick={() => setActivo(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
              >
                <Icono nombre="cerrar" size={18} />
              </button>
            </div>
          </div>

          {tarjetaActiva.items.length > 0 ? (
            <div className="flex max-h-80 flex-col gap-esp2 overflow-y-auto pr-0.5">
              {tarjetaActiva.items.map((p) => (
                <TarjetaPunto key={p.asignacion_id} p={p} />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-borde-default px-esp3 py-esp4 text-center text-xs text-texto-terciario">
              {tarjetaActiva.vacio}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
