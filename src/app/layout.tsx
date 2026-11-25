import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { colorMarca } from "@/design/tokens";
import { Dialogos } from "@/components/ui/dialogos";
import { RecordarListas } from "@/components/shared/recordar-listas";

// Tipografía del sistema "Documentos" de Figma (pesos 400, 500, 600 y 700).
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Creativa",
  description: "Gestión de campañas de street marketing",
  manifest: "/manifest.json",
  // iPhone: al añadirla a la pantalla de inicio se abre como app (requisito para recibir avisos push).
  appleWebApp: { capable: true, title: "Creativa", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: colorMarca,
  width: "device-width",
  initialScale: 1,
  // Ocupa toda la pantalla (muesca e indicador de inicio incluidos); cabeceras, cajones y hojas
  // inferiores dejan el margen con env(safe-area-inset-*). Necesario también para la app nativa.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={manrope.variable}>
      <body>
        {children}
        <Dialogos />
        <RecordarListas />
      </body>
    </html>
  );
}
