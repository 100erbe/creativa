"use client";

import { useState, type ReactNode } from "react";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { CabeceraTarjeta, Tarjeta } from "@/components/ui/tarjeta";
import { cn } from "@/lib/cn";
import Link from "next/link";

const LIMITE_INICIAL = 3;

/**
 * Tarjeta del sistema de diseño con listado cronológico expandible:
 * muestra 3 filas por defecto, insinúa la 4.ª con un degradado clicable ("peeking hint")
 * y permite abrir/cerrar el listado completo.
 */
export function TarjetaListaExpandible<T>({
  id,
  titulo,
  items,
  keyExtractor,
  hrefItem,
  renderContenido,
  textoVacio,
  etiquetaExpandir,
}: {
  id: string;
  titulo: string;
  items: T[];
  keyExtractor: (item: T) => string | number;
  hrefItem: (item: T) => string;
  renderContenido: (item: T) => ReactNode;
  textoVacio: string;
  etiquetaExpandir?: string;
}) {
  const [expandido, setExpandido] = useState(false);

  const tieneMas = items.length > LIMITE_INICIAL;
  const visibles = expandido ? items : items.slice(0, LIMITE_INICIAL);
  const itemSiguiente = !expandido && tieneMas ? items[LIMITE_INICIAL] : null;

  return (
    <Tarjeta como="section" relleno="panel" aria-labelledby={id} className="gap-esp3 md:gap-esp3">
      <CabeceraTarjeta
        id={id}
        titulo={titulo}
        accion={
          tieneMas ? (
            <Boton
              type="button"
              variante="fantasma"
              tamano="s"
              aria-expanded={expandido}
              onClick={() => setExpandido((prev) => !prev)}
              className="-mr-esp2"
            >
              {expandido ? "Ver menos" : `Ver todos (${items.length})`}
              <Icono
                nombre="chevron"
                size={14}
                className={cn(
                  "transition-transform duration-media ease-salida",
                  expandido ? "-rotate-90" : "rotate-90",
                )}
              />
            </Boton>
          ) : undefined
        }
      />

      {items.length > 0 ? (
        <div className="-mx-esp2 flex flex-col divide-y divide-borde-default">
          {visibles.map((item) => (
            <Link
              key={keyExtractor(item)}
              href={hrefItem(item)}
              className="flex items-center gap-esp3 rounded-md px-esp2 py-esp3 transition-colors duration-rapida ease-suave hover:bg-fondo-sutil focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-borde-foco"
            >
              {renderContenido(item)}
            </Link>
          ))}

          {itemSiguiente && (
            <button
              type="button"
              onClick={() => setExpandido(true)}
              aria-label={etiquetaExpandir ?? `Ver todos (${items.length})`}
              className="group relative block w-full cursor-pointer overflow-hidden rounded-b-md px-esp2 pb-esp1 pt-esp3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-borde-foco"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none flex max-h-10 select-none items-center gap-esp3 overflow-hidden opacity-75 transition-opacity duration-rapida ease-suave group-hover:opacity-100"
              >
                {renderContenido(itemSiguiente)}
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-fondo-superficie via-fondo-superficie/75 to-transparent"
              />
            </button>
          )}
        </div>
      ) : (
        <p className="py-esp3 text-sm text-texto-terciario">{textoVacio}</p>
      )}

      {expandido && tieneMas && (
        <Boton
          type="button"
          variante="secundario"
          tamano="s"
          className="w-full"
          onClick={() => setExpandido(false)}
        >
          Mostrar solo los últimos 3
          <Icono nombre="chevron" size={14} className="-rotate-90" />
        </Boton>
      )}
    </Tarjeta>
  );
}
