"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { liberarDispositivo } from "@/lib/push/cliente";
import { cn } from "@/lib/cn";

type EnlaceEmpleado = {
  href: string;
  etiqueta: string;
  icono: Parameters<typeof Icono>[0]["nombre"];
  badgeKey?: "atrasados" | "rechazados" | "noLeidos";
};

const ENLACES: EnlaceEmpleado[] = [
  { href: "/app/agenda", etiqueta: "Agenda", icono: "calendario", badgeKey: "atrasados" },
  { href: "/app/mapa", etiqueta: "Mapa", icono: "ubicacion" },
  { href: "/app/gastos", etiqueta: "Mis gastos", icono: "gastos", badgeKey: "rechazados" },
  { href: "/app/avisos", etiqueta: "Avisos", icono: "avisos", badgeKey: "noLeidos" },
];

/**
 * Cabecera y barra de navegación inferior de la PWA del empleado:
 * acceso con una sola mano a Agenda, Mapa, Gastos y Avisos, más botón rápido de gasto menor.
 */
export function CabeceraEmpleado({
  nombre,
  iniciales,
  avatarUrl = null,
  noLeidos,
  atrasadosCount = 0,
  gastosRechazadosCount = 0,
}: {
  nombre: string;
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
      <header className="sticky top-0 z-20 flex items-center gap-esp2 border-b border-borde-default bg-fondo-superficie/95 px-esp3 py-esp2 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          aria-expanded={abierto}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
        >
          <Icono nombre="menu" size={22} />
        </button>
        <div className="flex flex-1 items-center pl-esp1">
          <Logo alto={26} />
        </div>
        <Link
          href="/app/gastos/nuevo"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-completo border border-borde-marca bg-fondo-marca-sutil px-esp3 text-xs font-semibold text-texto-marca transition-colors duration-rapida ease-suave hover:bg-fondo-marca hover:text-texto-sobre-marca active:scale-press"
        >
          <Icono nombre="camara" size={14} />
          <span>+ Gasto</span>
        </Link>
      </header>

      {/* Barra inferior fija de navegación rápida para uso con el pulgar */}
      <nav
        aria-label="Navegación principal de campo"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-borde-default bg-fondo-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"
      >
        {ENLACES.map((enlace) => {
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
                "relative flex min-h-[58px] flex-col items-center justify-center gap-0.5 px-1 text-micro font-medium transition-colors duration-rapida ease-suave",
                activo ? "text-texto-marca" : "text-texto-secundario hover:text-texto-primario",
              )}
            >
              <span className="relative">
                <Icono
                  nombre={enlace.icono}
                  size={20}
                  className={activo ? "text-icono-marca" : "text-icono-secundario"}
                />
                {conteo > 0 && (
                  <span
                    className={cn(
                      "tabular-nums absolute -right-2.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-micro font-bold leading-none text-texto-inverso",
                      esCritico ? "bg-fondo-critico" : "bg-fondo-peligro",
                    )}
                  >
                    {conteo > 9 ? "9+" : conteo}
                  </span>
                )}
              </span>
              <span className="truncate">{enlace.etiqueta === "Mis gastos" ? "Gastos" : enlace.etiqueta}</span>
            </Link>
          );
        })}
      </nav>

      {abierto && (
        <div className="fixed inset-0 z-[2000]" role="dialog" aria-modal="true" aria-label="Menú">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setAbierto(false)}
            className="animate-velo-entrar absolute inset-0 bg-fondo-velo"
          />
          <aside className="animate-cajon-entrar absolute inset-y-0 left-0 flex w-[min(82vw,300px)] flex-col gap-esp5 border-r border-borde-default bg-fondo-superficie px-esp4 py-esp5 shadow-elevado">
            <div className="flex items-center">
              <div className="pl-esp2">
                <Logo alto={30} />
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menú"
                className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
              >
                <Icono nombre="cerrar" size={20} />
              </button>
            </div>

            <Link
              href="/app/gastos/nuevo"
              className="flex min-h-11 items-center gap-esp3 rounded-md bg-fondo-marca px-esp3 py-esp3 text-sm font-medium text-texto-sobre-marca transition-colors duration-rapida ease-suave hover:bg-fondo-marca-hover active:scale-press"
            >
              <Icono nombre="camara" size={20} />
              Añadir gasto menor
            </Link>

            <nav aria-label="Menú completo" className="flex flex-col gap-1">
              {ENLACES.map((enlace) => {
                const activo = pathname.startsWith(enlace.href);
                const conteo = obtenerConteo(enlace.badgeKey);
                const esCritico = enlace.badgeKey === "atrasados" || enlace.badgeKey === "rechazados";
                return (
                  <Link
                    key={enlace.href}
                    href={enlace.href}
                    aria-current={activo ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-esp3 rounded-md px-esp3 py-esp2 text-sm transition-colors duration-rapida ease-suave",
                      activo
                        ? "bg-fondo-marca-sutil font-medium text-texto-marca"
                        : "text-texto-secundario hover:bg-fondo-sutil",
                    )}
                  >
                    <Icono
                      nombre={enlace.icono}
                      size={20}
                      className={activo ? "text-icono-marca" : "text-icono-secundario"}
                    />
                    <span className="flex-1">{enlace.etiqueta}</span>
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

            <div className="mt-auto flex items-center gap-esp3 rounded-md border border-borde-sutil bg-fondo-sutil px-esp2 py-esp2">
              <Link href="/app/cuenta" className="flex min-w-0 flex-1 items-center gap-esp3 rounded-lg" aria-label="Mi cuenta">
                <Avatar url={avatarUrl} iniciales={iniciales} />
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-etiqueta text-texto-primario">{nombre}</p>
                  <p className="truncate text-etiqueta text-texto-secundario">Mi cuenta</p>
                </div>
              </Link>
              <Link
                href="/cuenta/contrasena"
                aria-label="Cambiar mi contraseña"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-hover active:scale-press"
              >
                <Icono nombre="candado" size={18} />
              </Link>
              <button
                type="button"
                onClick={salir}
                aria-label="Cerrar sesión"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-hover active:scale-press"
              >
                <Icono nombre="salir" size={18} />
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
