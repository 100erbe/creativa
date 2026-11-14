// Cálculos y textos de la hoja imprimible de un documento. Lógica pura, sin acceso a datos,
// para poder probarla aparte.

import { ETIQUETA_TIPO, PREFIJO_ARCHIVO } from "./documentos";

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Nombre que propone el navegador al "Guardar como PDF": "FAC 0139.26 Cliente S.L."
 * (el mismo criterio que ya usan las facturas de Creativa: prefijo, número con punto y cliente).
 * Se quitan los caracteres que Windows no admite en un nombre de archivo.
 */
export function nombreArchivo(tipo: string, numero: string | null, cliente: string): string {
  const limpiar = (t: string) => t.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  const prefijo = PREFIJO_ARCHIVO[tipo] ?? (ETIQUETA_TIPO[tipo] ?? "DOC").toUpperCase();
  const num = numero ? limpiar(numero.replace(/\//g, ".")) : "BORRADOR";
  // Los abonos se numeran "Abono001": el prefijo ya está en el número y no se repite.
  const prefijoEnNumero = num.toLowerCase().startsWith(prefijo.toLowerCase());
  const nombre = [numero ? (prefijoEnNumero ? "" : prefijo) : `BORRADOR ${prefijo}`, numero ? num : "", limpiar(cliente)]
    .filter(Boolean)
    .join(" ");
  return nombre.slice(0, 120).trim();
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
