import Link from "next/link";
import { Icono } from "@/components/ui/iconos";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";

const SECCIONES = [
  {
    href: "/admin/ajustes/empresa",
    titulo: "Datos de la empresa",
    texto: "Nombre, NIF, dirección y contacto que salen en las facturas y presupuestos. Días de validez de un presupuesto.",
    icono: "documentos",
  },
  {
    href: "/admin/ajustes/pagos",
    titulo: "Formas de pago y cuentas",
    texto: "Condiciones de pago que se ofrecen en los documentos y cuentas bancarias donde se cobra.",
    icono: "contabilidad",
  },
  {
    href: "/admin/ajustes/gmail",
    titulo: "Gmail",
    texto: "Conecta la cuenta de Gmail en la que se preparan los borradores para reclamar facturas impagadas.",
    icono: "enviar",
  },
  {
    href: "/admin/ajustes/equipo",
    titulo: "Equipo",
    texto: "Personas que usan la app: dar de alta instaladores, cambiar su rol o desactivar una cuenta.",
    icono: "clientes",
  },
  {
    href: "/admin/ajustes/avisos",
    titulo: "Avisos en este dispositivo",
    texto: "Activa las notificaciones en tu móvil u ordenador para enterarte de lo que pasa en el campo.",
    icono: "avisos",
  },
  {
    href: "/admin/catalogo",
    titulo: "Catálogo y precios",
    texto: "Productos, servicios, formatos, precios de fabricación e instalación e IVA.",
    icono: "catalogo",
  },
] as const;

export default async function PaginaAjustes() {
  return (
    <div className="flex flex-col gap-esp6">
      <CabeceraPagina
        titulo="Ajustes"
        subtitulo="Lo que antes solo se podía cambiar desde la base de datos."
      />
      <div className="grid grid-cols-1 gap-esp4 md:grid-cols-2">
        {SECCIONES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex items-start gap-esp4 rounded-xl border border-borde-default bg-fondo-superficie px-esp5 py-esp5 transition-[background-color,border-color,transform] duration-rapida ease-salida hover:-translate-y-[1px] hover:border-borde-campo hover:bg-fondo-sutil/70 active:scale-press"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fondo-marca-sutil">
              <Icono nombre={s.icono} size={20} className="text-icono-marca" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-titulo-panel text-texto-primario">{s.titulo}</h2>
              <p className="text-sm text-texto-secundario">{s.texto}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
