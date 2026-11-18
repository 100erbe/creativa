"use client";

import { useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

// Pestañas segmentadas del sistema "Documentos" (componente "Controls / Period tab" de Figma):
// contenedor fondo-sutil con radio 8 y pestañas contiguas de igual ancho.
// - Default:  fondo-sutil + texto secundario
// - Selected: fondo-superficie + texto de marca
// Dos variantes: `Pestanas` (estado en el cliente, radiogroup con flechas) y `PestanasEnlace`
// (cada opción es un enlace: filtros por URL en las páginas de servidor).

const CONTENEDOR = "flex w-full min-w-0 rounded-md bg-fondo-sutil";
const PESTANA =
  "flex min-h-11 min-w-0 flex-1 items-center justify-center gap-esp1 truncate rounded-md px-esp2 text-etiqueta outline-offset-[-2px] transition-[background-color,color] duration-rapida ease-salida md:min-h-[30px]";
const ACTIVA = "bg-fondo-superficie text-texto-marca";
const INACTIVA = "text-texto-secundario hover:text-texto-primario";

export type OpcionPestana<V extends string> = { valor: V; etiqueta: React.ReactNode; contador?: number };

function Contador({ n, activa }: { n?: number; activa: boolean }) {
  if (n == null) return null;
  return (
    <span className={cn("tabular-nums font-medium", activa ? "text-texto-marca" : "text-texto-secundario")}>
      {n}
    </span>
  );
}

export function Pestanas<V extends string>({
  opciones,
  valor,
  onCambio,
  etiqueta,
  alto = "normal",
  className,
}: {
  opciones: OpcionPestana<V>[];
  valor: V;
  onCambio: (valor: V) => void;
  /** Nombre accesible del grupo (p. ej. «Periodo de Facturación»). */
  etiqueta: string;
  /** "alto" = 32 px en escritorio (filtros de paneles); "normal" = 30 px (periodos KPI). */
  alto?: "normal" | "alto";
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function mover(desde: number, paso: number) {
    const i = (desde + paso + opciones.length) % opciones.length;
    const opcion = opciones[i];
    if (!opcion) return;
    onCambio(opcion.valor);
    refs.current[i]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={etiqueta} className={cn(CONTENEDOR, className)}>
      {opciones.map((o, i) => {
        const activa = o.valor === valor;
        return (
          <button
            key={o.valor}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={activa}
            tabIndex={activa ? 0 : -1}
            onClick={() => onCambio(o.valor)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                mover(i, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                mover(i, -1);
              }
            }}
            className={cn(PESTANA, alto === "alto" && "md:min-h-8", activa ? ACTIVA : INACTIVA)}
          >
            {o.etiqueta}
            <Contador n={o.contador} activa={activa} />
          </button>
        );
      })}
    </div>
  );
}

export function PestanasEnlace({
  opciones,
  etiqueta,
  className,
}: {
  opciones: { href: string; etiqueta: React.ReactNode; activa: boolean; contador?: number }[];
  etiqueta: string;
  className?: string;
}) {
  return (
    <nav aria-label={etiqueta} className={cn(CONTENEDOR, className)}>
      {opciones.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          aria-current={o.activa ? "page" : undefined}
          className={cn(PESTANA, "md:min-h-8", o.activa ? ACTIVA : INACTIVA)}
        >
          {o.etiqueta}
          <Contador n={o.contador} activa={o.activa} />
        </Link>
      ))}
    </nav>
  );
}
