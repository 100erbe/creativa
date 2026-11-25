"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { guardarUltimaLista } from "@/lib/ultima-lista";

function Recordar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  useEffect(() => {
    guardarUltimaLista(pathname, search);
  }, [pathname, search]);
  return null;
}

/** Guarda en sessionStorage la URL actual de cada listado (filtros incluidos). */
export function RecordarListas() {
  return (
    <Suspense fallback={null}>
      <Recordar />
    </Suspense>
  );
}
