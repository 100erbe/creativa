"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

const ENLACES = [
  { href: "/app/agenda", etiqueta: "Agenda", icono: "calendario" },
  { href: "/app/mapa", etiqueta: "Mapa", icono: "ubicacion" },
] as const;

export function BarraInferior() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function salir() {
    await supabase.auth.signOut();
    router.push("/entrar");
    router.refresh();
  }

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
            <Icono nombre={enlace.icono} size={22} />
            {enlace.etiqueta}
          </Link>
        );
      })}
      <button
        onClick={salir}
        className="flex flex-col items-center gap-1 px-esp4 py-1 text-xs text-texto-terciario"
      >
        <Icono nombre="salir" size={22} />
        Salir
      </button>
    </nav>
  );
}
