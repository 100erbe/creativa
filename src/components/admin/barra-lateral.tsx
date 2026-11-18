"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icono, type NombreIcono } from "@/components/ui/iconos";
import { Logo } from "@/components/ui/logo";
import { Monograma } from "@/components/ui/monograma";
import { Campana } from "@/components/avisos/campana";
import { abrirPaletaComandos } from "@/components/admin/paleta-comandos";
import { createClient } from "@/lib/supabase/client";
import { liberarDispositivo } from "@/lib/push/cliente";
import { cn } from "@/lib/cn";

// Barra lateral del sistema "Documentos" ("Navigation / Sidebar" de Figma): 232 px, superficie blanca,
// padding 24/16/16/16. Logo · búsqueda ⌘K · Resumen · GESTIÓN · FINANZAS · (espacio) · Ajustes, Ayuda ·
// menú de cuenta. Los avisos no están aquí: van en la cabecera de cada página (y en la cabecera móvil).

type EnlaceNav = {
  href: string;
  etiqueta: string;
  icono: NombreIcono;
  badgeKey?: "vencidas90";
};

const SECCIONES: { titulo?: string; enlaces: EnlaceNav[] }[] = [
  { enlaces: [{ href: "/admin/panel", etiqueta: "Resumen", icono: "panel" }] },
  {
    titulo: "Gestión",
    enlaces: [
      { href: "/admin/clientes", etiqueta: "Clientes", icono: "clientes" },
      { href: "/admin/campanas", etiqueta: "Campañas", icono: "campanas" },
      { href: "/admin/catalogo", etiqueta: "Catálogo", icono: "catalogo" },
    ],
  },
  {
    titulo: "Finanzas",
    enlaces: [
      { href: "/admin/documentos", etiqueta: "Documentos", icono: "documentos" },
      { href: "/admin/cobros", etiqueta: "Cobros", icono: "cobros", badgeKey: "vencidas90" },
      { href: "/admin/gastos", etiqueta: "Gastos", icono: "gastos" },
      { href: "/admin/contabilidad", etiqueta: "Contabilidad", icono: "contabilidad" },
    ],
  },
];

const INFERIOR: EnlaceNav[] = [
  { href: "/admin/ajustes", etiqueta: "Ajustes", icono: "ajustes" },
  { href: "/admin/ayuda", etiqueta: "Ayuda", icono: "ayuda" },
];

const ACCESOS_MOVIL: EnlaceNav[] = [
  { href: "/admin/panel", etiqueta: "Resumen", icono: "panel" },
  { href: "/admin/documentos", etiqueta: "Docs", icono: "documentos" },
  { href: "/admin/cobros", etiqueta: "Cobros", icono: "cobros", badgeKey: "vencidas90" },
  { href: "/admin/campanas", etiqueta: "Campañas", icono: "campanas" },
];

