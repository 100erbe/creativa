"use client";

import { useId, useState } from "react";
import { Pestanas } from "@/components/ui/pestanas";
import { CifraKpi } from "@/components/ui/tarjeta-kpi";
import { cn } from "@/lib/cn";
import type { PeriodoAgenda, SerieAgenda } from "@/lib/series-agenda";

const PERIODOS: { valor: PeriodoAgenda; etiqueta: string }[] = [
  { valor: "semana", etiqueta: "Semana" },
  { valor: "mes", etiqueta: "Mes" },
];

// Misma geometría que TarjetaKpiDinamica (84 px total, línea base en 78 px, área útil 59 px).
const ALTO = 84;
const BASE = 78;
const ALTURA_UTIL = 59;

/**
 * Tarjeta KPI de proyección de trabajo para la vista de empleado (/app/agenda):
 * ocupa todo el ancho bajo las 3 KPI principales e incluye el switch Semana / Mes arriba a la derecha.
 */
export function TarjetaProyeccionAgenda({
  series,
  periodoInicial = "semana",
}: {
  series: Record<PeriodoAgenda, SerieAgenda>;
  periodoInicial?: PeriodoAgenda;
}) {
  const [periodo, setPeriodo] = useState<PeriodoAgenda>(periodoInicial);
  const [activo, setActivo] = useState<number | null>(null);
  const idTitulo = useId();

  const serie = series[periodo];
  const barras = serie.barras;
  const n = barras.length;
  const maximo = Math.max(...barras.map((b) => b.total), 0) || 1;
  const barraActiva = activo != null ? barras[activo] : undefined;
  const xPct = (i: number) => ((i + 0.5) / n) * 100;

  function alTeclear(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActivo((a) => (a == null ? 0 : Math.min(n - 1, a + 1)));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActivo((a) => (a == null ? n - 1 : Math.max(0, a - 1)));
    } else if (e.key === "Escape") {
      setActivo(null);
    }
  }

  return (
    <section
      aria-labelledby={idTitulo}
      className="flex min-w-0 flex-col rounded-xl border border-borde-default bg-fondo-superficie p-esp4 md:p-esp5"
    >
      <div className="flex items-center justify-between gap-esp3">
        <h2 id={idTitulo} className="min-w-0 text-cuerpo text-texto-primario">
          Proyección de trabajo
        </h2>
        <div className="w-[152px] shrink-0">
          <Pestanas
            etiqueta="Periodo de proyección"
            opciones={PERIODOS}
            valor={periodo}
            onCambio={(p) => {
              setPeriodo(p);
              setActivo(null);
            }}
            className="p-0.5"
          />
        </div>
      </div>

      <CifraKpi valor={serie.totalTexto} className="mt-1.5 text-texto-primario" />
      <p className="mt-1 text-etiqueta text-texto-secundario">{serie.subtitulo}</p>

      {/* Gráfico de barras apiladas (hechas + pendientes) */}
      <div
        role="group"
        tabIndex={0}
        aria-label="Gráfico de proyección de trabajo: usa las flechas para recorrer los intervalos"
        onKeyDown={alTeclear}
        onBlur={() => setActivo(null)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setActivo(null)}
        className="relative mt-esp5 rounded-md outline-offset-4"
        style={{ height: ALTO }}
      >
        <div className="absolute inset-x-0 top-0 flex items-end" style={{ height: BASE }} aria-hidden="true">
          {barras.map((b, i) => {
            const hTotal = b.total > 0 ? Math.max(4, Math.round((b.total / maximo) * ALTURA_UTIL)) : 0;
            const hHechas = b.hechas > 0 ? Math.max(3, Math.round((b.hechas / b.total) * hTotal)) : 0;
            const hPendientes = Math.max(0, hTotal - hHechas);
            const resaltada = activo === i;

            return (
              <div key={i} className="flex h-full flex-1 items-end justify-center">
                {b.total > 0 ? (
                  <div
                    className={cn(
                      "flex w-full max-w-[28px] flex-col overflow-hidden rounded-t-sm transition-opacity duration-rapida ease-salida",
                      resaltada ? "opacity-100 ring-2 ring-borde-foco/30" : "opacity-80",
                    )}
                    style={{ margin: "0 4px" }}
                  >
                    {hPendientes > 0 && (
                      <div className="w-full bg-fondo-marca/60" style={{ height: hPendientes }} />
                    )}
                    {hHechas > 0 && (
                      <div className="w-full bg-texto-exito" style={{ height: hHechas }} />
                    )}
                  </div>
                ) : (
                  <div className="h-[2px] w-full max-w-[22px] rounded bg-borde-fuerte" />
                )}
              </div>
            );
          })}
        </div>

        {/* Línea base */}
        <div className="absolute inset-x-0 h-px bg-borde-default" style={{ top: BASE }} aria-hidden="true" />

        {/* Zonas interactivas */}
        <div className="absolute inset-0 flex">
          {barras.map((b, i) => (
            <div
              key={i}
              className="h-full flex-1"
              onPointerEnter={() => setActivo(i)}
              onPointerDown={() => setActivo((prev) => (prev === i ? null : i))}
              aria-hidden="true"
            />
          ))}
        </div>

        {/* Tooltip */}
        {barraActiva && activo != null && (
          <div
            role="status"
            className="animate-estado-entrar pointer-events-none absolute z-10 flex flex-col gap-0.5 whitespace-nowrap rounded-md bg-fondo-inverso p-esp2 text-texto-inverso"
            style={{
              bottom: ALTO + 2,
              left: `clamp(0px, calc(${xPct(activo)}% - 72px), calc(100% - 175px))`,
            }}
          >
            <span className="text-micro font-medium">{barraActiva.etiqueta}</span>
            <span className="tabular-nums text-etiqueta">
              {barraActiva.total} {barraActiva.total === 1 ? "instalación" : "instalaciones"} (
              {barraActiva.hechas} {barraActiva.hechas === 1 ? "hecha" : "hechas"} · {barraActiva.pendientes} pend.)
            </span>
          </div>
        )}
      </div>

      {/* Etiquetas del eje horizontal */}
      {serie.modoEtiquetas === "todas" ? (
        <div className="mt-1 flex text-micro font-medium text-texto-secundario" aria-hidden="true">
          {barras.map((b, i) => (
            <span
              key={i}
              className={cn("flex-1 text-center", b.esHoy && "font-bold text-texto-marca")}
            >
              {b.corto}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-1 flex justify-between text-micro font-medium text-texto-secundario" aria-hidden="true">
          <span>{barras[0]?.corto}</span>
          <span>{barras[n - 1]?.corto}</span>
        </div>
      )}

      {/* Alternativa textual accesible */}
      <div className="sr-only">
        <table>
          <caption>
            Proyección de trabajo ({periodo === "semana" ? "Semana" : "Mes"})
          </caption>
          <tbody>
            {barras.map((b, i) => (
              <tr key={i}>
                <th scope="row">{b.etiqueta}</th>
                <td>
                  {b.total} {b.total === 1 ? "instalación" : "instalaciones"} ({b.hechas}{" "}
                  {b.hechas === 1 ? "hecha" : "hechas"}, {b.pendientes} pendientes)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pie con desglose y leyenda */}
      <div className="mt-esp3 flex flex-wrap items-center justify-between gap-esp2 border-t border-borde-sutil pt-esp3 text-etiqueta text-texto-secundario">
        <span>{serie.nota}</span>
        <span className="inline-flex items-center gap-esp3">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-texto-exito" aria-hidden="true" />
            Hechas
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-fondo-marca/60" aria-hidden="true" />
            Pendientes
          </span>
        </span>
      </div>
    </section>
  );
}
