"use client";

import { CAMPO } from "@/components/ui/panel-busqueda";
import { cn } from "@/lib/cn";

export type Alcance = "fabricacion" | "instalacion" | "fabricacion_instalacion";

export type Cabecera = {
  id: number;
  tipo: string;
  cliente_id: number;
  cliente: string;
  descuento_habitual: number;
  suma_lineas: number;
  descuento_global_pct: number;
  base_imponible: number;
  cuota_iva: number;
  total: number;
  campana_id: number | null;
};

export type SituacionCliente = {
  anio: number;
  facturadoAnio: number;
  cobradoAnio: number;
  pendiente: number;
  vencido: number;
  facturasVencidas: number;
  maxDiasVencido: number;
  tieneCriticas90: boolean;
};

export type Linea = {
  id: number;
  descripcion: string;
  artista: string | null;
  piezas: number;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  recargo_acabados: number;
  descuento_pct: number;
  importe: number;
  /** Coste interno € por unidad (null = sin coste). Nunca visible para el cliente. */
  coste_unitario: number | null;
};

export type FormatoCatalogo = {
  id: number;
  codigo: string;
  nombre: string;
  ancho: number | null;
  alto: number | null;
  precioFabricacion: number | null;
  precioInstalacion: number | null;
  costeFabricacion: number | null;
  alias: string[];
};

export type ProductoCatalogo = {
  id: number;
  codigo: string;
  nombre: string;
  descripcionFactura: string | null;
  unidad: string;
  medidaLibre: boolean;
  fabricacion: boolean;
  instalacion: boolean;
  precioFabricacion: number | null;
  precioInstalacion: number | null;
  costeFabricacion: number | null;
  costeInstalacion: number | null;
  pedidoMinimo: number | null;
  ivaPct: number;
  categoriaId: number | null;
  categoria: string;
  ordenCategoria: number;
  formatos: FormatoCatalogo[];
};

export type CategoriaOpcion = {
  id: number;
  nombre: string;
  orden: number;
};

export type Reciente = {
  producto_id: number;
  formato_id: number | null;
  alcance: string;
  ultimo_precio: number;
  ultimo_descuento: number;
};

export const UNIDAD: Record<string, string> = {
  ud: "ud",
  m2: "m²",
  ml: "ml",
  millar: "millar",
  mes: "mes",
  servicio: "servicio",
  km: "km",
};

/** "12,5" o "12.5" → 12.5 ("1.250,5" → 1250.5); vacío o inválido → NaN */
export function num(valor: string) {
  const t = valor.trim().replace(/\s|€|%/g, "");
  if (t === "") return NaN;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
}
/** Para inputs: 12.5 → "12,5" (sin separador de miles para que num() lo relea bien). */
export function texto(valor: number, decimales = 2) {
  return Number.isFinite(valor) ? String(Math.round(valor * 10 ** decimales) / 10 ** decimales).replace(".", ",") : "";
}

export function normalizar(t: string) {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function alcancesDe(p: ProductoCatalogo): Alcance[] {
  if (p.fabricacion && p.instalacion) return ["fabricacion_instalacion", "fabricacion", "instalacion"];
  if (p.fabricacion) return ["fabricacion"];
  if (p.instalacion) return ["instalacion"];
  return ["fabricacion_instalacion"];
}

export function calcularCantidadLocal(
  unidad: string,
  piezas: number,
  anchoCm: number,
  altoCm: number,
  pedidoMinimo: number | null,
) {
  if (!Number.isFinite(piezas)) return NaN;
  if ((unidad === "m2" || unidad === "ml") && Number.isFinite(anchoCm) && Number.isFinite(altoCm)) {
    if (unidad === "m2") {
      return piezas * Math.max((anchoCm * altoCm) / 10000, pedidoMinimo ?? 0);
    }
    return (piezas * 2 * (anchoCm + altoCm)) / 100;
  }
  return piezas;
}

export function calcularPrecioBaseLocal(p: ProductoCatalogo, formatoId: number | null, alcance: Alcance) {
  const f = formatoId != null ? p.formatos.find((x) => x.id === formatoId) : undefined;
  const fabRaw = f?.precioFabricacion ?? p.precioFabricacion;
  const instRaw = f?.precioInstalacion ?? p.precioInstalacion;
  const fab = fabRaw ?? 0;
  const inst = instRaw ?? 0;
  const precio = alcance === "fabricacion" ? fab : alcance === "instalacion" ? inst : fab + inst;
  const definido =
    alcance === "fabricacion"
      ? fabRaw != null
      : alcance === "instalacion"
        ? instRaw != null
        : fabRaw != null || instRaw != null;
  return { precio, definido };
}

export const entrada = CAMPO;

export function Etiqueta({
  texto: t,
  className,
  grupo,
  children,
}: {
  texto: string;
  className?: string;
  /** Grupo de botones: un <label> activaría el primero al tocar el título. */
  grupo?: boolean;
  children: React.ReactNode;
}) {
  const Contenedor = grupo ? "div" : "label";
  return (
    <Contenedor className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-texto-secundario">{t}</span>
      {children}
    </Contenedor>
  );
}

export function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center">
      <span className="flex-1 text-sm text-texto-secundario">{etiqueta}</span>
      <span className="text-sm font-medium text-texto-primario">{valor}</span>
    </div>
  );
}

// ---------------------------------------------------------------------
//  Concepto libre: algo que no está en el catálogo (o alta rápida al vuelo)
// ---------------------------------------------------------------------

export const IVAS = [21, 10, 4, 0];
