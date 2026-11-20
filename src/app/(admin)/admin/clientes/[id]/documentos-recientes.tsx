"use client";

import { Icono } from "@/components/ui/iconos";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { ETIQUETA_ESTADO_DOC, ETIQUETA_TIPO } from "@/lib/documentos";
import { euros, fechaMedia } from "@/lib/formato";
import { TarjetaListaExpandible } from "./tarjeta-lista-expandible";

export type DocumentoClienteItem = {
  id: number;
  tipo: string;
  estado: string;
  numero_completo: string | null;
  fecha: string;
  total: number;
};

/**
 * Listado cronológico (más reciente a más antiguo) de los documentos de un cliente.
 * Muestra 3 por defecto con peeking hint y permite expandir/contraer todos.
 */
export function DocumentosRecientes({ documentos }: { documentos: DocumentoClienteItem[] }) {
  return (
    <TarjetaListaExpandible
      id="titulo-documentos-recientes"
      titulo="Documentos recientes"
      items={documentos}
      keyExtractor={(d) => d.id}
      hrefItem={(d) => `/admin/documentos/${d.id}`}
      textoVacio="Este cliente aún no tiene documentos."
      etiquetaExpandir={`Mostrar todos los documentos (${documentos.length})`}
      renderContenido={(d) => (
        <>
          <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fondo-sutil sm:flex">
            <Icono nombre="documentos" size={18} className="text-icono-default" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-texto-primario">
              {d.numero_completo ?? `${ETIQUETA_TIPO[d.tipo] ?? d.tipo} (borrador)`}
            </p>
            <p className="tabular-nums text-xs text-texto-terciario">
              {ETIQUETA_TIPO[d.tipo] ?? d.tipo} · {fechaMedia(d.fecha)}
            </p>
          </div>
          <span className="tabular-nums whitespace-nowrap text-sm font-medium text-texto-primario">
            {euros(d.total)}
          </span>
          <Insignia tono={TONO_POR_ESTADO[d.estado] ?? "neutro"}>
            {ETIQUETA_ESTADO_DOC[d.estado] ?? d.estado}
          </Insignia>
        </>
      )}
    />
  );
}
