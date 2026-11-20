import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { Icono } from "@/components/ui/iconos";
import { FormularioGasto } from "@/components/gastos/formulario-gasto";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { cargarOpcionesGasto, hoyEnEspana } from "../../opciones";

export const dynamic = "force-dynamic";

export default async function PaginaEditarGasto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await exigirAdmin();
  const supabase = await createClient();
  const [{ data: gasto }, opciones] = await Promise.all([
    supabase.from("gastos").select("*").eq("id", Number(id)).maybeSingle(),
    cargarOpcionesGasto(supabase),
  ]);
  if (!gasto) notFound();

  return (
    <div className="flex max-w-3xl flex-col gap-esp5">
      <CabeceraPagina
        antes={
          <Link
            href={`/admin/gastos/${gasto.id}`}
            className="hidden w-fit items-center gap-esp1 text-sm text-texto-secundario hover:text-texto-primario md:flex"
          >
            <Icono nombre="atras" size={16} />
            {gasto.codigo}
          </Link>
        }
        titulo="Editar gasto"
      />
      <FormularioGasto
        inicial={gasto}
        hoy={hoyEnEspana()}
        usuarioId={usuario.id}
        esAdmin
        cancelarHref={`/admin/gastos/${gasto.id}`}
        {...opciones}
      />
    </div>
  );
}
