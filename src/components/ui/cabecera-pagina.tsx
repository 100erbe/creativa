import { contarNoLeidos } from "@/lib/push/bandeja";
import { CabeceraPaginaBase, type PropsCabeceraPagina } from "@/components/ui/cabecera-pagina-base";

/**
 * Cabecera de página (componente de servidor): igual que CabeceraPaginaBase, pero si no se da
 * `noLeidos` consulta aquí los avisos sin leer. En componentes de cliente, usar CabeceraPaginaBase.
 */
export async function CabeceraPagina(props: PropsCabeceraPagina) {
  const conAvisos = props.conAvisos ?? true;
  const noLeidos = conAvisos ? (props.noLeidos ?? (await contarNoLeidos())) : 0;
  return <CabeceraPaginaBase {...props} noLeidos={noLeidos} />;
}
