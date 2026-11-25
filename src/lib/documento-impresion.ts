// Cálculos y textos de la hoja imprimible de un documento. Lógica pura, sin acceso a datos,
// para poder probarla aparte.

import { ETIQUETA_TIPO, PREFIJO_ARCHIVO } from "./documentos";
import { redondearCentimos } from "@/lib/redondeo";

const redondear = redondearCentimos;

const LARGO_MAXIMO_NOMBRE = 100;
const LARGO_MAXIMO_CONCEPTO = 45;

/** Quita lo que Windows no admite en un nombre de archivo, los espacios dobles y los puntos finales. */
function limpiarNombre(t: string): string {
  return t
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s.,;·-]+$/, "");
}

/** Corta en una palabra entera, sin pasar de `max` caracteres. */
function cortarEnPalabra(t: string, max: number): string {
  if (t.length <= max) return t;
  const corte = t.slice(0, max + 1).replace(/\s+\S*$/, "");
  return (corte || t.slice(0, max)).replace(/[\s.,;·-]+$/, "");
}

/** «SEA LIFE CENTRE SPAIN S.A.» → «SEA LIFE CENTRE SPAIN»: sin la forma societaria, que alarga el nombre. */
export function clienteCorto(razonSocial: string, nombreComercial?: string | null): string {
  const base = (nombreComercial?.trim() || razonSocial).trim();
  const sinForma = base.replace(
    /[\s,]+(S\.?\s?L\.?\s?U\.?|S\.?\s?L\.?\s?L\.?|S\.?\s?L\.?|S\.?\s?A\.?\s?U\.?|S\.?\s?A\.?|A\.?\s?I\.?\s?E\.?|S\.?\s?C\.?|C\.?\s?B\.?|S\.?\s?COOP\.?(\s?AND\.?)?)$/i,
    "",
  );
  return limpiarNombre(sinForma || base);
}

/**
 * Concepto corto para el nombre del archivo: la campaña o, si no hay, el primer trozo de la
 * descripción (hasta « · », el salto de línea o la primera coma), cortado en una palabra entera.
 */
export function conceptoCorto(campana: string | null | undefined, descripcion: string | null | undefined): string {
  const texto = ((campana?.trim() || descripcion?.trim() || "").split(/\s·\s|\n/)[0] ?? "").trim();
  if (!texto) return "";
  const coma = texto.indexOf(", ");
  const primero = coma >= 12 ? texto.slice(0, coma) : texto;
  return cortarEnPalabra(limpiarNombre(primero), LARGO_MAXIMO_CONCEPTO);
}