/**
 * Shell de navegación administrativa:
 * - Escritorio (md+): barra lateral fija con secciones, búsqueda ⌘K y menú de cuenta.
 * - Móvil (< md): cabecera compacta (menú, logo, búsqueda, avisos) + barra inferior + cajón completo.
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

  const conteoDe = (e: EnlaceNav) => (e.badgeKey === "vencidas90" ? vencidas90 : 0);

  const botonPaleta = (
    <button
      type="button"
      onClick={() => {
        setAbierto(false);
        abrirPaletaComandos();
      }}
      aria-label="Abrir búsqueda rápida y comandos (Ctrl+K)"
      className="flex min-h-11 w-full items-center gap-esp2 rounded-lg border border-borde-default bg-fondo-sutil pl-esp3 pr-esp2 text-etiqueta text-texto-secundario transition-[background-color,border-color,transform] duration-rapida ease-suave hover:border-borde-fuerte hover:bg-fondo-hover active:scale-press md:min-h-10"
    >
      <Icono nombre="buscar" size={20} className="text-icono-default" />
      <span className="flex-1 text-left">Buscar…</span>
      <kbd className="font-sans text-etiqueta text-texto-secundario">⌘K</kbd>
    </button>
  );

  const itemNav = (enlace: EnlaceNav) => {
    const activo = pathname.startsWith(enlace.href);
    const conteo = conteoDe(enlace);
    return (
      <Link
        key={enlace.href}
        href={enlace.href}
        aria-current={activo ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center gap-esp3 rounded-lg px-esp3 text-cuerpo transition-colors duration-rapida ease-suave md:min-h-[42px]",
          activo ? "bg-fondo-marca-sutil text-texto-marca" : "text-texto-primario hover:bg-fondo-sutil",
        )}
      >
        <Icono nombre={enlace.icono} size={20} className={activo ? "text-icono-marca" : "text-icono-default"} />
        <span className="min-w-0 flex-1 truncate">{enlace.etiqueta}</span>
        {conteo > 0 && (
          <span
            className="tabular-nums rounded-completo bg-fondo-critico px-1.5 py-0.5 text-micro font-semibold leading-none text-texto-inverso"
            title={`${conteo} facturas vencidas 90+ días`}
          >
            {conteo > 99 ? "99+" : conteo}
          </span>
        )}
      </Link>
    );
  };

  const navegacion = (
    <nav aria-label="Navegación principal" className="flex flex-col gap-esp4">
      {SECCIONES.map((seccion, i) => (
        <div key={seccion.titulo ?? i} className="flex flex-col gap-esp1">
          {seccion.titulo && (
            <p className="text-etiqueta uppercase text-texto-secundario">{seccion.titulo}</p>
          )}
          {seccion.enlaces.map(itemNav)}
        </div>
      ))}
    </nav>
  );

  const inferior = (
    <nav aria-label="Ajustes y ayuda" className="flex flex-col gap-esp2">
      {INFERIOR.map(itemNav)}
    </nav>
  );

  const cuenta = <MenuCuenta nombre={nombre} rolEtiqueta={rolEtiqueta} iniciales={iniciales} onSalir={salir} />;

  return (
    <>
      {/* Escritorio */}
      <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col gap-esp2 overflow-y-auto bg-fondo-superficie pb-esp4 pl-esp4 pr-esp4 pt-esp6 md:flex print:hidden">
        <div className="pb-esp4 pl-esp3">
          <Logo alto={40} />
        </div>
        {botonPaleta}
        <div className="pt-esp4">{navegacion}</div>
        <div className="flex-1" />
        {inferior}
        <div className="h-px bg-borde-default" />
        {cuenta}
      </aside>

      {/* Móvil: cabecera superior */}
      <header className="sticky top-0 z-30 flex items-center gap-esp1 border-b border-borde-default bg-fondo-superficie/95 px-esp3 py-esp2 backdrop-blur-sm md:hidden print:hidden">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          aria-expanded={abierto}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-icono-default transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
        >
          <Icono nombre="menu" size={22} />
        </button>
        <div className="flex-1">
          <Logo alto={28} />
        </div>
        <button
          type="button"
          onClick={abrirPaletaComandos}
          aria-label="Búsqueda rápida"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-icono-default transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
        >
          <Icono nombre="buscar" size={20} />
        </button>
        <Campana href="/admin/avisos" etiquetaEnlace="Ver todos los avisos" noLeidos={noLeidos} />
      </header>

      {/* Móvil: barra inferior de navegación rápida */}
      {!ocultarBarraInferior && (
        <nav
          aria-label="Navegación rápida móvil"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-borde-default bg-fondo-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden print:hidden"
        >
          {ACCESOS_MOVIL.map((item) => {
            const activo = pathname.startsWith(item.href);
            const conteo = conteoDe(item);
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
                  <Icono nombre={item.icono} size={20} className={activo ? "text-icono-marca" : "text-icono-default"} />
                  {conteo > 0 && (
                    <span
                      aria-label={`${conteo} vencidas 90+ días`}
                      className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-fondo-critico px-1 text-micro font-bold leading-none text-texto-inverso"
                    >
                      {conteo > 9 ? "9+" : conteo}
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
            <Icono nombre="menu" size={20} className="text-icono-default" />
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
          <aside className="animate-cajon-entrar absolute inset-y-0 left-0 flex w-[min(82vw,300px)] flex-col gap-esp2 overflow-y-auto bg-fondo-superficie px-esp4 py-esp4 shadow-elevado">
            <div className="flex items-center pb-esp2">
              <div className="pl-esp1">
                <Logo alto={32} />
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menú"
                className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-icono-default transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
              >
                <Icono nombre="cerrar" size={20} />
              </button>
            </div>
            {botonPaleta}
            <div className="pt-esp2">{navegacion}</div>
            <div className="flex-1" />
            {inferior}
            <div className="h-px bg-borde-default" />
            {cuenta}
          </aside>
        </div>
      )}
    </>
  );
}

/** Menú de cuenta ("Account menu" de Figma): avatar, nombre y rol; el chevron abre Contraseña y Cerrar sesión. */
function MenuCuenta({
  nombre,
  rolEtiqueta,
  iniciales,
  onSalir,
}: {
  nombre: string;
  rolEtiqueta: string;
  iniciales: string;
  onSalir: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setAbierto(false), [pathname]);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setAbierto(false);
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        aria-label={`Cuenta de ${nombre}`}
        className="flex min-h-[60px] w-full items-center gap-esp3 rounded-lg py-esp3 text-left transition-colors duration-rapida ease-suave hover:bg-fondo-sutil"
      >
        <Monograma texto={iniciales} variante="avatar" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-etiqueta text-texto-primario">{nombre}</span>
          <span className="block truncate text-etiqueta text-texto-secundario">{rolEtiqueta}</span>
        </span>
        <Icono
          nombre="chevron"
          size={20}
          className={cn("text-icono-default transition-transform duration-rapida ease-salida", abierto && "-rotate-90")}
        />
      </button>
      {abierto && (
        <div
          role="menu"
          className="animate-estado-entrar absolute bottom-full left-0 right-0 z-40 mb-esp2 flex flex-col gap-0.5 rounded-lg border border-borde-default bg-fondo-elevado p-esp1 shadow-elevado"
        >
          <Link
            role="menuitem"
            href="/cuenta/contrasena"
            className="flex min-h-11 items-center gap-esp3 rounded-md px-esp3 text-cuerpo text-texto-primario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil md:min-h-10"
          >
            <Icono nombre="candado" size={18} className="text-icono-default" />
            Cambiar contraseña
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={onSalir}
            className="flex min-h-11 items-center gap-esp3 rounded-md px-esp3 text-left text-cuerpo text-texto-primario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil md:min-h-10"
          >
            <Icono nombre="salir" size={18} className="text-icono-default" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
