"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";

const CLASE_BASE =
  "group inline-flex min-h-11 w-fit items-center gap-esp1 text-sm text-texto-secundario transition-colors duration-rapida ease-suave hover:text-texto-primario active:scale-press md:min-h-0";

/**
 * Enlace/botón de retorno estándar en cabeceras de subpáginas y secciones secundarias móviles.
 * Cuando `usarHistorial` es true vuelve a la vista anterior si hay historial, o usa `href` como respaldo.
 */
export function BotonVolver({
  href,
  etiqueta = "Volver",
  soloMovil = false,
  usarHistorial = false,
  className,
}: {
  href: string;
  etiqueta?: string;
  soloMovil?: boolean;
  usarHistorial?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const clases = cn(CLASE_BASE, soloMovil && "md:hidden", className);
  const contenido = (
    <>
      <Icono
        nombre="atras"
        size={16}
        className="transition-transform duration-rapida ease-salida group-hover:-translate-x-0.5"
      />
      <span>{etiqueta}</span>
    </>
  );

  if (usarHistorial) {
    return (
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
          } else {
            router.push(href);
          }
        }}
        className={clases}
      >
        {contenido}
      </button>
    );
  }

  return (
    <Link href={href} className={clases}>
      {contenido}
    </Link>
  );
}
