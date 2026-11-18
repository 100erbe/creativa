// ÚNICA fuente de verdad de los colores del sistema de diseño (espejo de las variables de Figma,
// archivo "Documentos recientes · Row & status interactions", colecciones "Documentos / Primitives"
// y "Documentos / Semantic"). Lo consumen tailwind.config.ts, el mapa (Leaflet), el viewport
// (themeColor) y la hoja imprimible. No escribas hexadecimales en ningún otro sitio.
// Todos los pares texto/fondo usados cumplen WCAG 2.2 AA (4,5:1 texto, 3:1 componentes de interfaz):
// se comprueba con `npm run contraste`. Tres colores de Figma no llegan a AA como texto y aquí van
// corregidos: muted #73788A → #676C7C, red #BB4A62 → #B5485F y green #167D67 → #167B65 (Figma no se ha tocado).

/** Paleta base de Figma ("Documentos / Primitives"). Poco uso directo: preferir los semánticos. */
export const primitivas = {
  base: {
    canvas: "#F3F4F8",
    surface: "#FFFFFF",
    ink: "#202435",
    muted: "#73788A",
    line: "#ECEEF4",
    soft: "#F7F8FC",
    brand: "#5A4BE7",
    amber: "#6652CE",
    "amber-bg": "#F0EDFF",
    blue: "#3568C8",
    "blue-bg": "#EDF3FF",
    green: "#167D67",
    "green-bg": "#E9F7F0",
    red: "#BB4A62",
    "red-bg": "#FDEEF2",
    gray: "#6D7486",
    "gray-bg": "#F0F2F6",
    tooltip: "#282A3D",
    "warning-700": "#915B13",
    "warning-50": "#FFF8EA",
  },
};

export const fondo = {
  lienzo: "#F3F4F8", superficie: "#FFFFFF", elevado: "#FFFFFF", sutil: "#F7F8FC",
  hover: "#F0F2F6", marca: "#5A4BE7", "marca-hover": "#4A3BD1",
  "marca-sutil": "#F0EDFF", inverso: "#282A3D",
  "exito-sutil": "#E9F7F0", "aviso-sutil": "#FFF8EA",
  "peligro-sutil": "#FDEEF2", "info-sutil": "#EDF3FF",
  "critico-sutil": "#FDEEF2",
  peligro: "#B5485F", "peligro-hover": "#9C3B51",
  critico: "#8E2440", "critico-hover": "#771D35",
  // Capas semitransparentes (fondo de diálogos/menús y etiquetas sobre fotos), sobre la tinta.
  velo: "rgb(32 36 53 / 0.4)",
  "velo-fuerte": "rgb(32 36 53 / 0.7)",
};

export const texto = {
  primario: "#202435",
  // muted de Figma oscurecido: ≥ 4,5:1 sobre todos los fondos (el original da 4,39 sobre blanco).
  secundario: "#676C7C",
  terciario: "#676C7C",
  "sobre-marca": "#FFFFFF", marca: "#5A4BE7", inverso: "#FFFFFF",
  exito: "#167B65", aviso: "#915B13", peligro: "#B5485F", critico: "#8E2440", info: "#3568C8",
};

export const borde = {
  // Decorativos (separadores, tarjetas): no requieren contraste.
  default: "#ECEEF4", sutil: "#F3F4F8", fuerte: "#DDE0E8",
  // Límite de un control (input, select): WCAG 1.4.11 exige 3:1.
  campo: "#73788A",
  foco: "#5A4BE7",
  peligro: "#B5485F", critico: "#8E2440", exito: "#BFE6D6", aviso: "#F2DDB4",
  "peligro-sutil": "#F4C9D4", "critico-sutil": "#EBB8C6", info: "#C9D9F5", marca: "#D9D3FF",
};

export const icono = {
  // Los iconos de Figma usan muted (#73788A): para gráficos basta 3:1.
  default: "#73788A", secundario: "#73788A", marca: "#5A4BE7", "sobre-marca": "#FFFFFF",
};

/** Estado de un documento: insignia redonda 44×44 con icono (componente "Documents / Document status"). */
export const estadoDocumento = {
  emitido: { fondo: "#F0EDFF", icono: "#6652CE" },
  borrador: { fondo: "#F0F2F6", icono: "#6D7486" },
  enviado: { fondo: "#EDF3FF", icono: "#3568C8" },
  anulado: { fondo: "#FDEEF2", icono: "#B5485F" },
  // Extensiones coherentes para los estados de la app que no están en Figma.
  pagado: { fondo: "#E9F7F0", icono: "#167B65" },
  aceptado: { fondo: "#E9F7F0", icono: "#167B65" },
  vencido: { fondo: "#FDEEF2", icono: "#B5485F" },
  pendiente: { fondo: "#FFF8EA", icono: "#915B13" },
};

