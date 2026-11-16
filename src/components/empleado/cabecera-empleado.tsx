"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { Logo } from "@/components/ui/logo";
import { Campana } from "@/components/avisos/campana";
import { confirmar } from "@/components/ui/dialogos";
import { createClient } from "@/lib/supabase/client";
import { liberarDispositivo } from "@/lib/push/cliente";
import { cn } from "@/lib/cn";

const ENLACES = [
  { href: "/app/agenda", etiqueta: "Agenda", icono: "calendario" },
  { href: "/app/mapa", etiqueta: "Mapa", icono: "ubicacion" },
  { href: "/app/gastos", etiqueta: "Mis gastos", icono: "gastos" },
] as const;

/**
 * Cabecera de la vista del empleado: menú hamburguesa (mismo cajón que el del admin), logo y campana de avisos.
 * Sustituye a la barra inferior y al botón de salir: todo cuelga del menú.
 */
export function CabeceraEmpleado({
  nombre,
  iniciales,
  noLeidos,
}: {
  nombre: string;
  iniciales: string;
  noLeidos: number;
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
    if (!(await confirmar("¿Cerrar la sesión en este móvil?", { aceptar: "Cerrar sesión" }))) return;
    await liberarDispositivo(); // antes de cerrar sesión: necesita la sesión para borrar el dispositivo
    await createClient().auth.signOut();
    router.push("/entrar");
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center gap-esp3 border-b border-borde-default bg-fondo-superficie px-esp4 py-esp2">
        <button
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          aria-expanded={abierto}
          className="flex h-11 w-11 items-center justify-center rounded-md text-icono-secundario hover:bg-fondo-sutil"
        >
          <Icono nombre="menu" size={22} />
        </button>
        <div className="flex flex-1 items-center pl-esp1">
          <Logo alto={28} />
        </div>
        <Campana href="/app/avisos" etiquetaEnlace="Ver todos los avisos" noLeidos={noLeidos} />
      </header>

      {abierto && (
        <div className="fixed inset-0 z-[2000]" role="dialog" aria-modal="true" aria-label="Menú">
          <button aria-label="Cerrar menú" onClick={() => setAbierto(false)} className="absolute inset-0 bg-fondo-velo" />
          <aside className="absolute inset-y-0 left-0 flex w-[min(80vw,288px)] flex-col gap-esp5 bg-fondo-superficie px-esp4 py-esp5 shadow-xl">
            <div className="flex items-center">
              <div className="pl-esp2">
                <Logo alto={30} />
              </div>
              <button
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menú"
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-md text-icono-secundario hover:bg-fondo-sutil"
              >
                <Icono nombre="cerrar" size={20} />
              </button>
            </div>

            <Link
              href="/app/gastos/nuevo"
              className="flex items-center gap-esp3 rounded-md bg-fondo-marca px-esp3 py-esp3 text-sm font-medium text-texto-sobre-marca hover:bg-fondo-marca-hover"
            >
              <Icono nombre="camara" size={20} />
              Añadir gasto menor
            </Link>

            <nav className="flex flex-col gap-1">
              {ENLACES.map((enlace) => {
                const activo = pathname.startsWith(enlace.href);
                return (
                  <Link
                    key={enlace.href}
                    href={enlace.href}
                    className={cn(
                      "flex items-center gap-esp3 rounded-md px-esp3 py-esp2 text-sm",
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
                    {enlace.etiqueta}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto flex items-center gap-esp3 rounded-md bg-fondo-sutil px-esp2 py-esp2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fondo-inverso text-xs font-medium text-texto-inverso">
                {iniciales}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-texto-primario">{nombre}</p>
                <p className="truncate text-xs text-texto-terciario">Instalador</p>
              </div>
              <button onClick={salir} aria-label="Cerrar sesión" className="text-icono-secundario">
                <Icono nombre="salir" size={18} />
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
