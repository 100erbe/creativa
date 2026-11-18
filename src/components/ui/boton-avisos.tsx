import { Campana } from "@/components/avisos/campana";
import { contarNoLeidos } from "@/lib/push/bandeja";

/**
 * Botón «Avisos» de la cabecera (componente de servidor) para las fichas que tienen una cabecera propia
 * en vez de CabeceraPagina (documento, cliente, campaña). Solo en escritorio: en móvil está la campana
 * de la cabecera de la barra lateral.
 */
export async function BotonAvisos({ className }: { className?: string }) {
  const noLeidos = await contarNoLeidos();
  return (
    <Campana
      conEtiqueta
      href="/admin/avisos"
      etiquetaEnlace="Ver todos los avisos"
      noLeidos={noLeidos}
      className={className ?? "hidden md:flex"}
    />
  );
}
