// Comprueba WCAG 2.2 AA sobre los tokens: `npm run contraste`. Sale con código 1 si algún par falla.
import { fondo, texto, borde, icono, documento, estadoDocumento, grafico } from "../src/design/tokens";

const lum = (h: string) => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

type Par = [string, string, string, string, number];
const pares: Par[] = [];
const fondosTexto = ["lienzo", "superficie", "sutil", "marca-sutil", "exito-sutil", "aviso-sutil", "peligro-sutil", "critico-sutil", "info-sutil"] as const;
const f = fondo as Record<string, string>;
const t = texto as Record<string, string>;
const v = (o: Record<string, string>, k: string): string => o[k] ?? (() => { throw new Error(`token inexistente: ${k}`); })();

// Texto normal (4,5:1). Los textos de color sobre fondo-hover solo se exigen al neutro (único uso real).
for (const k of ["primario", "secundario", "terciario"]) {
  for (const b of [...fondosTexto, "hover"]) pares.push([`texto-${k}`, v(t, k), `fondo-${b}`, v(f, b), 4.5]);
}
for (const k of ["marca", "exito", "aviso", "peligro", "critico", "info"]) {
  for (const b of fondosTexto) pares.push([`texto-${k}`, v(t, k), `fondo-${b}`, v(f, b), 4.5]);
}
for (const b of ["marca", "marca-hover", "peligro", "peligro-hover", "critico", "critico-hover"]) pares.push(["texto-sobre-marca/inverso", v(t, "sobre-marca"), `fondo-${b}`, v(f, b), 4.5]);
pares.push(["texto-inverso", v(t, "inverso"), "fondo-inverso", v(f, "inverso"), 4.5]);
// Documento imprimible
for (const [k, b] of [["texto", "papel"], ["texto-suave", "papel"], ["tenue", "papel"], ["tenue", "fondo"], ["sello", "papel"], ["acento", "papel"], ["sobre-acento", "acento"]] as const) {
  const d = documento as Record<string, string>;
  pares.push([`documento-${k}`, v(d, k), `documento-${b}`, v(d, b), 4.5]);
}
pares.push(["texto-aviso", v(t, "aviso"), "fondo-aviso-sutil (aviso borrador)", v(f, "aviso-sutil"), 4.5]);
// Componentes de interfaz y foco (3:1)
for (const b of ["lienzo", "superficie"]) {
  pares.push(["borde-campo", borde.campo, `fondo-${b}`, v(f, b), 3]);
  pares.push(["borde-foco", borde.foco, `fondo-${b}`, v(f, b), 3]);
  pares.push(["borde-critico", borde.critico, `fondo-${b}`, v(f, b), 3]);
  pares.push(["icono-secundario", icono.secundario, `fondo-${b}`, v(f, b), 3]);
  pares.push(["icono-default", icono.default, `fondo-${b}`, v(f, b), 3]);
}
// Sistema "Documentos": iconos sobre los fondos de la navegación y de las tarjetas (3:1).
for (const b of ["sutil", "hover", "marca-sutil", "aviso-sutil"]) {
  pares.push(["icono-default", icono.default, `fondo-${b}`, v(f, b), 3]);
}
pares.push(["icono-marca", icono.marca, "fondo-marca-sutil", v(f, "marca-sutil"), 3]);
// Insignia redonda de estado del documento: icono sobre su fondo (3:1) y la etiqueta del tooltip (4,5:1).
for (const [estado, { fondo: fe, icono: ie }] of Object.entries(estadoDocumento)) {
  pares.push([`estadoDocumento.${estado}.icono`, ie, `estadoDocumento.${estado}.fondo`, fe, 3]);
}
pares.push(["texto-inverso (tooltip)", v(t, "inverso"), "grafico.tooltip", grafico.tooltip, 4.5]);
// Las líneas de los gráficos son componentes gráficos: 3:1 sobre la tarjeta.
for (const [k, c] of Object.entries(grafico.linea)) pares.push([`grafico.linea.${k}`, c, "fondo-superficie", v(f, "superficie"), 3]);

let fallos = 0;
for (const [a, ah, b, bh, min] of pares) {
  const r = ratio(ah, bh);
  if (r < min) {
    fallos++;
    console.log(`FALLA ${r.toFixed(2)} < ${min}  ${a} (${ah}) sobre ${b} (${bh})`);
  }
}
console.log(`${pares.length} pares comprobados, ${fallos} fallos.`);
process.exit(fallos ? 1 : 0);
