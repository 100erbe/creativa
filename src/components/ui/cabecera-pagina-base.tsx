import { Campana } from "@/components/avisos/campana";
import { cn } from "@/lib/cn";

export type PropsCabeceraPagina = {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  /** Botones o enlaces de la página (la acción principal, la última). */
  acciones?: React.ReactNode;
  /** Avisos sin leer (en CabeceraPagina, si no se da, se consultan en el servidor). */
  noLeidos?: number;
  conAvisos?: boolean;
  /** Contenido sobre el título (p. ej. un enlace «Volver»). */
  antes?: React.ReactNode;
  className?: string;
};

// Cabecera de página del sistema "Documentos" ("Navigation / Dashboard header" de Figma):
// título 28/38 negrita + subtítulo 14/22 a la izquierda; a la derecha el botón «Avisos» (con contador
// de no leídos) y las acciones de la página. En móvil el botón Avisos no se pinta: la campana ya está
// en la cabecera móvil de la barra lateral.
// Esta versión no consulta nada: sirve también dentro de componentes de cliente (con `noLeidos` dado).
export function CabeceraPaginaBase({
  titulo,
  subtitulo,
  acciones,
  noLeidos = 0,
  conAvisos = true,
  antes,
  className,
}: PropsCabeceraPagina) {
  return (
    <header className={cn("flex flex-col gap-esp2", className)}>
      {antes}
      <div className="flex flex-wrap items-center gap-esp3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-texto-primario md:text-titulo-pagina">{titulo}</h1>
          {subtitulo && <p className="mt-esp1 text-pretty text-cuerpo text-texto-secundario">{subtitulo}</p>}
        </div>
        {(conAvisos || acciones) && (
          <div className="flex shrink-0 flex-wrap items-center gap-esp3">
            {conAvisos && (
              <Campana
                conEtiqueta
                href="/admin/avisos"
                etiquetaEnlace="Ver todos los avisos"
                noLeidos={noLeidos}
                className="hidden md:flex"
              />
            )}
            {acciones}
          </div>
        )}
      </div>
    </header>
  );
}
