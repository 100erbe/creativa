// CSV pensado para Excel en español: separador ";", decimales con coma y BOM UTF-8
// (sin BOM, Excel rompe las tildes y la ñ).

/** Texto → celda segura. Neutraliza fórmulas (=, +, -, @) para evitar inyección en Excel. */
function celdaTexto(valor: string): string {
  let v = valor.replace(/\r?\n/g, " ");
  if (/^[=+\-@\t]/.test(v)) v = `'${v}`;
  return /[;"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function celda(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") return String(valor).replace(".", ",");
  return celdaTexto(valor);
}

export function aCsv(cabecera: string[], filas: (string | number | null | undefined)[][]): string {
  const lineas = [cabecera.map(celdaTexto).join(";"), ...filas.map((f) => f.map(celda).join(";"))];
  return "﻿" + lineas.join("\r\n") + "\r\n";
}
