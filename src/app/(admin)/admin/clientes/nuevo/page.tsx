import { createClient } from "@/lib/supabase/server";
import { FormularioCliente } from "../formulario-cliente";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { cargarOpciones } from "../opciones";
import { EnlaceVolver } from "@/components/shared/detail-layout";

export const dynamic = "force-dynamic";

export default async function PaginaNuevoCliente() {
  const supabase = await createClient();
  const opciones = await cargarOpciones(supabase);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-esp5">
      <CabeceraPagina
        antes={
          <EnlaceVolver href="/admin/clientes" etiqueta="Clientes" />
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
