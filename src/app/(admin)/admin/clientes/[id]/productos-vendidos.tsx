"use client";

import { Icono } from "@/components/ui/iconos";
import { formatoCantidad } from "@/lib/documento-impresion";
import { ETIQUETA_UNIDAD } from "@/lib/documentos";
import { euros, fechaMedia } from "@/lib/formato";
import { TarjetaListaExpandible } from "./tarjeta-lista-expandible";

export type ProductoVendidoItem = {
  id: number;
  documentoId: number;
  numeroDocumento: string | null;
  fecha: string;
  descripcion: string;
  artista: string | null;
  cantidad: number;
  unidad: string;
  importe: number;
};

/**
 * Listado cronológico (más reciente a más antiguo) de los productos y servicios
 * facturados a un cliente. Muestra 3 por defecto con peeking hint y permite expandir/contraer el resto.
 */
export function ProductosVendidos({ items }: { items: ProductoVendidoItem[] }) {
  return (
    <TarjetaListaExpandible
      id="titulo-productos-vendidos"
      titulo="Productos y servicios vendidos"
      items={items}
      keyExtractor={(item) => item.id}
      hrefItem={(item) => `/admin/documentos/${item.documentoId}`}
      textoVacio="Este cliente aún no tiene productos ni servicios facturados."
      etiquetaExpandir={`Mostrar todos los productos y servicios (${items.length})`}
      renderContenido={(item) => (
        <>
          <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fondo-sutil sm:flex">
            <Icono nombre="catalogo" size={18} className="text-icono-default" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-medium text-texto-primario">{item.descripcion}</p>
            {item.artista && <p className="truncate text-xs text-texto-secundario">{item.artista}</p>}
            <p className="tabular-nums text-xs text-texto-terciario">
              {formatoCantidad(item.cantidad)} {ETIQUETA_UNIDAD[item.unidad] ?? item.unidad} ·{" "}
              {item.numeroDocumento ?? "Factura"} · {fechaMedia(item.fecha)}
            </p>
          </div>
          <span className="tabular-nums whitespace-nowrap text-sm font-medium text-texto-primario">
            {euros(item.importe)}
          </span>
        </>
      )}
    />
  );
}
