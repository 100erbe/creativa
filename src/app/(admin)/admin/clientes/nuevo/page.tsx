import { createClient } from "@/lib/supabase/server";
import { Icono } from "@/components/ui/iconos";
import { FormularioCliente } from "../formulario-cliente";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { cargarOpciones } from "../opciones";
import { EnlaceLista } from "@/components/ui/enlace-lista";

export const dynamic = "force-dynamic";

export default async function PaginaNuevoCliente() {
  const supabase = await createClient();
  const opciones = await cargarOpciones(supabase);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-esp5">
      <CabeceraPagina
        antes={
          <EnlaceLista
            href="/admin/clientes"
            className="hidden w-fit items-center gap-esp1 text-sm text-texto-secundario hover:text-texto-primario md:flex"
          >
            <Icono nombre="atras" size={16} />
            Clientes
          </EnlaceLista>
        }
        titulo="Nuevo cliente"
        subtitulo={
          <>
            El código (CLI-0xx) se asigna automáticamente.
          </>
        }
      />
      <FormularioCliente {...opciones} />
    </div>
  );
}
