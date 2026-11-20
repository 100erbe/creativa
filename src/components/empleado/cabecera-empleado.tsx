"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { Logo } from "@/components/ui/logo";
import { MenuCuenta } from "@/components/ui/menu-cuenta";
import { CabeceraMovil, type ConfigCabeceraMovil } from "@/components/ui/cabecera-movil";
import { createClient } from "@/lib/supabase/client";
import { liberarDispositivo } from "@/lib/push/cliente";
import { cn } from "@/lib/cn";

type EnlaceEmpleado = {
  href: string;
  etiqueta: string;
  icono: Parameters<typeof Icono>[0]["nombre"];
  badgeKey?: "atrasados" | "rechazados" | "noLeidos";
};

const ENLACES_BARRA: EnlaceEmpleado[] = [
  { href: "/app/inicio", etiqueta: "Inicio", icono: "panel" },
  { href: "/app/agenda", etiqueta: "Agenda", icono: "calendario", badgeKey: "atrasados" },
  { href: "/app/mapa", etiqueta: "Mapa", icono: "ubicacion" },
  { href: "/app/gastos", etiqueta: "Gastos", icono: "gastos", badgeKey: "rechazados" },
];

const ENLACES_CAJON: EnlaceEmpleado[] = [
  { href: "/app/inicio", etiqueta: "Inicio", icono: "panel" },
  { href: "/app/agenda", etiqueta: "Agenda", icono: "calendario", badgeKey: "atrasados" },
  { href: "/app/mapa", etiqueta: "Mapa", icono: "ubicacion" },
  { href: "/app/gastos", etiqueta: "Mis gastos", icono: "gastos", badgeKey: "rechazados" },
  { href: "/app/avisos", etiqueta: "Avisos", icono: "avisos", badgeKey: "noLeidos" },
];

/** Resuelve el estado contextual de la cabecera según la ruta activa del empleado. */
function resolverCabeceraEmpleado(pathname: string): ConfigCabeceraMovil {
  // 1. Vistas raíz de la barra inferior
  if (pathname === "/app/inicio") {
    return { modo: "logo", titulo: "Inicio", mostrarAvisos: true };
  }
  if (pathname === "/app/agenda") {
    return { modo: "titulo", titulo: "Agenda", mostrarAvisos: true };
  }
  if (pathname === "/app/mapa") {
    return { modo: "titulo", titulo: "Mapa", mostrarAvisos: true };
  }
  if (pathname === "/app/gastos") {
    return { modo: "titulo", titulo: "Mis gastos", mostrarAvisos: true };
  }

  // 2. Flujos de creación / edición (sin campana para evitar distracciones)
  if (pathname === "/app/gastos/nuevo") {
    return { modo: "volver", titulo: "Añadir gasto", hrefVolver: "/app/gastos", mostrarAvisos: false };
  }
  if (/^\/app\/gastos\/\d+\/editar$/.test(pathname)) {
    return { modo: "volver", titulo: "Corregir gasto", hrefVolver: "/app/gastos", mostrarAvisos: false };
  }

  // 3. Fichas de detalle y secciones secundarias
  if (pathname.startsWith("/app/punto/")) {
    return { modo: "volver", titulo: "Punto", hrefVolver: "/app/agenda", mostrarAvisos: true };
  }
  if (pathname === "/app/avisos") {
    return { modo: "volver", titulo: "Avisos", hrefVolver: "/app/inicio", usarHistorial: true, mostrarAvisos: false };
  }
  if (pathname.startsWith("/app/avisos/")) {
    return { modo: "volver", titulo: "Aviso", hrefVolver: "/app/avisos", mostrarAvisos: false };
  }
  if (pathname === "/app/cuenta") {
    return { modo: "volver", titulo: "Mi cuenta", hrefVolver: "/app/inicio", usarHistorial: true, mostrarAvisos: true };
  }

  return { modo: "logo", titulo: "Inicio", mostrarAvisos: true };
}

/**
 * Cabecera contextual y barra de navegación inferior de la PWA del empleado:
 * unificada con el shell móvil administrativo (avisos arriba a la derecha y cajón desde la derecha).
 */
