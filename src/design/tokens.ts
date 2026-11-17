// ÚNICA fuente de verdad de los colores del sistema de diseño (espejo de las variables de Figma,
// archivo "Creativa", página "Sistema"). Lo consumen tailwind.config.ts, el mapa (Leaflet),
// el viewport (themeColor) y la hoja imprimible. No escribas hexadecimales en ningún otro sitio.
// Todos los pares texto/fondo usados cumplen WCAG 2.2 AA (4,5:1 texto, 3:1 componentes de interfaz):
// se comprueba con `npm run contraste`.

export const primitivas = {
  naranja: {
    50: "#FFF4ED", 100: "#FFE6D5", 200: "#FECCAA", 300: "#FDAC74",
    400: "#FB8A3C", 500: "#F97316", 600: "#EA580C", 700: "#C2410C",
    800: "#9A3412", 900: "#7C2D12",
  },
  piedra: {
    0: "#FFFFFF", 50: "#FAFAF9", 100: "#F5F5F4", 200: "#E7E5E4",
    300: "#D6D3D1", 400: "#A8A29E", 500: "#78716C", 600: "#57534E",
    700: "#44403C", 800: "#292524", 900: "#1C1917",
  },
};

export const fondo = {
  lienzo: "#FAFAF9", superficie: "#FFFFFF", elevado: "#FFFFFF", sutil: "#F5F5F4",
  hover: "#E7E5E4", marca: "#C2410C", "marca-hover": "#9A3412",
  "marca-sutil": "#FFF4ED", inverso: "#1C1917",
  "exito-sutil": "#F0FDF4", "aviso-sutil": "#FFFBEB",
  "peligro-sutil": "#FEF2F2", "info-sutil": "#EFF6FF",
  "critico-sutil": "#FFF1F2",
  peligro: "#DC2626", "peligro-hover": "#B91C1C",
  critico: "#9F1239", "critico-hover": "#881337",
  // Capas semitransparentes (fondo de diálogos/menús y etiquetas sobre fotos)
  velo: "rgb(28 25 23 / 0.4)",
  "velo-fuerte": "rgb(28 25 23 / 0.7)",
};

export const texto = {
  primario: "#1C1917", secundario: "#57534E",
  // Antes #78716C (4,40:1 sobre fondo-sutil: no pasaba AA). Ahora ≥ 4,9:1 sobre todos los fondos.
  terciario: "#66605B",
  "sobre-marca": "#FFFFFF", marca: "#C2410C", inverso: "#FFFFFF",
  exito: "#15803D", aviso: "#B45309", peligro: "#B91C1C", critico: "#881337", info: "#1D4ED8",
};

export const borde = {
  // Decorativos (separadores, tarjetas): no requieren contraste.
  default: "#E7E5E4", sutil: "#F5F5F4", fuerte: "#D6D3D1",
  // Límite de un control (input, select, botón secundario): WCAG 1.4.11 exige 3:1.
  campo: "#78716C",
  foco: "#EA580C",
  peligro: "#DC2626", critico: "#BE123C", exito: "#BBF7D0", aviso: "#FDE68A",
  "peligro-sutil": "#FECACA", "critico-sutil": "#FECDD3", info: "#BFDBFE", marca: "#FECCAA",
};

export const icono = {
  default: "#44403C", secundario: "#78716C", marca: "#C2410C", "sobre-marca": "#FFFFFF",
};

// Hoja imprimible (factura/presupuesto/albarán en A4): mismo criterio, paleta propia en grises neutros.
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
  sombra: "rgb(28 25 23 / 0.45)",
};

export const colorMarca = fondo.marca;

export const tamanoTexto = {
  // Mínimo legible para etiquetas auxiliares (antes 10 px y 11 px sueltos).
  micro: ["0.6875rem", { lineHeight: "1rem" }] as [string, { lineHeight: string }],
};
