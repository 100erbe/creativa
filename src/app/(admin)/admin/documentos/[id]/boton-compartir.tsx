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
  // PDF ya generado y a la espera de un click: compartir necesita un gesto del usuario reciente,
  // y generar el PDF tarda lo bastante como para que el navegador lo considere caducado.
  const [listo, setListo] = useState<File | null>(null);

  function descargar(fichero: File) {
    const url = URL.createObjectURL(fichero);
    const a = document.createElement("a");
    a.href = url;
    a.download = fichero.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function compartir() {
    setGenerando(true);
    try {
      let fichero = listo;
      const reutilizado = !!fichero;
      if (!fichero) {
        const respuesta = await fetch(`/api/documentos/${documentoId}/pdf${pagada ? "?pagada=1" : ""}`);
        if (!respuesta.ok) {
          const detalle = (await respuesta.text().catch(() => "")).slice(0, 200);
          throw new Error(`HTTP ${respuesta.status}${detalle ? ` · ${detalle}` : ""}`);
        }
        const nombre = `${archivo.replace(/[\/:*?"<>|]+/g, "-")}.pdf`;
        fichero = new File([await respuesta.blob()], nombre, { type: "application/pdf" });
      }

      if (navigator.canShare?.({ files: [fichero] })) {
        try {
          await navigator.share({ files: [fichero], title: titulo, text: texto });
        } catch (e) {
          // Cancelar el menú de compartir no es un error.
          if (e instanceof DOMException && e.name === "AbortError") return;
          if (!reutilizado) {
            // El gesto caducó mientras se generaba: se deja el PDF listo para compartirlo con el siguiente click.
            setListo(fichero);
            return;
          }
          descargar(fichero);
        }
      } else {
        descargar(fichero);
      }
      setListo(null);
      alCompartir?.();
    } catch (e) {
      console.error("Compartir PDF:", e);
      const motivo = e instanceof Error ? e.message : String(e);
      await avisar(`No se ha podido preparar el PDF (${motivo}). Inténtalo de nuevo o usa «Imprimir / PDF».`);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <Boton variante="secundario" onClick={compartir} disabled={generando}>
      <Icono nombre="enviar" size={16} />
      {generando ? "Preparando PDF…" : listo ? "PDF listo · Compartir" : etiqueta}
    </Boton>
  );
}
