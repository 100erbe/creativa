"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";

const ENLACES = [
  { href: "/app/agenda", etiqueta: "Agenda", icono: "calendario" },
  { href: "/app/mapa", etiqueta: "Mapa", icono: "ubicacion" },
  { href: "/app/avisos", etiqueta: "Avisos", icono: "avisos" },
] as const;

export function BarraInferior({ noLeidos = 0 }: { noLeidos?: number }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 flex items-center justify-around border-t border-borde-default bg-fondo-superficie py-esp2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
      {ENLACES.map((enlace) => {
        const activo = pathname.startsWith(enlace.href);
        return (
          <Link
            key={enlace.href}
            href={enlace.href}
            className={cn(
              "flex flex-col items-center gap-1 px-esp4 py-1 text-xs",
              activo ? "text-texto-marca" : "text-texto-terciario",
            )}
          >
            <span className="relative">
              <Icono nombre={enlace.icono} size={22} />
              {enlace.href === "/app/avisos" && noLeidos > 0 && (
                <span
                  aria-label={`${noLeidos} sin leer`}
                  className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-fondo-peligro px-1 text-[10px] font-semibold leading-none text-texto-inverso"
                >
                  {noLeidos > 9 ? "9+" : noLeidos}
                </span>
              )}
            </span>
            {enlace.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
