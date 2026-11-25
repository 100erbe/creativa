"use client";

import { useRef, useState } from "react";
import { confirmar } from "@/components/ui/dialogos";
import { Icono } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";
import { useAccion } from "@/lib/use-accion";

const ANCHO_ACCION_ELIMINAR = 80;

/**
 * Envuelve la tarjeta de un punto permitiendo:
 * - Clic/tap para abrir el modal de detalles (respetando botones, enlaces o selects internos si los hay).
 * - Gesto o scroll horizontal hacia la izquierda (en móvil y trackpad/ratón) para revelar la papelera animada de borrado.
 */
export function TarjetaDeslizablePunto({
  nombreVisible,
  eliminable,
  swipeAbierto,
  onAbrirSwipe,
  onCerrarSwipe,
  onAbrirModal,
  onEliminar,
  className,
  children,
}: {
  nombreVisible: string;
  eliminable: boolean;
  swipeAbierto: boolean;
  onAbrirSwipe: () => void;
  onCerrarSwipe: () => void;
  onAbrirModal: () => void;
  onEliminar: () => Promise<void>;
  className?: string;
  children: React.ReactNode;
}) {
  const { pendiente, error, ejecutar } = useAccion({ refrescar: true });
  const [desplazamientoDrag, setDesplazamientoDrag] = useState<number | null>(null);
  const gestoRef = useRef<{
    pointerId: number;
    inicioX: number;
    inicioY: number;
    base: number;
    bloqueado: "horizontal" | "vertical" | null;
  } | null>(null);
  const suprimirClicRef = useRef(false);

  const desplazamiento = eliminable ? (desplazamientoDrag ?? (swipeAbierto ? -ANCHO_ACCION_ELIMINAR : 0)) : 0;
  const arrastreActivo = desplazamientoDrag !== null;
  const progresoAccion = Math.min(1, Math.max(0, Math.abs(desplazamiento) / ANCHO_ACCION_ELIMINAR));
  const accionVisible = eliminable && (swipeAbierto || desplazamiento < -4);

  function esElementoInteractivo(target: EventTarget | null) {
    return Boolean((target as HTMLElement | null)?.closest("a, select, input, textarea, label, [data-accion-fila]"));
  }

  function alIniciarPuntero(e: React.PointerEvent<HTMLDivElement>) {
    if (!eliminable || pendiente) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (esElementoInteractivo(e.target)) return;
    suprimirClicRef.current = false;
    gestoRef.current = {
      pointerId: e.pointerId,
      inicioX: e.clientX,
      inicioY: e.clientY,
      base: swipeAbierto ? -ANCHO_ACCION_ELIMINAR : 0,
      bloqueado: null,
    };
  }

  function alMoverPuntero(e: React.PointerEvent<HTMLDivElement>) {
    const gesto = gestoRef.current;
    if (!gesto || e.pointerId !== gesto.pointerId) return;
    const dx = e.clientX - gesto.inicioX;
    const dy = e.clientY - gesto.inicioY;

    if (!gesto.bloqueado) {
      if (Math.hypot(dx, dy) < 8) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        gesto.bloqueado = "horizontal";
        suprimirClicRef.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } else {
        gesto.bloqueado = "vertical";
        return;
      }
    }

    if (gesto.bloqueado !== "horizontal") return;
    const siguiente = Math.max(-ANCHO_ACCION_ELIMINAR - 8, Math.min(0, gesto.base + dx));
    setDesplazamientoDrag(siguiente);
  }

  function alTerminarPuntero(e: React.PointerEvent<HTMLDivElement>) {
    const gesto = gestoRef.current;
    if (!gesto || e.pointerId !== gesto.pointerId) return;
    gestoRef.current = null;
    if (gesto.bloqueado !== "horizontal") return;

    const final = desplazamientoDrag ?? gesto.base;
    setDesplazamientoDrag(null);
    if (final <= -(ANCHO_ACCION_ELIMINAR * 0.45)) {
      onAbrirSwipe();
    } else {
      onCerrarSwipe();
    }
    setTimeout(() => {
      suprimirClicRef.current = false;
    }, 60);
  }

  function alRueda(e: React.WheelEvent<HTMLDivElement>) {
    if (!eliminable || pendiente) return;
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    if (e.deltaX > 12) {
      onAbrirSwipe();
    } else if (e.deltaX < -12) {
      onCerrarSwipe();
    }
  }

  async function eliminarConConfirmacion() {
    if (!(await confirmar(`¿Eliminar el punto «${nombreVisible}»?`))) {
      onCerrarSwipe();
      return;
    }
    ejecutar(async () => {
      await onEliminar();
      onCerrarSwipe();
    });
  }

  return (
    <div className="relative overflow-hidden">
      {eliminable && (
        <div
          aria-hidden={!accionVisible}
          className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-fondo-peligro"
        >
          <button
            type="button"
            tabIndex={swipeAbierto ? 0 : -1}
            disabled={pendiente}
            aria-label={`Eliminar ${nombreVisible}`}
            onClick={() => void eliminarConConfirmacion()}
            style={{
              opacity: Math.max(0.25, progresoAccion),
              transform: `scale(${0.76 + 0.24 * progresoAccion})`,
            }}
            className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-texto-inverso transition-[opacity,transform,background-color] duration-rapida ease-salida hover:bg-fondo-peligro-hover active:scale-press disabled:opacity-50"
          >
            <Icono nombre="eliminar" size={18} />
            <span className="text-micro font-medium">Eliminar</span>
          </button>
        </div>
      )}

      {/* La tarjeta no es un botón (dentro hay otros controles: no se anidan elementos interactivos).
          Para teclado y lectores de pantalla, «Ver detalles» es un botón propio que se ve al enfocarlo. */}
      <div
        onPointerDown={alIniciarPuntero}
        onPointerMove={alMoverPuntero}
        onPointerUp={alTerminarPuntero}
        onPointerCancel={alTerminarPuntero}
        onWheel={alRueda}
        onClick={(e) => {
          if (suprimirClicRef.current) return;
          if (esElementoInteractivo(e.target)) return;
          if (swipeAbierto) {
            onCerrarSwipe();
            return;
          }
          onAbrirModal();
        }}
        style={{ transform: `translate3d(${desplazamiento}px, 0, 0)` }}
        className={cn(
          "relative z-10 cursor-pointer bg-fondo-superficie touch-pan-y",
          arrastreActivo ? "select-none" : "transition-transform duration-rapida ease-salida",
          className,
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAbrirModal();
          }}
          className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:inset-0 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-borde-foco"
        >
          <span className="sr-only">Ver detalles de {nombreVisible}</span>
        </button>
        {children}
        {error && <p className="px-esp4 pb-esp2 text-xs text-texto-peligro">{error}</p>}
      </div>
    </div>
  );
}
