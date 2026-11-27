"use client";

import { useSyncExternalStore } from "react";
import { Icono } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";

// Botón «ojo» del margen bruto: oculta costes y márgenes en TODAS las pantallas internas
// (creación de documentos, ficha del documento, ficha de cliente, Rentabilidad).
// Es para cuando se crea un presupuesto delante del cliente. La preferencia vive en este
// dispositivo (localStorage). En el servidor y en el primer render los márgenes están OCULTOS:
// así nunca aparecen un instante antes de leer la preferencia.

const CLAVE = "creativa:ocultar-margenes";
const EVENTO = "creativa:margenes";

function leer(): boolean {
  try {
    return window.localStorage.getItem(CLAVE) !== "1";
  } catch {
    return true;
  }
}

function suscribir(aviso: () => void) {
  const alAlmacenar = (e: StorageEvent) => e.key === CLAVE && aviso();
  window.addEventListener(EVENTO, aviso);
  window.addEventListener("storage", alAlmacenar);
  return () => {
    window.removeEventListener(EVENTO, aviso);
    window.removeEventListener("storage", alAlmacenar);
  };
}

/** `true` si se pueden mostrar costes y márgenes en este dispositivo. */
export function useMargenesVisibles(): boolean {
  return useSyncExternalStore(suscribir, leer, () => false);
}

export function alternarMargenes() {
  const visible = leer();
  try {
    if (visible) window.localStorage.setItem(CLAVE, "1");
    else window.localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento (modo privado): no se recuerda, pero no rompe la pantalla.
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** Botón de ojo para mostrar / ocultar costes y márgenes. */
export function BotonOjoMargenes({ className }: { className?: string }) {
  const visible = useMargenesVisibles();
  const texto = visible ? "Ocultar márgenes" : "Mostrar márgenes";
  return (
    <button
      type="button"
      onClick={alternarMargenes}
      aria-label={texto}
      aria-pressed={!visible}
      title={texto}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil hover:text-texto-primario active:scale-press",
        className,
      )}
    >
      <Icono nombre={visible ? "ojoTachado" : "ojo"} size={18} />
    </button>
  );
}
