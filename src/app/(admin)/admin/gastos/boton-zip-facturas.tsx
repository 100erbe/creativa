"use client";

import { useState } from "react";
import { zip } from "fflate";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { desenvolver } from "@/lib/accion";
import { firmarFacturasTrimestre } from "./fiscal-acciones";

/** Descarga en un ZIP las facturas y tickets adjuntos del trimestre (para el gestor). */
export function BotonZipFacturas({ ejercicio, trimestre }: { ejercicio: number; trimestre: number }) {
  const [estado, setEstado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function descargar() {
    setError(null);
    try {
      setEstado("Preparando…");
      const archivos = await desenvolver(firmarFacturasTrimestre(ejercicio, trimestre));
      if (archivos.length === 0) throw new Error("No hay facturas adjuntas en este trimestre.");
      const contenido: Record<string, Uint8Array> = {};
      for (const [i, a] of archivos.entries()) {
        setEstado(`Descargando ${i + 1} de ${archivos.length}…`);
        const respuesta = await fetch(a.url);
        if (!respuesta.ok) throw new Error(`No se pudo descargar ${a.nombre}.`);
        contenido[a.nombre] = new Uint8Array(await respuesta.arrayBuffer());
      }
      setEstado("Comprimiendo…");
      // Los PDF e imágenes ya van comprimidos: se guardan tal cual (level 0) para ir más rápido.
      const datos = await new Promise<Uint8Array>((ok, mal) =>
        zip(contenido, { level: 0 }, (e, r) => (e ? mal(e) : ok(r))),
      );
      const enlace = document.createElement("a");
      enlace.href = URL.createObjectURL(new Blob([datos as Uint8Array<ArrayBuffer>], { type: "application/zip" }));
      enlace.download = `facturas-gastos-${ejercicio}-T${trimestre}.zip`;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(enlace.href), 10_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo preparar el ZIP.");
    } finally {
      setEstado(null);
    }
  }

  return (
    <span className="flex flex-col gap-1">
      <Boton type="button" variante="secundario" onClick={descargar} cargando={estado != null}>
        <Icono nombre="descargar" size={16} />
        {estado ?? `Facturas T${trimestre} (.zip)`}
      </Boton>
      {error && <span className="text-xs text-texto-peligro">{error}</span>}
    </span>
  );
}
