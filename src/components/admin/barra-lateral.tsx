"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { Logo } from "@/components/ui/logo";
import { abrirPaletaComandos } from "@/components/admin/paleta-comandos";
import { createClient } from "@/lib/supabase/client";
import { liberarDispositivo } from "@/lib/push/cliente";
import { cn } from "@/lib/cn";

type EnlaceNav = {
  href: string;
  etiqueta: string;
  icono: Parameters<typeof Icono>[0]["nombre"];
  badgeKey?: "vencidas90" | "noLeidos";
};

const SECCIONES: { titulo: string; enlaces: EnlaceNav[] }[] = [
  {
    titulo: "Operaciones",
    enlaces: [
      { href: "/admin/panel", etiqueta: "Panel", icono: "panel" },
      { href: "/admin/clientes", etiqueta: "Clientes", icono: "clientes" },
      { href: "/admin/campanas", etiqueta: "Campañas", icono: "campanas" },
      { href: "/admin/catalogo", etiqueta: "Catálogo", icono: "catalogo" },
    ],
  },
  {
    titulo: "Finanzas",
    enlaces: [
      { href: "/admin/documentos", etiqueta: "Documentos", icono: "documentos", badgeKey: "vencidas90" },
      { href: "/admin/gastos", etiqueta: "Gastos", icono: "gastos" },
      { href: "/admin/contabilidad", etiqueta: "Contabilidad", icono: "contabilidad" },
    ],
  },
  {
    titulo: "Sistema",
    enlaces: [
      { href: "/admin/avisos", etiqueta: "Avisos", icono: "avisos", badgeKey: "noLeidos" },
      { href: "/admin/ajustes", etiqueta: "Ajustes", icono: "ajustes" },
    ],
  },
];

const ACCESOS_MOVIL: { href: string; etiqueta: string; icono: Parameters<typeof Icono>[0]["nombre"] }[] = [
  { href: "/admin/panel", etiqueta: "Panel", icono: "panel" },
  { href: "/admin/clientes", etiqueta: "Clientes", icono: "clientes" },
  { href: "/admin/documentos", etiqueta: "Docs", icono: "documentos" },
  { href: "/admin/campanas", etiqueta: "Campañas", icono: "campanas" },
];

function Marca({ alto = 32 }: { alto?: number }) {
  return (
    <div className="flex items-center pl-esp1">
      <Logo alto={alto} />
    </div>
  );
}

/**
 * Shell de navegación administrativa:
 * - Escritorio (md+): barra lateral fija estilo Linear/Attio con secciones y acceso rápido ⌘K.
 * - Móvil (< md): cabecera compacta con búsqueda y avisos + barra inferior de navegación rápida + cajón completo.
 */
