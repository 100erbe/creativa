"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { Bandeja, type NotificacionBandeja } from "@/components/avisos/bandeja";
import { desenvolver } from "@/lib/accion";
import { cargarAvisosRecientes } from "@/lib/push/acciones";
import { cn } from "@/lib/cn";

/**
 * Campana de la cabecera: muestra cuántos avisos hay sin leer y abre un modal con los últimos.
 * `href` es la pantalla completa de avisos (los urgentes y los ajustes), enlazada desde el modal.
 */
export function Campana({
  href,
  etiquetaEnlace,
  noLeidos = 0,
  className,
}: {
  href: string;
  etiquetaEnlace: string;
  noLeidos?: number;
  className?: string;
}) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [avisos, setAvisos] = useState<NotificacionBandeja[] | null>(null);
  const [error, setError] = useState(false);
  // El contador desaparece al tocar la campana, sin esperar al servidor. Guarda cuántos había al tocarla:
  // solo reaparece si llegan más.
  const [vistos, setVistos] = useState(0);
  useEffect(() => setVistos((v) => Math.min(v, noLeidos)), [noLeidos]);
  const pendientes = Math.max(0, noLeidos - vistos);

  // Se cierra al navegar y con Escape.
  useEffect(() => setAbierto(false), [pathname]);
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  // Cada vez que se abre se pide la lista al día.
  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    setError(false);
    desenvolver(cargarAvisosRecientes())
      .then((lista) => vigente && setAvisos(lista))
      .catch(() => vigente && setError(true));
    return () => {
      vigente = false;
    };
  }, [abierto]);

  return (
    <>
      <button
        onClick={() => {
          setVistos(noLeidos);
          setAbierto(true);
        }}
        aria-label={pendientes > 0 ? `Avisos: ${pendientes} sin leer` : "Avisos"}
        aria-haspopup="dialog"
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-md text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press",
          className,
        )}
      >
        <Icono nombre="avisos" size={22} />
        {pendientes > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-fondo-peligro px-1 text-micro font-semibold leading-none text-texto-inverso">
            {pendientes > 9 ? "9+" : pendientes}
          </span>
        )}
      </button>

      {/*
        Se pinta en <body> con un portal: la cabecera es `sticky` con z-index propio y encerraba el modal en su
        capa, así que el mapa (Leaflet, z-index hasta 1000) o el cajón se montaban por encima y lo recortaban.
      */}
      {abierto &&
        createPortal(
        <div
          className="fixed inset-0 z-[3000] flex items-end justify-center sm:items-start sm:justify-end sm:p-esp4"
          role="dialog"
          aria-modal="true"
          aria-label="Avisos"
          // Un aviso que lleva a la pantalla donde ya estás no cambia de ruta: se cierra al tocar cualquier enlace.
          onClick={(e) => (e.target as HTMLElement).closest("a") && setAbierto(false)}
        >
          <button
            aria-label="Cerrar avisos"
            onClick={() => setAbierto(false)}
            className="animate-velo-entrar absolute inset-0 bg-fondo-velo"
          />
          <div className="animate-hoja-subir sm:animate-modal-entrar relative flex max-h-[85dvh] w-full flex-col gap-esp3 rounded-t-xl border border-borde-default bg-fondo-superficie p-esp4 shadow-elevado sm:mt-12 sm:w-[420px] sm:rounded-xl">
            <div className="flex items-center">
              <h2 className="flex-1 text-base font-semibold text-texto-primario">Avisos</h2>
              <button
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-md text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
              >
                <Icono nombre="cerrar" size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {error ? (
                <p className="py-esp4 text-center text-sm text-texto-peligro">No se han podido cargar los avisos.</p>
              ) : avisos === null ? (
                <p className="py-esp4 text-center text-sm text-texto-terciario">Cargando…</p>
              ) : (
                <Bandeja avisos={avisos} />
              )}
            </div>
            <Link href={href} className="text-center text-sm font-medium text-texto-marca">
              {etiquetaEnlace}
            </Link>
          </div>
        </div>,
        document.body,
        )}
    </>
  );
}
