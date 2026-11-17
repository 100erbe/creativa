"use client";

import { useEffect, useRef, useState } from "react";
import { Icono } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";

/** Estilo de campo: 44px y 16px en móvil (evita el zoom de iOS), compacto en escritorio. */
export const CAMPO =
  "h-11 w-full rounded-md border border-borde-campo bg-fondo-superficie px-esp3 text-base text-texto-primario outline-none transition-[border-color,box-shadow,background-color] duration-rapida ease-suave focus:border-borde-foco focus:ring-2 focus:ring-borde-foco/20 disabled:bg-fondo-sutil disabled:opacity-60 md:h-9 md:text-sm";

/**
 * Buscador genérico.
 * - Escritorio: desplegable bajo su contenedor (que debe ser `relative`), con foco en la búsqueda.
 * - Móvil: panel a pantalla completa cuya altura sigue al `visualViewport`, de modo que
 *   con el teclado abierto la lista se encoge y sigue siendo desplazable por encima de él.
 *   El teclado no se abre solo y se esconde al desplazar la lista.
 */
export function PanelBusqueda({
  busqueda,
  onBusqueda,
  placeholder,
  onCerrar,
  onEnter,
  children,
}: {
  busqueda: string;
  onBusqueda: (v: string) => void;
  placeholder: string;
  onCerrar: () => void;
  /** Enter en el campo de búsqueda; si no se da, solo esconde el teclado. */
  onEnter?: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState<{ alto: number; arriba: number } | null>(null);
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;

  useEffect(() => {
    const movil = window.matchMedia("(max-width: 767px)").matches;
    if (!movil) {
      entrada.current?.focus();
      const fuera = (e: PointerEvent) => {
        if (!panel.current?.contains(e.target as Node)) cerrarRef.current();
      };
      document.addEventListener("pointerdown", fuera);
      return () => document.removeEventListener("pointerdown", fuera);
    }
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const vv = window.visualViewport;
    const ajustar = () => {
      if (vv) setVista({ alto: vv.height, arriba: vv.offsetTop });
    };
    ajustar();
    vv?.addEventListener("resize", ajustar);
    vv?.addEventListener("scroll", ajustar);
    return () => {
      document.body.style.overflow = anterior;
      vv?.removeEventListener("resize", ajustar);
      vv?.removeEventListener("scroll", ajustar);
    };
  }, []);

  return (
    <div
      ref={panel}
      style={
        vista
          ? ({ "--vv-alto": `${vista.alto}px`, "--vv-arriba": `${vista.arriba}px` } as React.CSSProperties)
          : undefined
      }
      className={cn(
        "animate-estado-entrar fixed inset-x-0 top-[var(--vv-arriba,0px)] z-50 flex h-[var(--vv-alto,100dvh)] flex-col bg-fondo-superficie",
        "md:absolute md:inset-x-0 md:top-full md:z-20 md:mt-1 md:h-auto md:max-h-80 md:rounded-lg md:border md:border-borde-default md:shadow-elevado",
      )}
    >
      <div className="flex items-center gap-esp2 border-b border-borde-default p-esp3 md:p-esp2">
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-texto-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press md:hidden"
        >
          <Icono nombre="atras" size={20} />
        </button>
        <div className="relative min-w-0 flex-1">
          <Icono
            nombre="buscar"
            size={16}
            className="pointer-events-none absolute left-esp3 top-1/2 -translate-y-1/2 text-texto-terciario"
          />
          <input
            ref={entrada}
            type="search"
            enterKeyHint="search"
            value={busqueda}
            onChange={(e) => onBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCerrar();
              if (e.key === "Enter") {
                e.preventDefault();
                if (onEnter) onEnter();
                else entrada.current?.blur();
              }
            }}
            placeholder={placeholder}
            aria-label={placeholder}
            className={cn(CAMPO, "pl-9")}
          />
        </div>
      </div>
      <div
        onTouchMove={() => {
          if (document.activeElement === entrada.current) entrada.current?.blur();
        }}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain p-esp2"
      >
        {children}
      </div>
    </div>
  );
}

/** Barra fija inferior en móvil con la acción principal; en escritorio es un bloque normal. */
export function BarraAccion({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <>
      <div className="h-20 md:hidden" aria-hidden />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 flex items-center gap-esp3 border-t border-borde-default bg-fondo-superficie px-esp4 py-esp3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          "md:static md:z-auto md:border-0 md:bg-transparent md:p-0",
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}
