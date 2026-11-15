import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Dialogos } from "@/components/ui/dialogos";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
  themeColor: "#C2410C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body>
        {children}
        <Dialogos />
      </body>
    </html>
  );
}
