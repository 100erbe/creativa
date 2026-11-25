"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { Logo } from "@/components/ui/logo";
import { Campana } from "@/components/avisos/campana";
import { cn } from "@/lib/cn";
import { useHrefLista } from "@/lib/ultima-lista";

/** Rango de scroll (px) durante el cual el <h1> se oculta bajo la cabecera y ocurre la transición. */
const SCROLL_INICIO = 12;
const SCROLL_FIN = 64;

function limitar01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Curva suave cúbica (ease-out) para interpolaciones vinculadas al scroll. */
function suavizarSalida(t: number) {
  return 1 - Math.pow(1 - limitar01(t), 3);
}

export type ConfigCabeceraMovil = {
  /**
   * - "logo": pantalla principal (Inicio / Resumen) -> mantiene el logo a la izquierda.
   * - "titulo": sección raíz de la barra inferior -> logo en reposo y crossfade vertical al título al hacer scroll.
   * - "volver": subpágina, ficha de detalle o sección secundaria -> muestra «← etiquetaVolver».
   */
  modo: "logo" | "titulo" | "volver";
  titulo: string;
  hrefVolver?: string;
  /** Texto junto a la flecha (p. ej. "Volver", "Documentos", "Ajustes"). */
  etiquetaVolver?: string;
  /**
   * Solo para `modo="volver"`: si es `true` (secciones secundarias tipo lista alcanzadas desde el menú),
   * al hacer scroll sustituye «Volver» por `titulo` manteniendo exactamente la misma tipografía.
   * En fichas de detalle y subpáginas (default `false`), la etiqueta permanece fija y solo cambia el fondo.
   */
  revelarTituloAlScroll?: boolean;
  usarHistorial?: boolean;
  mostrarBusqueda?: boolean;
  mostrarAvisos?: boolean;
};

