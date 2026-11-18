import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Icono } from "@/components/ui/iconos";
import { FormularioCliente } from "../formulario-cliente";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { cargarOpciones } from "../opciones";

export const dynamic = "force-dynamic";

export default async function PaginaNuevoCliente() {
  const supabase = await createClient();
  const opciones = await cargarOpciones(supabase);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-esp5">
      <CabeceraPagina
        antes={
          <Link
            href="/admin/clientes"
            className="flex w-fit items-center gap-esp1 text-sm text-texto-secundario hover:text-texto-primario"
          >
            <Icono nombre="atras" size={16} />
            Clientes
          </Link>
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
