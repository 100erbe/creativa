import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { FormularioGasto } from "@/components/gastos/formulario-gasto";
import { cargarOpcionesGasto, hoyEnEspana } from "@/app/(admin)/admin/gastos/opciones";

export const dynamic = "force-dynamic";

export default async function PaginaEditarGastoEmpleado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await obtenerUsuarioActual();
  const supabase = await createClient();
  const [{ data: gasto }, { categorias }] = await Promise.all([
    supabase.from("gastos").select("*").eq("id", Number(id)).eq("usuario_id", usuario?.id ?? "").maybeSingle(),
    cargarOpcionesGasto(supabase),
  ]);
  if (!gasto || (gasto.estado !== "pendiente" && gasto.estado !== "rechazado")) notFound();

  return (
    <div className="flex flex-col gap-esp4 px-esp4 pt-esp5">
      <h1 className="text-xl font-semibold text-texto-primario">Corregir gasto</h1>
      {gasto.estado === "rechazado" && gasto.motivo_rechazo && (
        <p className="rounded-md border border-borde-peligro-sutil bg-fondo-peligro-sutil px-esp4 py-esp3 text-sm text-texto-peligro">
          Rechazado: {gasto.motivo_rechazo}
        </p>
      )}
      <FormularioGasto
        tipoFijo={gasto.tipo}
        inicial={gasto}
        hoy={hoyEnEspana()}
        categorias={categorias}
        responsables={[]}
        usuarioId={usuario?.id ?? ""}
        esAdmin={false}
        cancelarHref="/app/gastos"
      />
    </div>
  );
}
