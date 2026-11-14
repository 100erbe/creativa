"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

const ENLACES = [
  { href: "/admin/panel", etiqueta: "Panel", icono: "panel" },
  { href: "/admin/clientes", etiqueta: "Clientes", icono: "clientes" },
  { href: "/admin/documentos", etiqueta: "Documentos", icono: "documentos" },
  { href: "/admin/campanas", etiqueta: "Campañas", icono: "campanas" },
  { href: "/admin/contabilidad", etiqueta: "Contabilidad", icono: "contabilidad" },
] as const;

function Marca() {
  return (
    <div className="flex items-center gap-esp2 pl-esp2">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-fondo-marca text-sm font-semibold text-texto-sobre-marca">
        C
      </div>
      <span className="text-base font-semibold text-texto-primario">Creativa</span>
    </div>
  );
}

/**
 * En pantallas anchas (md+) es una barra fija a la izquierda; en el móvil
 * pasa a ser una cabecera con botón de menú que abre un cajón lateral.
 */
export function BarraLateral({
  nombre,
  rolEtiqueta,
  iniciales,
}: {
  nombre: string;
  rolEtiqueta: string;
  iniciales: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [abierto, setAbierto] = useState(false);

  // El cajón se cierra al navegar y con la tecla Escape.
  useEffect(() => setAbierto(false), [pathname]);
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  async function salir() {
    await supabase.auth.signOut();
    router.push("/entrar");
    router.refresh();
  }

  const navegacion = (
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
  );

  const usuario = (
    <div className="mt-auto flex items-center gap-esp3 rounded-md bg-fondo-sutil px-esp2 py-esp2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fondo-inverso text-xs font-medium text-texto-inverso">
        {iniciales}
      </div>
      <div className="flex-1 overflow-hidden">
        <p className="truncate text-sm font-medium text-texto-primario">{nombre}</p>
        <p className="truncate text-xs text-texto-terciario">{rolEtiqueta}</p>
      </div>
      <button onClick={salir} aria-label="Salir" className="text-icono-secundario">
        <Icono nombre="salir" size={18} />
      </button>
    </div>
  );

  return (
    <>
      {/* Escritorio */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-esp6 border-r border-borde-default bg-fondo-superficie px-esp4 py-esp5 md:flex">
        <Marca />
        {navegacion}
        {usuario}
      </aside>

      {/* Móvil: cabecera + cajón */}
      <header className="sticky top-0 z-30 flex items-center gap-esp3 border-b border-borde-default bg-fondo-superficie px-esp4 py-esp3 md:hidden">
        <button
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          aria-expanded={abierto}
          className="flex h-9 w-9 items-center justify-center rounded-md text-icono-secundario hover:bg-fondo-sutil"
        >
          <Icono nombre="menu" size={22} />
        </button>
        <Marca />
      </header>

      {abierto && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button
            aria-label="Cerrar menú"
            onClick={() => setAbierto(false)}
            className="absolute inset-0 bg-black/40"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(80vw,288px)] flex-col gap-esp6 bg-fondo-superficie px-esp4 py-esp5 shadow-xl">
            <div className="flex items-center">
              <Marca />
              <button
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menú"
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-md text-icono-secundario hover:bg-fondo-sutil"
              >
                <Icono nombre="cerrar" size={20} />
              </button>
            </div>
            {navegacion}
            {usuario}
          </aside>
        </div>
      )}
    </>
  );
}