/** Gráficos de las tarjetas KPI del panel. */
export const grafico = {
  barra: "#5A4BE7",
  barraOpacidad: 0.55,
  barraActiva: 1,
  linea: {
    facturacion: "#5A4BE7",
    cobro: "#3568C8",
    riesgo: "#B5485F",
    campanas: "#167B65",
  },
  areaOpacidad: 0.07,
  trazo: 2.4,
  base: "#ECEEF4",
  tooltip: "#282A3D",
};

// Hoja imprimible (factura/presupuesto/albarán en A4): mismo criterio, paleta propia en grises neutros.
// No sigue el sistema de la interfaz: la impresión y los PDF no cambian.
export const documento = {
  texto: "#171717",
  "texto-suave": "#404040",
  tenue: "#525252",
  borde: "#D4D4D4",
  "borde-fuerte": "#A3A3A3",
  linea: "#E5E5E5",
  fondo: "#F5F5F5",
  acento: "#425D90",
  "sobre-acento": "#FFFFFF",
  sello: "#15803D",
  // Facturas insolutas en el estado de cuenta.
  insoluto: "#B91C1C",
  "insoluto-fondo": "#FEF2F2",
  papel: "#FFFFFF",
};

// Marcadores del mapa (el HTML de Leaflet no pasa por Tailwind). Mismos tonos que TONO_POR_ESTADO.
export const colorMapa = {
  estado: {
    pendiente: texto.aviso,
    instalado: texto.exito,
    verificado: texto.exito,
    incidencia: texto.peligro,
    retirado: icono.secundario,
  },
  defecto: fondo.marca,
  contorno: fondo.superficie,
  sombra: "rgb(32 36 53 / 0.45)",
};

export const colorMarca = fondo.marca;

type TamanoTexto = [string, { lineHeight: string; fontWeight?: string }];

/**
 * Escala tipográfica de Figma (Manrope, sin tracking). Las clases de Tailwind de siempre
 * (text-xs, text-sm…) toman las alturas de línea de Figma; las semánticas fijan además el peso.
 */
export const tamanoTexto: Record<string, TamanoTexto> = {
  // Genéricas (tamaño + interlineado de Figma)
  micro: ["0.6875rem", { lineHeight: "1rem" }], // 11/16
  xs: ["0.75rem", { lineHeight: "1.125rem" }], // 12/18
  meta: ["0.8125rem", { lineHeight: "1.25rem" }], // 13/20
  sm: ["0.875rem", { lineHeight: "1.375rem" }], // 14/22
  base: ["1rem", { lineHeight: "1.5rem" }], // 16/24
  lg: ["1.125rem", { lineHeight: "1.625rem" }], // 18/26
  xl: ["1.25rem", { lineHeight: "1.75rem" }], // 20/28
  "2xl": ["1.5rem", { lineHeight: "2rem" }], // 24/32
  "3xl": ["1.75rem", { lineHeight: "2.375rem" }], // 28/38
  // Semánticas (estilos de texto de Figma)
  "titulo-pagina": ["1.75rem", { lineHeight: "2.375rem", fontWeight: "700" }],
  kpi: ["1.75rem", { lineHeight: "2.375rem", fontWeight: "700" }],
  importe: ["1.25rem", { lineHeight: "1.75rem", fontWeight: "600" }],
  "titulo-panel": ["1.125rem", { lineHeight: "1.625rem", fontWeight: "700" }],
  "importe-fila": ["1.125rem", { lineHeight: "1.625rem", fontWeight: "600" }],
  destacado: ["1rem", { lineHeight: "1.5rem", fontWeight: "600" }],
  cuerpo: ["0.875rem", { lineHeight: "1.375rem", fontWeight: "400" }],
  monograma: ["0.875rem", { lineHeight: "1.25rem", fontWeight: "700" }],
  etiqueta: ["0.75rem", { lineHeight: "1.125rem", fontWeight: "600" }],
};

// Tokens de movimiento y micro-interacciones (solo propiedades aceleradas por GPU: transform y opacity).
// En @media (prefers-reduced-motion: reduce) las variables CSS se reducen a 0.01ms en globals.css.
export const movimiento = {
  duracion: {
    rapida: "var(--motion-duration-fast, 150ms)",
    media: "var(--motion-duration-base, 200ms)",
    lenta: "var(--motion-duration-slow, 250ms)",
    pulso: "var(--motion-duration-pulse, 1800ms)",
  },
  curva: {
    suave: "var(--motion-ease-standard, cubic-bezier(0.4, 0, 0.2, 1))",
    salida: "var(--motion-ease-out, cubic-bezier(0.16, 1, 0.3, 1))",
  },
  escala: {
    press: "var(--motion-scale-press, 0.98)",
  },
};
