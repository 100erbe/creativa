import type { Config } from "tailwindcss";
import { primitivas, fondo, texto, borde, icono, documento, tamanoTexto } from "./src/design/tokens";

// Los colores viven en src/design/tokens.ts (espejo de las variables de Figma).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ...primitivas, // poco uso directo; preferir los semánticos
        fondo, texto, borde, icono, documento,
      },
      fontSize: tamanoTexto,
      spacing: {
        esp0: "0px", esp1: "4px", esp2: "8px", esp3: "12px", esp4: "16px",
        esp5: "20px", esp6: "24px", esp8: "32px", esp10: "40px", esp12: "48px",
      },
      borderRadius: {
        sm: "4px", md: "8px", lg: "12px", xl: "16px", completo: "9999px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(28 25 23 / 0.06)",
        md: "0 4px 12px -2px rgb(28 25 23 / 0.08), 0 2px 4px -1px rgb(28 25 23 / 0.04)",
        lg: "0 12px 32px -4px rgb(28 25 23 / 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
