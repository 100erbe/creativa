"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { Logo } from "@/components/ui/logo";
import { Campana } from "@/components/avisos/campana";
import { cn } from "@/lib/cn";

export type ConfigCabeceraMovil = {
  /**
   * - "logo": pantalla principal (Inicio / Resumen) -> muestra el logo a la izquierda.
   * - "titulo": sección raíz de la barra inferior -> muestra el título de la sección sin flecha atrás.
   * - "volver": subpágina, ficha de detalle o sección secundaria -> muestra botón atrás + título.
   */
  modo: "logo" | "titulo" | "volver";
  titulo: string;
  hrefVolver?: string;
  usarHistorial?: boolean;
  mostrarBusqueda?: boolean;
  mostrarAvisos?: boolean;
};

/**
 * Cabecera móvil contextual fija (`sticky top-0`):
 * - Izquierda: Logo (inicio), título de sección (raíz) o botón «Volver» + título (subpáginas/detalles).
 * - Derecha: búsqueda rápida opcional (admin) y campana de avisos (oculta en flujos de creación/edición y en /avisos).
 */
export function CabeceraMovil({
  config,
  hrefInicio,
  hrefAvisos,
  noLeidos = 0,
  onBuscar,
  className,
}: {
  config: ConfigCabeceraMovil;
  hrefInicio: string;
  hrefAvisos: string;
  noLeidos?: number;
  onBuscar?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const { modo, titulo, hrefVolver, usarHistorial = false, mostrarBusqueda = false, mostrarAvisos = true } = config;

  function volver() {
    if (usarHistorial && typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else if (hrefVolver) {
      router.push(hrefVolver);
    } else {
      router.push(hrefInicio);
    }
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex min-h-14 items-center gap-esp2 border-b border-borde-default bg-fondo-superficie/95 px-esp3 py-esp2 backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-esp1">
        {modo === "logo" && (
          <Link href={hrefInicio} aria-label="Ir a Inicio" className="inline-flex rounded-lg pl-esp1 outline-offset-4">
            <Logo alto={28} />
          </Link>
        )}

        {modo === "titulo" && (
          <span className="truncate pl-esp1 text-base font-bold text-texto-primario">{titulo}</span>
        )}

        {modo === "volver" && (
          <>
            {usarHistorial || !hrefVolver ? (
              <button
                type="button"
                onClick={volver}
                aria-label="Volver"
                className="-ml-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-icono-default transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
              >
                <Icono nombre="atras" size={20} />
              </button>
            ) : (
              <Link
                href={hrefVolver}
                aria-label="Volver"
                className="-ml-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-icono-default transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
              >
                <Icono nombre="atras" size={20} />
              </Link>
            )}
            <span className="truncate text-base font-bold text-texto-primario">{titulo}</span>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-esp1">
        {mostrarBusqueda && onBuscar && (
          <button
            type="button"
            onClick={onBuscar}
            aria-label="Búsqueda rápida"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-icono-default transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
          >
            <Icono nombre="buscar" size={20} />
          </button>
        )}
        {mostrarAvisos && (
          <Campana href={hrefAvisos} etiquetaEnlace="Ver todos los avisos" noLeidos={noLeidos} />
        )}
      </div>
    </header>
  );
}
