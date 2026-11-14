import type { Config } from "tailwindcss";

// Estos colores y tamaños reproducen 1:1 las variables del sistema de diseño
// creado en Figma (archivo "Creativa", página "Sistema"). Si cambias un valor
// en Figma, cámbialo aquí también — ver supabase/../../docs si se automatiza
// con Code Connect en el futuro.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Primitivas (poco uso directo; preferir los semánticos de abajo)
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
        // Semánticos — usar estos en los componentes
        fondo: {
          lienzo: "#FAFAF9", superficie: "#FFFFFF", sutil: "#F5F5F4",
          hover: "#E7E5E4", marca: "#C2410C", "marca-hover": "#9A3412",
          "marca-sutil": "#FFF4ED", inverso: "#1C1917",
          "exito-sutil": "#F0FDF4", "aviso-sutil": "#FFFBEB",
          "peligro-sutil": "#FEF2F2", "info-sutil": "#EFF6FF",
          peligro: "#DC2626", "peligro-hover": "#B91C1C",
        },
        texto: {
          primario: "#1C1917", secundario: "#57534E", terciario: "#78716C",
          "sobre-marca": "#FFFFFF", marca: "#C2410C", inverso: "#FFFFFF",
          exito: "#15803D", aviso: "#B45309", peligro: "#B91C1C", info: "#1D4ED8",
        },
        borde: {
          default: "#E7E5E4", fuerte: "#D6D3D1", foco: "#EA580C",
          peligro: "#DC2626", exito: "#BBF7D0", aviso: "#FDE68A",
          "peligro-sutil": "#FECACA", info: "#BFDBFE", marca: "#FECCAA",
        },
        icono: {
          default: "#44403C", secundario: "#78716C", marca: "#C2410C",
          "sobre-marca": "#FFFFFF",
        },
      },
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