/** «FAC-0142/26» → «0142.26»; si el número no sigue ese formato, se deja tal cual (limpio). */
function numeroParaArchivo(numero: string): string {
  const m = numero.match(/(\d+)\s*\/\s*(\d+)\s*$/);
  return m ? `${m[1]}.${m[2]}` : limpiarNombre(numero.replace(/\//g, "."));
}

export type DatosNombreArchivo = {
  tipo: string;
  numero: string | null;
  razonSocial: string;
  nombreComercial?: string | null;
  campana?: string | null;
  descripcion?: string | null;
  /** PDF con el sello «PAGADA». */
  pagada?: boolean;
};

/**
 * Nombre de un documento al guardarlo o compartirlo como PDF (sin extensión), igual en todas partes:
 * «FAC 0142.26 SEA LIFE CENTRE SPAIN, SERVICIOS DE STREET-MARKETING». Sigue el criterio de los PDF de
 * Creativa: prefijo, número con punto y año, cliente, coma y concepto. «BORRADOR» delante en los
 * borradores y «PAGADA» al final si lleva el sello.
 */
export function nombreArchivo(d: DatosNombreArchivo): string {
  const prefijo = PREFIJO_ARCHIVO[d.tipo] ?? (ETIQUETA_TIPO[d.tipo] ?? "DOC").toUpperCase();
  const cabeza = d.numero ? `${prefijo} ${numeroParaArchivo(d.numero)}` : `BORRADOR ${prefijo}`;
  const cliente = clienteCorto(d.razonSocial, d.nombreComercial);
  const cola = d.pagada ? " PAGADA" : "";
  const sinConcepto = limpiarNombre([cabeza, cliente].filter(Boolean).join(" "));
  const sitio = LARGO_MAXIMO_NOMBRE - sinConcepto.length - cola.length - 2;
  const concepto = sitio >= 8 ? cortarEnPalabra(conceptoCorto(d.campana, d.descripcion), sitio) : "";
  const nombre = concepto && cliente ? `${sinConcepto}, ${concepto}` : concepto ? `${sinConcepto} ${concepto}` : sinConcepto;
  return `${cortarEnPalabra(nombre, LARGO_MAXIMO_NOMBRE - cola.length)}${cola}`;
}

/** Versión ASCII del nombre para la cabecera Content-Disposition (el nombre completo va en filename*). */
/** Logos de los documentos impresos y PDF (facturas, estado de cuenta): los originales, no los de la interfaz. */
export const LOGO_IMPRESION_PRINCIPAL = "/brand/logo-creativa.svg";
export const LOGO_IMPRESION_SECUNDARIO = "/brand/logo-crea-comunicacion.svg";

export function cabeceraDescarga(nombre: string, modo: "inline" | "attachment" = "attachment"): string {
  const ascii = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "");
  return `${modo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}

type LineaIva = { importe: number | string; iva_pct: number | string };

/** Base y cuota por tipo de IVA (mismo criterio que la vista v_resumen_iva_trimestral). */
export function desgloseIva(
  lineas: LineaIva[],
  descuentoGlobalPct: number,
  sinIva: boolean,
): { tipo: number; base: number; cuota: number }[] {
  const factor = 1 - descuentoGlobalPct / 100;
  const porTipo = new Map<number, number>();
  for (const l of lineas) {
    const tipo = Number(l.iva_pct);
    porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + Number(l.importe) * factor);
  }
  return [...porTipo.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tipo, base]) => ({
      tipo,
      base: redondear(base),
      cuota: sinIva ? 0 : redondear((base * tipo) / 100),
    }));
}

/**
 * "CIF B-92715382" / "NIF 25.703.757-S". El tipo sale de la ficha del cliente; si el número
 * ya lleva su propio prefijo (p. ej. "VAT CZ29148456") no se repite.
 */
export function etiquetaDocumentoIdentidad(tipoDocumento: string | null | undefined, numero: string): string {
  const etiqueta: Record<string, string> = { CIF: "CIF", NIF: "NIF", NIE: "NIE", VAT_UE: "VAT", OTRO: "" };
  const prefijo = tipoDocumento ? (etiqueta[tipoDocumento] ?? "") : "NIF/CIF";
  if (!prefijo || numero.toUpperCase().startsWith(prefijo)) return numero;
  return `${prefijo} ${numero}`;
}

type LineaPrecio = {
  precio_unitario: number | string;
  recargo_acabados?: number | string | null;
  descuento_pct: number | string;
  cantidad: number | string;
  importe: number | string;
};

/**
 * Precio unitario que se imprime: el de tarifa más el recargo por acabados, que es sobre lo que
 * calcula el importe la base de datos (cantidad × (precio + recargo) × (1 − dto)). Así la
 * línea impresa se puede comprobar a mano.
 */
export function precioUnitarioImpreso(l: LineaPrecio): number {
  return Number(l.precio_unitario) + Number(l.recargo_acabados ?? 0);
}

/** ¿El importe de la línea coincide con cantidad × precio × (1 − dto)? Para detectar datos incoherentes. */
export function lineaCuadra(l: LineaPrecio): boolean {
  const esperado = redondear(
    Number(l.cantidad) * precioUnitarioImpreso(l) * (1 - Number(l.descuento_pct) / 100),
  );
  return Math.abs(esperado - Number(l.importe)) <= 0.011;
}

const NUMERO = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
export function formatoCantidad(n: number | string): string {
  return NUMERO.format(Number(n));
}

// Importes en facturas: siempre con separador de miles ("3.025,00"), también de 4 cifras,
// para que las columnas se lean y alineen igual en todos los documentos.
const IMPORTE = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: "always",
});

/** "3.025,00" — para columnas de tabla (el símbolo € va en la cabecera). */
export function formatoImporte(n: number | string): string {
  return IMPORTE.format(Number(n));
}

/** "3.025,00 €" — para totales. */
export function formatoEuros(n: number | string): string {
  return `${IMPORTE.format(Number(n))} €`;
}
