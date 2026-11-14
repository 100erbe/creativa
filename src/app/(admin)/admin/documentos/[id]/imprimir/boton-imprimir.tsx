"use client";

import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";

export function BotonImprimir() {
  return (
    <Boton onClick={() => window.print()}>
      <Icono nombre="descargar" size={16} />
      Imprimir / Guardar PDF
    </Boton>
  );
}
