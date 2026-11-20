"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Pestanas } from "@/components/ui/pestanas";
import { CifraKpi } from "@/components/ui/tarjeta-kpi";
import { cn } from "@/lib/cn";

// Tarjeta KPI dinámica ("KPI / *" de Figma): métrica, cifra, significado, pestañas de periodo
// (Semana / Mes / Año), gráfico de 84 px con etiquetas de inicio y fin, y una nota o enlace al pie.
// Al pasar el ratón (o enfocar con el teclado, o tocar) un punto del gráfico se resalta y aparece un
// tooltip con el intervalo y su valor. Las series llegan ya calculadas del servidor: cambiar de
// periodo no vuelve a pedir nada.
// - barras: magnitudes de flujo (suma por intervalo: facturación)
// - linea:  saldos al cierre de cada intervalo (pendiente, vencido, campañas activas)

export type PeriodoKpi = "semana" | "mes" | "ano";

export type PuntoKpi = {
  /** Intervalo («7–9 nov», «lun 16», «mar»). */
  etiqueta: string;
  valor: number;
  /** Valor formateado para el tooltip («1.830,00 €», «3 activas»). */
  texto: string;
};

export type SerieKpi = {
  /** Cifra principal del periodo, ya formateada. */
  valor: string;
  puntos: PuntoKpi[];
};

type ColorKpi = "facturacion" | "cobro" | "riesgo" | "campanas";

// Mismos valores que grafico.linea en src/design/tokens.ts.
const COLOR: Record<ColorKpi, { trazo: string; relleno: string; texto: string }> = {
  facturacion: { trazo: "stroke-fondo-marca", relleno: "fill-fondo-marca", texto: "bg-fondo-marca" },
  cobro: { trazo: "stroke-texto-info", relleno: "fill-texto-info", texto: "bg-texto-info" },
  riesgo: { trazo: "stroke-texto-peligro", relleno: "fill-texto-peligro", texto: "bg-texto-peligro" },
  campanas: { trazo: "stroke-texto-exito", relleno: "fill-texto-exito", texto: "bg-texto-exito" },
};

const PERIODOS: { valor: PeriodoKpi; etiqueta: string }[] = [
  { valor: "semana", etiqueta: "Semana" },
  { valor: "mes", etiqueta: "Mes" },
  { valor: "ano", etiqueta: "Año" },
];

// Geometría del gráfico de Figma (274 × 84): línea base en y = 78, máximo a 59 px por encima,
// margen lateral de 8 px.
const ALTO = 84;
const BASE = 78;
const ALTURA_UTIL = 59;

