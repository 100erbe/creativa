import type { Config } from "tailwindcss";
import { primitivas, fondo, texto, borde, icono, documento, tamanoTexto, movimiento } from "./src/design/tokens";

// Los colores viven en src/design/tokens.ts (espejo de las variables de Figma).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ...primitivas, // poco uso directo; preferir los semánticos
        fondo, texto, borde, border: borde.default, icono, documento,
      },
      fontSize: tamanoTexto,
      spacing: {
        esp0: "0px", esp1: "4px", esp2: "8px", esp3: "12px", esp4: "16px",
        esp5: "20px", esp6: "24px", esp8: "32px", esp10: "40px", esp12: "48px",
      },
      borderRadius: {
        sm: "4px", md: "8px", lg: "12px", xl: "16px", "2xl": "20px", "3xl": "24px", completo: "9999px",
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // Las tarjetas no llevan sombra en el sistema "Documentos": solo borde 1px.
        xs: "none",
        // Sombras solo para lo que flota (menús, diálogos, botones sobre mapas), sobre la tinta.
        sm: "0 1px 2px 0 rgb(32 36 53 / 0.06)",
        md: "0 4px 12px -2px rgb(32 36 53 / 0.08), 0 2px 4px -1px rgb(32 36 53 / 0.04)",
        lg: "0 12px 32px -4px rgb(32 36 53 / 0.12)",
        elevado: "0 8px 24px -4px rgb(32 36 53 / 0.10), 0 2px 6px -1px rgb(32 36 53 / 0.05)",
      },
      transitionDuration: {
        DEFAULT: movimiento.duracion.rapida,
        rapida: movimiento.duracion.rapida,
        media: movimiento.duracion.media,
        lenta: movimiento.duracion.lenta,
        pulso: movimiento.duracion.pulso,
      },
      transitionTimingFunction: {
        DEFAULT: movimiento.curva.suave,
        suave: movimiento.curva.suave,
        salida: movimiento.curva.salida,
      },
      // Barras del gráfico KPI en reposo (Figma: 55 %).
      opacity: { 55: "0.55" },
      scale: {
        press: movimiento.escala.press,
      },
      keyframes: {
        "velo-entrar": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "modal-entrar": {
          from: { opacity: "0", transform: "translate3d(0, 6px, 0) scale(0.98)" },
          to: { opacity: "1", transform: "translate3d(0, 0, 0) scale(1)" },
        },
        "hoja-subir": {
          from: { opacity: "0", transform: "translate3d(0, 16px, 0)" },
          to: { opacity: "1", transform: "translate3d(0, 0, 0)" },
        },
        "cajon-entrar": {
          from: { transform: "translate3d(100%, 0, 0)" },
          to: { transform: "translate3d(0, 0, 0)" },
        },
        "estado-entrar": {
          from: { opacity: "0", transform: "translate3d(0, 4px, 0)" },
          to: { opacity: "1", transform: "translate3d(0, 0, 0)" },
        },
      },
      animation: {
        pulse: `pulse ${movimiento.duracion.pulso} ${movimiento.curva.suave} infinite`,
        "velo-entrar": `velo-entrar ${movimiento.duracion.media} ${movimiento.curva.salida} both`,
        "modal-entrar": `modal-entrar ${movimiento.duracion.media} ${movimiento.curva.salida} both`,
        "hoja-subir": `hoja-subir ${movimiento.duracion.lenta} ${movimiento.curva.salida} both`,
        "cajon-entrar": `cajon-entrar ${movimiento.duracion.lenta} ${movimiento.curva.salida} both`,
        "estado-entrar": `estado-entrar ${movimiento.duracion.rapida} ${movimiento.curva.salida} both`,
      },
    },
  },
  plugins: [],
};

export default config;