export function BarraLateral({
  nombre,
  rolEtiqueta,
  iniciales,
  noLeidos = 0,
  vencidas90 = 0,
}: {
  nombre: string;
  rolEtiqueta: string;
  iniciales: string;
  noLeidos?: number;
  vencidas90?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [abierto, setAbierto] = useState(false);

  // En los asistentes a pantalla completa móviles ya hay barra inferior de acción propia.
  const ocultarBarraInferior =
    pathname.startsWith("/admin/documentos/nuevo") || /^\/admin\/documentos\/\d+$/.test(pathname);

  useEffect(() => setAbierto(false), [pathname]);
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  async function salir() {
    await liberarDispositivo();
    await supabase.auth.signOut();
    router.push("/entrar");
    router.refresh();
  }

  const botonPaleta = (
    <button
      type="button"
      onClick={() => {
        setAbierto(false);
        abrirPaletaComandos();
      }}
      aria-label="Abrir búsqueda rápida y comandos (Ctrl+K)"
      className="flex min-h-10 w-full items-center gap-esp2 rounded-md border border-borde-default bg-fondo-sutil/70 px-esp3 text-xs text-texto-secundario transition-colors duration-rapida ease-suave hover:border-borde-campo hover:bg-fondo-sutil hover:text-texto-primario active:scale-press md:min-h-8 md:h-8"
    >
      <Icono nombre="buscar" size={14} className="text-icono-secundario" />
      <span className="flex-1 text-left">Buscar o ir a…</span>
      <kbd className="rounded border border-borde-default bg-fondo-superficie px-1.5 py-0.5 text-micro font-medium text-texto-terciario">
        ⌘K
      </kbd>
    </button>
  );

  const navegacion = (
    <nav aria-label="Navegación principal" className="flex flex-1 flex-col gap-esp4 overflow-y-auto">
      {SECCIONES.map((seccion) => (
        <div key={seccion.titulo} className="flex flex-col gap-0.5">
          <p className="px-esp3 pb-1 text-micro font-semibold uppercase tracking-wider text-texto-terciario">
            {seccion.titulo}
          </p>
          {seccion.enlaces.map((enlace) => {
            const activo = pathname.startsWith(enlace.href);
            const conteo =
              enlace.badgeKey === "vencidas90" ? vencidas90 : enlace.badgeKey === "noLeidos" ? noLeidos : 0;

            return (
              <Link
                key={enlace.href}
                href={enlace.href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-esp3 rounded-md px-esp3 py-esp2 text-sm transition-colors duration-rapida ease-suave md:min-h-8",
                  activo
                    ? "bg-fondo-marca-sutil font-medium text-texto-marca"
                    : "text-texto-secundario hover:bg-fondo-sutil hover:text-texto-primario",
                )}
              >
                <Icono
                  nombre={enlace.icono}
                  size={18}
                  className={activo ? "text-icono-marca" : "text-icono-secundario"}
                />
                <span className="min-w-0 flex-1 truncate">{enlace.etiqueta}</span>
                {conteo > 0 && (
                  <span
                    className={cn(
                      "tabular-nums rounded-completo px-1.5 py-0.5 text-micro font-semibold leading-none",
                      enlace.badgeKey === "vencidas90"
                        ? "bg-fondo-critico text-texto-inverso"
                        : "bg-fondo-peligro text-texto-inverso",
                    )}
                    title={
                      enlace.badgeKey === "vencidas90"
                        ? `${conteo} facturas vencidas 90+ días`
                        : `${conteo} avisos sin leer`
                    }
                  >
                    {conteo > 99 ? "99+" : conteo}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const usuario = (
    <div className="mt-auto flex items-center gap-esp2 rounded-md border border-borde-sutil bg-fondo-sutil/70 px-esp2 py-esp2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fondo-inverso text-xs font-medium text-texto-inverso">
        {iniciales}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-texto-primario">{nombre}</p>
        <p className="truncate text-micro text-texto-terciario">{rolEtiqueta}</p>
      </div>
      <Link
        href="/cuenta/contrasena"
        aria-label="Cambiar mi contraseña"
        title="Cambiar mi contraseña"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-hover hover:text-texto-primario active:scale-press"
      >
        <Icono nombre="candado" size={16} />
      </Link>
      <button
        type="button"
        onClick={salir}
        aria-label="Cerrar sesión"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-hover hover:text-texto-primario active:scale-press"
      >
        <Icono nombre="salir" size={16} />
      </button>
    </div>
  );

  return (
    <>
      {/* Escritorio */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-esp4 border-r border-borde-default bg-fondo-superficie px-esp3 py-esp4 md:flex print:hidden">
        <Marca />
        {botonPaleta}
        {navegacion}
        {usuario}
      </aside>

      {/* Móvil: cabecera superior */}
      <header className="sticky top-0 z-30 flex items-center gap-esp2 border-b border-borde-default bg-fondo-superficie/95 px-esp3 py-esp2 backdrop-blur-sm md:hidden print:hidden">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          aria-expanded={abierto}
          className="flex h-11 w-11 items-center justify-center rounded-md text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
        >
          <Icono nombre="menu" size={22} />
        </button>
        <div className="flex-1">
          <Marca alto={28} />
        </div>
        <button
          type="button"
          onClick={abrirPaletaComandos}
          aria-label="Búsqueda rápida"
          className="flex h-11 w-11 items-center justify-center rounded-md text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
        >
          <Icono nombre="buscar" size={20} />
        </button>
      </header>

      {/* Móvil: barra inferior de navegación rápida */}
      {!ocultarBarraInferior && (
        <nav
          aria-label="Navegación rápida móvil"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-borde-default bg-fondo-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden print:hidden"
        >
          {ACCESOS_MOVIL.map((item) => {
            const activo = pathname.startsWith(item.href);
            const esDocsConAlerta = item.href === "/admin/documentos" && vencidas90 > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 text-micro font-medium transition-colors duration-rapida ease-suave",
                  activo ? "text-texto-marca" : "text-texto-secundario hover:text-texto-primario",
                )}
              >
                <span className="relative">
                  <Icono nombre={item.icono} size={20} className={activo ? "text-icono-marca" : "text-icono-secundario"} />
                  {esDocsConAlerta && (
                    <span
                      aria-label={`${vencidas90} vencidas 90+ días`}
                      className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-fondo-critico px-1 text-micro font-bold leading-none text-texto-inverso"
                    >
                      {vencidas90 > 9 ? "9+" : vencidas90}
                    </span>
                  )}
                </span>
                <span className="truncate">{item.etiqueta}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setAbierto(true)}
            aria-label="Más opciones del menú"
            aria-expanded={abierto}
            className="relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 text-micro font-medium text-texto-secundario transition-colors duration-rapida ease-suave hover:text-texto-primario"
          >
            <span className="relative">
              <Icono nombre="menu" size={20} className="text-icono-secundario" />
              {noLeidos > 0 && (
                <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-fondo-peligro" />
              )}
            </span>
            <span>Menú</span>
          </button>
        </nav>
      )}

      {/* Móvil: cajón lateral completo */}
      {abierto && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menú completo">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setAbierto(false)}
            className="animate-velo-entrar absolute inset-0 bg-fondo-velo"
          />
          <aside className="animate-cajon-entrar absolute inset-y-0 left-0 flex w-[min(82vw,300px)] flex-col gap-esp4 border-r border-borde-default bg-fondo-superficie px-esp4 py-esp4 shadow-elevado">
            <div className="flex items-center">
              <Marca />
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menú"
                className="ml-auto flex h-11 w-11 items-center justify-center rounded-md text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
              >
                <Icono nombre="cerrar" size={20} />
              </button>
            </div>
            {botonPaleta}
            {navegacion}
            {usuario}
          </aside>
        </div>
      )}
    </>
  );
}
