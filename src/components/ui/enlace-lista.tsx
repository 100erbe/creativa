"use client";

import Link from "next/link";
import { useHrefLista } from "@/lib/ultima-lista";

/** `<Link>` hacia un listado que conserva los filtros con los que el usuario lo dejó. */
export function EnlaceLista({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const destino = useHrefLista(href) ?? href;
  return (
    <Link href={destino} className={className}>
      {children}
    </Link>
  );
}