export function CabeceraEmpleado({
  nombre,
  rolEtiqueta = "Empleado",
  iniciales,
  avatarUrl = null,
  noLeidos,
  atrasadosCount = 0,
  gastosRechazadosCount = 0,
}: {
  nombre: string;
  rolEtiqueta?: string;
  iniciales: string;
  /** Foto de perfil ya firmada (o null: iniciales). */
  avatarUrl?: string | null;
  noLeidos: number;
  atrasadosCount?: number;
  gastosRechazadosCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  useEffect(() => setAbierto(false), [pathname]);
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  async function salir() {
    await liberarDispositivo(); // antes de cerrar sesión: necesita la sesión para borrar el dispositivo
    await createClient().auth.signOut();
    router.push("/entrar");
    router.refresh();
  }

  function obtenerConteo(key?: EnlaceEmpleado["badgeKey"]) {
    if (key === "atrasados") return atrasadosCount;
    if (key === "rechazados") return gastosRechazadosCount;
    if (key === "noLeidos") return noLeidos;
    return 0;
  }

  return (
    <>
      <CabeceraMovil
        config={resolverCabeceraEmpleado(pathname)}
        hrefInicio="/app/inicio"
        hrefAvisos="/app/avisos"
        noLeidos={noLeidos}
      />

      {/* Barra inferior fija de navegación rápida para uso con el pulgar */}
      <nav
        aria-label="Navegación principal de campo"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 gap-esp1 border-t border-borde-default bg-fondo-superficie px-esp1 pt-esp1 pb-[max(0.25rem,env(safe-area-inset-bottom))]"
      >
        {ENLACES_BARRA.map((enlace) => {
          const activo =
            pathname.startsWith(enlace.href) ||
            (enlace.href === "/app/agenda" && pathname.startsWith("/app/punto/"));
          const conteo = obtenerConteo(enlace.badgeKey);
          const esCritico = enlace.badgeKey === "atrasados" || enlace.badgeKey === "rechazados";
          return (
            <Link
              key={enlace.href}
              href={enlace.href}
              aria-current={activo ? "page" : undefined}
              className={cn(
                "relative flex min-h-12 flex-col items-center justify-center gap-esp1 rounded-lg py-esp1 text-etiqueta transition-[background-color,color,transform] duration-rapida ease-suave active:scale-press",
                activo
                  ? "bg-fondo-marca-sutil text-texto-marca"
                  : "text-texto-secundario hover:bg-fondo-sutil hover:text-texto-primario",
              )}
            >
              <span className="relative">
                <Icono
                  nombre={enlace.icono}
                  size={20}
                  className={activo ? "text-icono-marca" : "text-icono-default"}
                />
                {conteo > 0 && (
                  <span
                    className={cn(
                      "tabular-nums absolute -right-2.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-completo px-esp1 text-micro font-semibold leading-none text-texto-inverso",
                      esCritico ? "bg-fondo-critico" : "bg-fondo-peligro",
                    )}
                  >
                    {conteo > 9 ? "9+" : conteo}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate">{enlace.etiqueta}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Más opciones del menú"
          aria-expanded={abierto}
          className={cn(
            "relative flex min-h-12 flex-col items-center justify-center gap-esp1 rounded-lg py-esp1 text-etiqueta transition-[background-color,color,transform] duration-rapida ease-suave active:scale-press",
            abierto
              ? "bg-fondo-marca-sutil text-texto-marca"
              : "text-texto-secundario hover:bg-fondo-sutil hover:text-texto-primario",
          )}
        >
          <Icono nombre="menu" size={20} className={abierto ? "text-icono-marca" : "text-icono-default"} />
          <span className="max-w-full truncate">Menú</span>
        </button>
      </nav>

      {abierto && (
        <div className="fixed inset-0 z-[2000]" role="dialog" aria-modal="true" aria-label="Menú">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setAbierto(false)}
            className="animate-velo-entrar absolute inset-0 bg-fondo-velo"
          />
          <aside className="animate-cajon-entrar absolute inset-y-0 right-0 flex w-[min(82vw,300px)] flex-col gap-esp2 overflow-y-auto bg-fondo-superficie px-esp4 py-esp4 shadow-elevado">
            <div className="flex items-center pb-esp2">
              <Link
                href="/app/inicio"
                onClick={() => setAbierto(false)}
                aria-label="Ir a Inicio"
                className="inline-flex rounded-lg pl-esp1 outline-offset-4"
              >
                <Logo alto={32} />
              </Link>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menú"
                className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-icono-default transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
              >
                <Icono nombre="cerrar" size={20} />
              </button>
            </div>

            <Link
              href="/app/gastos/nuevo"
              className="flex min-h-11 items-center gap-esp3 rounded-lg bg-fondo-marca px-esp3 py-esp3 text-sm font-medium text-texto-sobre-marca transition-colors duration-rapida ease-suave hover:bg-fondo-marca-hover active:scale-press"
            >
              <Icono nombre="camara" size={20} />
              Añadir gasto menor
            </Link>

            <nav aria-label="Menú completo" className="flex flex-col gap-esp1 pt-esp2">
              {ENLACES_CAJON.map((enlace) => {
                const activo = pathname.startsWith(enlace.href);
                const conteo = obtenerConteo(enlace.badgeKey);
                const esCritico = enlace.badgeKey === "atrasados" || enlace.badgeKey === "rechazados";
                return (
                  <Link
                    key={enlace.href}
                    href={enlace.href}
                    aria-current={activo ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-esp3 rounded-lg px-esp3 text-cuerpo transition-colors duration-rapida ease-suave",
                      activo
                        ? "bg-fondo-marca-sutil text-texto-marca"
                        : "text-texto-primario hover:bg-fondo-sutil",
                    )}
                  >
                    <Icono
                      nombre={enlace.icono}
                      size={20}
                      className={activo ? "text-icono-marca" : "text-icono-default"}
                    />
                    <span className="min-w-0 flex-1 truncate">{enlace.etiqueta}</span>
                    {conteo > 0 && (
                      <span
                        className={cn(
                          "tabular-nums rounded-completo px-1.5 py-0.5 text-micro font-semibold leading-none text-texto-inverso",
                          esCritico ? "bg-fondo-critico" : "bg-fondo-peligro",
                        )}
                      >
                        {conteo}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="flex-1" />
            <div className="h-px bg-borde-default" />
            <MenuCuenta
              nombre={nombre}
              rolEtiqueta={rolEtiqueta}
              iniciales={iniciales}
              avatarUrl={avatarUrl}
              hrefCuenta="/app/cuenta"
              onSalir={salir}
            />
          </aside>
        </div>
      )}
    </>
  );
}