export function TarjetaKpiDinamica({
  etiqueta,
  significado,
  series,
  tipo,
  color,
  nota,
  periodoInicial = "mes",
}: {
  etiqueta: string;
  significado: string;
  series: Record<PeriodoKpi, SerieKpi>;
  tipo: "barras" | "linea";
  color: ColorKpi;
  nota?: { texto: string; href?: string; tono?: "default" | "marca" | "peligro" | "aviso" };
  periodoInicial?: PeriodoKpi;
}) {
  const [periodo, setPeriodo] = useState<PeriodoKpi>(periodoInicial);
  const [activo, setActivo] = useState<number | null>(null);
  const idTitulo = useId();
  const serie = series[periodo];
  const puntos = serie.puntos;
  const n = puntos.length;
  const maximo = Math.max(...puntos.map((p) => p.valor), 0) || 1;
  const c = COLOR[color];

  // Posición horizontal (en %) del centro de cada punto.
  const xPct = (i: number) => (tipo === "barras" ? ((i + 0.5) / n) * 100 : n === 1 ? 50 : (8 + (i * 258) / (n - 1)) / 2.74);
  const yDe = (v: number) => BASE - (v / maximo) * ALTURA_UTIL;
  const puntoActivo = activo != null ? puntos[activo] : undefined;

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

  const colorNota =
    nota?.tono === "marca"
      ? "text-texto-marca"
      : nota?.tono === "peligro"
        ? "text-texto-peligro"
        : nota?.tono === "aviso"
          ? "text-texto-aviso"
          : "text-texto-secundario";

  return (
    <section
      aria-labelledby={idTitulo}
      className="grid min-w-0 row-span-6 grid-cols-1 grid-rows-subgrid gap-y-0 rounded-xl border border-borde-default bg-fondo-superficie p-esp4 md:p-esp5"
    >
      <h2 id={idTitulo} className="self-start text-cuerpo text-texto-primario">
        {etiqueta}
      </h2>
      <CifraKpi valor={serie.valor} className="mt-1.5 text-texto-primario" />
      <p className="mt-1 self-start text-etiqueta text-texto-secundario">{significado}</p>

      <Pestanas
        etiqueta={`Periodo de ${etiqueta}`}
        opciones={PERIODOS}
        valor={periodo}
        onCambio={(p) => {
          setPeriodo(p);
          setActivo(null);
        }}
        className="mt-esp2 self-start"
      />

      {/* Gráfico + etiquetas de eje + alternativa textual agrupados en una sola fila del subgrid */}
      <div>
      {/* Gráfico */}
      <div
        role="group"
        tabIndex={0}
        aria-label={`Gráfico de ${etiqueta}: usa las flechas para recorrer los intervalos`}
        onKeyDown={alTeclear}
        onBlur={() => setActivo(null)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setActivo(null)}
        className="relative mt-esp6 rounded-md outline-offset-4"
        style={{ height: ALTO }}
      >
        {tipo === "barras" ? (
          <div className="absolute inset-x-0 top-0 flex items-end" style={{ height: BASE }} aria-hidden="true">
            {puntos.map((p, i) => (
              <div key={i} className="flex h-full flex-1 items-end justify-center">
                <div
                  className={cn(
                    "w-full max-w-[28px] rounded-sm transition-opacity duration-rapida ease-salida",
                    c.texto,
                    activo === i ? "opacity-100" : "opacity-55",
                  )}
                  style={{ height: p.valor > 0 ? Math.max(2, (p.valor / maximo) * ALTURA_UTIL) : 0, margin: "0 4px" }}
                />
              </div>
            ))}
          </div>
        ) : (
          <svg
            className="absolute inset-0 h-full w-full overflow-visible"
            viewBox={`0 0 100 ${ALTO}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon
              className={c.relleno}
              fillOpacity={0.07}
              points={[
                ...puntos.map((p, i) => `${xPct(i)},${yDe(p.valor)}`),
                `${xPct(n - 1)},${BASE}`,
                `${xPct(0)},${BASE}`,
              ].join(" ")}
            />
            <polyline
              className={c.trazo}
              fill="none"
              strokeWidth={2.4}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              points={puntos.map((p, i) => `${xPct(i)},${yDe(p.valor)}`).join(" ")}
            />
          </svg>
        )}

        {/* Línea base */}
        <div className="absolute inset-x-0 h-px bg-borde-default" style={{ top: BASE }} aria-hidden="true" />

        {/* Punto activo en la línea */}
        {tipo === "linea" && puntoActivo && activo != null && (
          <span
            aria-hidden="true"
            className={cn("absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-fondo-superficie", c.texto)}
            style={{ left: `${xPct(activo)}%`, top: yDe(puntoActivo.valor) }}
          />
        )}

        {/* Zonas de hover (una por intervalo) */}
        <div className="absolute inset-0 flex">
          {puntos.map((p, i) => (
            <div
              key={i}
              className="h-full flex-1"
              onPointerEnter={() => setActivo(i)}
              onPointerDown={() => setActivo(i)}
              aria-hidden="true"
            />
          ))}
        </div>

        {/* Tooltip */}
        {puntoActivo && activo != null && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 flex animate-estado-entrar flex-col gap-0.5 whitespace-nowrap rounded-md bg-fondo-inverso p-esp2 text-texto-inverso"
            style={{
              bottom: ALTO + 2,
              left: `clamp(0px, calc(${xPct(activo)}% - 51px), calc(100% - 102px))`,
            }}
          >
            <span className="text-micro font-medium">{puntoActivo.etiqueta}</span>
            <span className="tabular-nums text-etiqueta">{puntoActivo.texto}</span>
          </div>
        )}
      </div>

      {/* Inicio y fin del intervalo */}
      <div className="mt-1 flex justify-between text-micro font-medium text-texto-secundario" aria-hidden="true">
        <span>{puntos[0]?.etiqueta}</span>
        <span>{puntos[n - 1]?.etiqueta}</span>
      </div>

      {/* Alternativa textual del gráfico */}
      {/* El sr-only va en un div: en una <table> el ancho de 1 px no se aplica y desborda la página. */}
      <div className="sr-only">
      <table>
        <caption>
          {etiqueta} por intervalo ({PERIODOS.find((p) => p.valor === periodo)?.etiqueta})
        </caption>
        <tbody>
          {puntos.map((p, i) => (
            <tr key={i}>
              <th scope="row">{p.etiqueta}</th>
              <td>{p.texto}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      </div>

      {nota ? (
        nota.href ? (
          <Link href={nota.href} className={cn("mt-esp4 self-end justify-self-start text-etiqueta hover:underline", colorNota)}>
            {nota.texto}
          </Link>
        ) : (
          <p className={cn("mt-esp4 self-end text-etiqueta", colorNota)}>{nota.texto}</p>
        )
      ) : (
        <span aria-hidden="true" />
      )}
    </section>
  );
}
