import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Icono } from "@/components/ui/iconos";
import { FormularioCliente } from "../../formulario-cliente";
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
    <div className="flex max-w-3xl flex-col gap-esp5">
      <div className="flex flex-col gap-esp2">
        <Link
          href={`/admin/clientes/${clienteId}`}
          className="flex w-fit items-center gap-esp1 text-sm text-texto-secundario hover:text-texto-primario"
        >
          <Icono nombre="atras" size={16} />
          {cliente.razon_social}
        </Link>
        <h1 className="text-2xl font-semibold text-texto-primario">Editar cliente</h1>
        <p className="text-sm text-texto-secundario">
          Los cambios no afectan a los documentos ya emitidos: guardan los datos del cliente tal como estaban.
        </p>
      </div>
      <FormularioCliente inicial={cliente} {...opciones} />
    </div>
  );
}
