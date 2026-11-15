"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { avisar } from "@/components/ui/dialogos";

/**
 * Comparte el PDF del documento con el menú nativo del dispositivo (WhatsApp, correo, Drive…).
 * Si el navegador no puede compartir archivos (p. ej. Firefox de escritorio), descarga el PDF.
 */
export function BotonCompartir({
  documentoId,
  archivo,
  titulo,
  texto,
  alCompartir,
  pagada = false,
  etiqueta = "Compartir PDF",
}: {
  documentoId: number;
  /** Nombre del archivo, sin extensión. */
  archivo: string;
  titulo: string;
  texto: string;
  /** Se llama cuando el PDF se ha compartido o descargado. */
  alCompartir?: () => void;
  /** PDF con el sello «PAGADA». */
  pagada?: boolean;
  etiqueta?: string;
}) {
  const [generando, setGenerando] = useState(false);

  async function compartir() {
    setGenerando(true);
    try {
      const respuesta = await fetch(`/api/documentos/${documentoId}/pdf${pagada ? "?pagada=1" : ""}`);
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const nombre = `${archivo.replace(/[\/:*?"<>|]+/g, "-")}.pdf`;
      const fichero = new File([await respuesta.blob()], nombre, { type: "application/pdf" });

      if (navigator.canShare?.({ files: [fichero] })) {
        await navigator.share({ files: [fichero], title: titulo, text: texto });
      } else {
        const url = URL.createObjectURL(fichero);
        const a = document.createElement("a");
        a.href = url;
        a.download = nombre;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
      alCompartir?.();
    } catch (e) {
      // Cancelar el menú de compartir no es un error.
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        await avisar("No se ha podido preparar el PDF. Inténtalo de nuevo o usa «Imprimir / PDF».");
      }
    } finally {
      setGenerando(false);
    }
  }

  return (
    <Boton variante="secundario" onClick={compartir} disabled={generando}>
      <Icono nombre="enviar" size={16} />
      {generando ? "Preparando PDF…" : etiqueta}
    </Boton>
  );
}
