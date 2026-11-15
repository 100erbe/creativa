"use client";

import { useEffect, useState } from "react";
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
        onClick={() => setAbierto(true)}
        aria-label={noLeidos > 0 ? `Avisos: ${noLeidos} sin leer` : "Avisos"}
        aria-haspopup="dialog"
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-md text-icono-secundario hover:bg-fondo-sutil",
          className,
        )}
      >
        <Icono nombre="avisos" size={22} />
        {noLeidos > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-fondo-peligro px-1 text-[10px] font-semibold leading-none text-texto-inverso">
            {noLeidos > 9 ? "9+" : noLeidos}
          </span>
        )}
      </button>

      {abierto && (
        <div className="fixed inset-0 z-[3000] flex items-end justify-center sm:items-start sm:justify-end sm:p-esp4" role="dialog" aria-modal="true" aria-label="Avisos">
          <button aria-label="Cerrar avisos" onClick={() => setAbierto(false)} className="absolute inset-0 bg-black/40" />
          <div className="relative flex max-h-[85dvh] w-full flex-col gap-esp3 rounded-t-xl bg-fondo-superficie p-esp4 shadow-xl sm:mt-12 sm:w-[420px] sm:rounded-xl">
            <div className="flex items-center">
              <h2 className="flex-1 text-base font-semibold text-texto-primario">Avisos</h2>
              <button
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-md text-icono-secundario hover:bg-fondo-sutil"
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
        </div>
      )}
    </>
  );
}