/**
 * Cabecera móvil contextual fija (`sticky top-0`) con transición 100 % GPU vinculada al scroll
 * (patrón iOS Large Title → Compact Header, sin re-renders por píxel):
 * - Fondo: dos capas absolutas (lienzo sólido en reposo → vidrio esmerilado con borde y sombra sutil)
 *   controladas únicamente mediante `opacity` para mantener 60/120 fps constantes.
 * - Slot izquierdo: doble capa apilada en grid con crossfade asimétrico y desplazamiento vertical suave.
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
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const [desplazado, setDesplazado] = useState(false);

  const {
    modo,
    titulo,
    hrefVolver: hrefVolverBase,
    etiquetaVolver = "Volver",
    revelarTituloAlScroll = false,
    usarHistorial = false,
    mostrarBusqueda = false,
    mostrarAvisos = true,
  } = config;
  // Si el destino es un listado, vuelve con los filtros con los que el usuario lo dejó.
  const hrefVolver = useHrefLista(hrefVolverBase);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const contenedorEmpleado = document.getElementById("contenido-empleado");
    const movimientoReducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let rafId = 0;

    const aplicarProgreso = () => {
      rafId = 0;
      const scrollActual = Math.max(window.scrollY, contenedorEmpleado ? contenedorEmpleado.scrollTop : 0);
      const pBruto = limitar01((scrollActual - SCROLL_INICIO) / (SCROLL_FIN - SCROLL_INICIO));
      const p = movimientoReducido ? (pBruto >= 0.5 ? 1 : 0) : pBruto;

      // Salida rápida en la primera mitad (0 → 0.52) para limpiar el slot antes de entrar el título.
      const faseSalida = suavizarSalida(p / 0.52);
      // Entrada escalonada (0.38 → 1.0) acompañando la desaparición del <h1> bajo la barra.
      const faseEntrada = suavizarSalida((p - 0.38) / 0.62);

      const salirOpacidad = 1 - faseSalida;
      const salirY = movimientoReducido ? 0 : -7 * faseSalida;
      const salirEscala = movimientoReducido ? 1 : 1 - 0.04 * faseSalida;

      const entrarOpacidad = faseEntrada;
      const entrarY = movimientoReducido ? 0 : 9 * (1 - faseEntrada);
      const entrarEscala = movimientoReducido ? 1 : 0.97 + 0.03 * faseEntrada;

      el.style.setProperty("--cab-p", p.toFixed(4));
      el.style.setProperty("--cab-reposo-o", (1 - p).toFixed(4));
      el.style.setProperty("--cab-salir-o", salirOpacidad.toFixed(4));
      el.style.setProperty("--cab-salir-y", `${salirY.toFixed(2)}px`);
      el.style.setProperty("--cab-salir-s", salirEscala.toFixed(4));
      el.style.setProperty("--cab-entrar-o", entrarOpacidad.toFixed(4));
      el.style.setProperty("--cab-entrar-y", `${entrarY.toFixed(2)}px`);
      el.style.setProperty("--cab-entrar-s", entrarEscala.toFixed(4));

      const estaDesplazado = p >= 0.5;
      setDesplazado((prev) => (prev === estaDesplazado ? prev : estaDesplazado));
    };

    const programar = () => {
      if (!rafId) rafId = window.requestAnimationFrame(aplicarProgreso);
    };

    aplicarProgreso();
    window.addEventListener("scroll", programar, { passive: true });
    contenedorEmpleado?.addEventListener("scroll", programar, { passive: true });
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", programar);
      contenedorEmpleado?.removeEventListener("scroll", programar);
    };
  }, [pathname]);

  function volver() {
    if (usarHistorial && typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else if (hrefVolver) {
      router.push(hrefVolver);
    } else {
      router.push(hrefInicio);
    }
  }

  const estiloSalir: React.CSSProperties = {
    opacity: "var(--cab-salir-o, 1)",
    transform: "translate3d(0, var(--cab-salir-y, 0px), 0) scale(var(--cab-salir-s, 1))",
  };

  const estiloEntrar: React.CSSProperties = {
    opacity: "var(--cab-entrar-o, 0)",
    transform: "translate3d(0, var(--cab-entrar-y, 9px), 0) scale(var(--cab-entrar-s, 0.97))",
  };

  const clasesCapa =
    "col-start-1 row-start-1 min-w-0 origin-left will-change-[transform,opacity] transition-[transform,opacity] duration-100 ease-salida";

  const contenidoVolver = (
    <>
      <Icono nombre="atras" size={20} className="shrink-0" />
      {revelarTituloAlScroll ? (
        <span className="grid min-w-0 flex-1 items-center overflow-hidden py-0.5">
          <span
            aria-hidden={desplazado}
            style={estiloSalir}
            className={cn(clasesCapa, "truncate text-sm font-medium text-texto-secundario")}
          >
            {etiquetaVolver}
          </span>
          <span
            aria-hidden={!desplazado}
            style={estiloEntrar}
            className={cn(clasesCapa, "truncate text-sm font-medium text-texto-secundario")}
          >
            {titulo}
          </span>
        </span>
      ) : (
        <span className="truncate text-sm font-medium text-texto-secundario">{etiquetaVolver}</span>
      )}
    </>
  );

  const clasesVolver =
    "-ml-1.5 inline-flex min-h-11 min-w-0 max-w-full items-center gap-esp1 rounded-lg px-esp2 text-icono-default transition-colors duration-rapida ease-suave hover:bg-fondo-hover active:scale-press";

  return (
    <header
      ref={headerRef}
      className={cn(
        "sticky top-0 z-30 flex min-h-14 items-center gap-esp2 px-esp3 py-esp2 pt-[max(theme(spacing.esp2),env(safe-area-inset-top))]",
        className,
      )}
    >
      {/* Capa de fondo en reposo (lienzo sólido sin borde) */}
      <div
        aria-hidden="true"
        style={{ opacity: "var(--cab-reposo-o, 1)" }}
        className="pointer-events-none absolute inset-0 -z-10 bg-fondo-lienzo will-change-[opacity] transition-opacity duration-100 ease-salida"
      />
      {/* Capa de fondo al hacer scroll (lienzo esmerilado con borde sutil y elevación suave) */}
      <div
        aria-hidden="true"
        style={{ opacity: "var(--cab-p, 0)" }}
        className="pointer-events-none absolute inset-0 -z-10 border-b border-borde-fuerte/80 bg-fondo-lienzo/85 shadow-[0_4px_16px_-4px_rgb(32_36_53/0.07)] backdrop-blur-md backdrop-saturate-125 will-change-[opacity] transition-opacity duration-100 ease-salida"
      />

      <div className="flex min-w-0 flex-1 items-center gap-esp1">
        {modo === "logo" && (
          <Link href={hrefInicio} aria-label="Ir a Inicio" className="inline-flex rounded-lg pl-esp1 outline-offset-4">
            <Logo alto={28} />
          </Link>
        )}

        {modo === "titulo" && (
          <div className="grid min-h-11 min-w-0 flex-1 items-center overflow-hidden pl-esp1">
            <Link
              href={hrefInicio}
              aria-label="Ir a Inicio"
              aria-hidden={desplazado}
              tabIndex={desplazado ? -1 : 0}
              style={estiloSalir}
              className={cn(
                clasesCapa,
                "inline-flex w-fit rounded-lg outline-offset-4",
                desplazado && "pointer-events-none",
              )}
            >
              <Logo alto={28} />
            </Link>
            <span
              aria-hidden={!desplazado}
              style={estiloEntrar}
              className={cn(
                clasesCapa,
                "truncate text-base font-bold text-texto-primario",
                !desplazado && "pointer-events-none",
              )}
            >
              {titulo}
            </span>
          </div>
        )}

        {modo === "volver" &&
          (usarHistorial || !hrefVolver ? (
            <button type="button" onClick={volver} aria-label={`Volver (${etiquetaVolver})`} className={clasesVolver}>
              {contenidoVolver}
            </button>
          ) : (
            <Link href={hrefVolver} aria-label={`Volver a ${etiquetaVolver}`} className={clasesVolver}>
              {contenidoVolver}
            </Link>
          ))}
      </div>

      <div className="flex shrink-0 items-center gap-esp1">
        {mostrarBusqueda && onBuscar && (
          <button
            type="button"
            onClick={onBuscar}
            aria-label="Búsqueda rápida"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-icono-default transition-colors duration-rapida ease-suave hover:bg-fondo-hover active:scale-press"
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
