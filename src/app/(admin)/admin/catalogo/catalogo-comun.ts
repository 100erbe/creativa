

export type CategoriaAdmin = {
  id: number;
  codigo: string;
  nombre: string;
  orden: number;
};

export type FormatoAdmin = {
  id: number;
  codigo: string;
  nombre: string;
  anchoCm: number | null;
  altoCm: number | null;
  precioFabricacion: number | null;
  precioInstalacion: number | null;
  /** Coste interno de fabricación propio del formato (null = el del producto). */
  costeFabricacion: number | null;
  alias: string[];
  activo: boolean;
};

export type ProductoAdmin = {
  id: number;
  codigo: string;
  categoriaId: number;
  categoriaNombre: string;
  ordenCategoria: number;
  nombre: string;
  descripcionFactura: string | null;
  material: string | null;
  unidadVenta: string;
  admiteMedidaLibre: boolean;
  permiteFabricacion: boolean;
  permiteInstalacion: boolean;
  instalableEnCampana: boolean;
  precioFabricacion: number | null;
  precioInstalacion: number | null;
  /** Coste interno aproximado (€/unidad de venta). Nunca visible para el cliente. */
  costeFabricacion: number | null;
  costeInstalacion: number | null;
  pedidoMinimo: number | null;
  ivaPct: number;
  activo: boolean;
  notas: string | null;
  formatos: FormatoAdmin[];
};

export const UNIDAD_CORTA: Record<string, string> = {
  ud: "ud",
  m2: "m²",
  ml: "ml",
  millar: "millar",
  mes: "mes",
  servicio: "servicio",
  km: "km",
};

export const UNIDADES_OPCIONES = [
  { valor: "ud", etiqueta: "Unidad (ud)" },
  { valor: "m2", etiqueta: "Metro cuadrado (m²)" },
  { valor: "ml", etiqueta: "Metro lineal (ml)" },
  { valor: "millar", etiqueta: "Millar (1.000 uds)" },
  { valor: "mes", etiqueta: "Mes (alquiler)" },
  { valor: "servicio", etiqueta: "Servicio / tarifa plana" },
  { valor: "km", etiqueta: "Kilómetro (km)" },
];

export const IVAS = [21, 10, 4, 0];

/**
 * ¿Le falta coste interno a alguna parte que se puede vender? (para el aviso «Sin coste»)
 * Fabricación: vale el coste del producto o, si no lo tiene, que todos los formatos activos tengan el suyo.
 */
export function faltaCoste(p: ProductoAdmin) {
  const activos = p.formatos.filter((f) => f.activo);
  const fabOk =
    !p.permiteFabricacion ||
    p.costeFabricacion != null ||
    (activos.length > 0 && activos.every((f) => f.costeFabricacion != null));
  const instOk = !p.permiteInstalacion || p.costeInstalacion != null;
  return !(fabOk && instOk);
}

/** "12,5" → 12.5; vacío → null; texto inválido → NaN */
export function aNumero(v: string): number | null {
  const t = v.trim().replace(/\s|€/g, "");
  if (t === "") return null;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
}

export const aTexto = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

export const etiquetaMini = "flex flex-col gap-1 text-xs font-medium text-texto-secundario";

/** ¿El producto coincide con la búsqueda (q ya en minúsculas)? Nombre, código, categoría, descripción, material, formatos y alias. */
export function coincideProducto(p: ProductoAdmin, q: string) {
  const textoFormatos = p.formatos.map((f) => `${f.nombre} ${f.codigo} ${f.alias.join(" ")}`).join(" ");
  return `${p.nombre} ${p.codigo} ${p.categoriaNombre} ${p.descripcionFactura ?? ""} ${p.material ?? ""} ${textoFormatos}`
    .toLowerCase()
    .includes(q);
}
