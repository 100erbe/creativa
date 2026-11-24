"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { avisar } from "@/components/ui/dialogos";

/** Nombre del archivo que manda el servidor (filename* en UTF-8 si lo hay). */
function nombreDeCabecera(cabecera: string | null): string | null {
  if (!cabecera) return null;
  const utf8 = cabecera.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      /* se usa el nombre simple */
    }
  }
  return cabecera.match(/filename="([^"]+)"/i)?.[1] ?? null;
}

/**
 * Descarga el PDF del documento ya con su nombre («FAC 0142.26 CLIENTE, Concepto.pdf»), sin pasar por
 * la ventana de imprimir: así no hay que escribir el nombre a mano en el «Guardar como» de Windows.
 */
export function BotonDescargarPdf({ documentoId, pagada = false }: { documentoId: number; pagada?: boolean }) {
  const [generando, setGenerando] = useState(false);

  async function descargar() {
    setGenerando(true);
    try {
      const respuesta = await fetch(`/api/documentos/${documentoId}/pdf?descargar=1${pagada ? "&pagada=1" : ""}`);
      if (!respuesta.ok) {
        const detalle = (await respuesta.text().catch(() => "")).slice(0, 200);
        throw new Error(`HTTP ${respuesta.status}${detalle ? ` · ${detalle}` : ""}`);
      }
      const nombre = nombreDeCabecera(respuesta.headers.get("Content-Disposition")) ?? `Documento ${documentoId}.pdf`;
      const url = URL.createObjectURL(await respuesta.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      await avisar(`No se ha podido generar el PDF. ${e instanceof Error ? e.message : ""}`.trim());
    } finally {
      setGenerando(false);
    }
  }

  return (
    <Boton variante="secundario" cargando={generando} onClick={descargar}>
      <Icono nombre="descargar" size={16} />
      Descargar PDF
    </Boton>
  );
}
