"use client";

import { useEffect, useState } from "react";

/**
 * Recuerda, por sesión de navegador, la última URL (con filtros, búsqueda y página)
 * de cada listado, para que los botones «← Volver al listado» de las fichas de detalle
 * devuelvan al usuario a la lista tal y como la dejó, y no a la lista sin filtrar.
 */
const LISTADOS = [
  "/admin/documentos",
  "/admin/gastos",
  "/admin/clientes",
  "/admin/campanas",
  "/admin/avisos",
  "/admin/catalogo",
  "/admin/cobros",
  "/app/gastos",
] as const;

const PREFIJO = "ultima-lista:";

export function esListado(pathname: string) {
  return (LISTADOS as readonly string[]).includes(pathname);
}

export function guardarUltimaLista(pathname: string, search: string) {
  if (!esListado(pathname)) return;
  try {
    sessionStorage.setItem(PREFIJO + pathname, search ? `${pathname}?${search}` : pathname);
  } catch {
    // Sin almacenamiento (modo privado, bloqueado...): se vuelve a la lista sin filtros.
  }
}

export function leerUltimaLista(href: string): string {
  if (!esListado(href)) return href;
  try {
    return sessionStorage.getItem(PREFIJO + href) ?? href;
  } catch {
    return href;
  }
}

/** Devuelve `href` o, si es un listado, la última URL filtrada de ese listado en esta sesión. */
export function useHrefLista(href: string | undefined): string | undefined {
  const [resuelto, setResuelto] = useState(href);
  useEffect(() => {
    setResuelto(href ? leerUltimaLista(href) : href);
  }, [href]);
  return resuelto;
}
