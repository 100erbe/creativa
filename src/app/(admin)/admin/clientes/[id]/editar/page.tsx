import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Icono } from "@/components/ui/iconos";
import { FormularioCliente } from "../../formulario-cliente";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { cargarOpciones } from "../../opciones";

export const dynamic = "force-dynamic";

export default async function PaginaEditarCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clienteId = Number(id);
  if (!Number.isInteger(clienteId)) notFound();

  const supabase = await createClient();
  const [{ data: cliente }, opciones] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle(),
    cargarOpciones(supabase),
  ]);
  if (!cliente) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-esp5">
      <CabeceraPagina
        antes={
          <Link
            href={`/admin/clientes/${clienteId}`}
            className="hidden w-fit items-center gap-esp1 text-sm text-texto-secundario hover:text-texto-primario md:flex"
          >
            <Icono nombre="atras" size={16} />
            {cliente.razon_social}
          </Link>
        }
        titulo="Editar cliente"
        subtitulo={
          <>
            Los cambios no afectan a los documentos ya emitidos: guardan los datos del cliente tal como estaban.
          </>
        }
      />
      <FormularioCliente inicial={cliente} {...opciones} />
    </div>
  );
}
