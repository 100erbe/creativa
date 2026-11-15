import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { Icono } from "@/components/ui/iconos";
import { FormularioCampana } from "./formulario-campana";

export const dynamic = "force-dynamic";

export default async function PaginaNuevaCampana({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { cliente } = await searchParams;
  const supabase = await createClient();

  const resultado = await supabase
    .from("clientes")
    .select("id, razon_social, nombre_comercial")
    .eq("activo", true)
    .order("razon_social");
  lanzarSiError(resultado);

  return (
    <div className="flex max-w-2xl flex-col gap-esp5">
      <div className="flex flex-col gap-esp2">
        <Link
          href="/admin/campanas"
          className="flex w-fit items-center gap-esp1 text-sm text-texto-secundario hover:text-texto-primario"
        >
          <Icono nombre="atras" size={16} />
          Campañas
        </Link>
        <h1 className="text-2xl font-semibold text-texto-primario">Nueva campaña</h1>
        <p className="text-sm text-texto-secundario">
          Crea la campaña y luego marca sus puntos en el mapa. Puedes vincularla a un documento más adelante, o no
          vincularla nunca.
        </p>
      </div>
      <FormularioCampana clientes={resultado.data ?? []} clienteInicialId={Number(cliente) || undefined} />
    </div>
  );
}
