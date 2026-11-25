import { Icono } from "@/components/ui/iconos";
import { EnlaceLista } from "@/components/ui/enlace-lista";

/**
 * Enlace «← Listado» de las fichas de detalle (solo escritorio: en el móvil la cabecera móvil ya
 * tiene su botón de volver). Conserva los filtros con los que se dejó el listado.
 */
export function EnlaceVolver({ href, etiqueta }: { href: string; etiqueta: string }) {
  return (
    <EnlaceLista
      href={href}
      className="group hidden w-fit items-center gap-esp1 text-sm text-texto-secundario transition-colors duration-rapida ease-suave hover:text-texto-primario md:flex"
    >
      <Icono
        nombre="atras"
        size={16}
        className="transition-transform duration-rapida ease-salida group-hover:-translate-x-0.5"
      />
      {etiqueta}
    </EnlaceLista>
  );
}

/**
 * Estructura común de las fichas de detalle (cliente, documento, campaña…):
 * enlace de vuelta al listado + cabecera arriba, y el contenido debajo.
 */
export function DetailLayout({
  volver,
  cabecera,
  children,
  className = "flex flex-col gap-esp6",
  claseCabecera = "flex flex-col gap-esp3",
}: {
  volver?: { href: string; etiqueta: string };
  cabecera?: React.ReactNode;
  children: React.ReactNode;
  /** Clases del contenedor (por defecto columna con separación de 24 px). */
  className?: string;
  /** Clases del bloque superior (enlace de vuelta + cabecera). */
  claseCabecera?: string;
}) {
  return (
    <div className={className}>
      {(volver || cabecera) && (
        <div className={claseCabecera}>
          {volver && <EnlaceVolver {...volver} />}
          {cabecera}
        </div>
      )}
      {children}
    </div>
  );
}
