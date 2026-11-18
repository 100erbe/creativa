"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

/**
 * Menú de cuenta ("Account menu" de Figma): avatar, nombre y rol;
 * el chevron abre Mi cuenta, Cambiar contraseña y Cerrar sesión.
 */
export function MenuCuenta({
  nombre,
  rolEtiqueta,
  iniciales,
  avatarUrl,
  hrefCuenta,
  onSalir,
}: {
  nombre: string;
  rolEtiqueta: string;
  iniciales: string;
  avatarUrl: string | null;
  hrefCuenta: string;
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
        <Avatar url={avatarUrl} iniciales={iniciales} />
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
            href={hrefCuenta}
            onClick={() => setAbierto(false)}
            className="flex min-h-11 items-center gap-esp3 rounded-md px-esp3 text-cuerpo text-texto-primario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil md:min-h-10"
          >
            <Icono nombre="clientes" size={18} className="text-icono-default" />
            Mi cuenta
          </Link>
          <Link
            role="menuitem"
            href="/cuenta/contrasena"
            onClick={() => setAbierto(false)}
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
