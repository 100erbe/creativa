"use client";

import { Autocompletar } from "@/components/ui/autocompletar";
import {
  sugerirClientes,
  sugerirDocumentos,
  sugerirGastos,
  sugerirLibroRegistro,
} from "@/lib/sugerencias-busqueda";

/**
 * Buscador con sugerencias para las páginas de servidor que filtran con un formulario GET
 * (`name="q"`): las sugerencias abren el elemento; Intro sin selección envía el formulario.
 */
export function BuscadorAdmin({
  fuente,
  ejercicio,
  incluirInactivos,
  defaultValue,
  placeholder,
  ariaLabel,
  className,
  classNameContenedor,
}: {
  fuente: "clientes" | "documentos" | "gastos" | "libro";
  /** Para gastos y libro registro: el ejercicio que se está viendo. */
  ejercicio?: number;
  /** Para clientes: si la lista muestra también los inactivos. */
  incluirInactivos?: boolean;
  defaultValue?: string;
  placeholder: string;
  ariaLabel: string;
  className?: string;
  classNameContenedor?: string;
}) {
  const anio = ejercicio ?? new Date().getFullYear();
  const buscar = (q: string) => {
    switch (fuente) {
      case "clientes":
        return sugerirClientes(q, incluirInactivos);
      case "documentos":
        return sugerirDocumentos(q);
      case "gastos":
        return sugerirGastos(q, anio);
      case "libro":
        return sugerirLibroRegistro(q, anio);
    }
  };
  return (
    <Autocompletar
      name="q"
      defaultValue={defaultValue}
      buscar={buscar}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      className={className}
      classNameContenedor={classNameContenedor}
    />
  );
}
