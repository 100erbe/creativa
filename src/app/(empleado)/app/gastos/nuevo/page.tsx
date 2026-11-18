import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { BotonVolver } from "@/components/ui/boton-volver";
import { FormularioGasto } from "@/components/gastos/formulario-gasto";
import { cargarOpcionesGasto, hoyEnEspana } from "@/app/(admin)/admin/gastos/opciones";

export const dynamic = "force-dynamic";

export default async function PaginaNuevoGastoEmpleado() {
  const usuario = await obtenerUsuarioActual();
  const supabase = await createClient();
  const { categorias } = await cargarOpcionesGasto(supabase);

  return (
    <div className="flex flex-col gap-esp4 px-esp4 pt-esp5">
      <div className="flex flex-col gap-esp2">
        <BotonVolver href="/app/gastos" etiqueta="Gastos" />
        <div>
          <h1 className="text-2xl font-bold text-texto-primario">Añadir gasto menor</h1>
          <p className="text-sm text-texto-secundario">
            Haz una foto del ticket y envíalo: la administración lo revisará y te avisará.
          </p>
        </div>
      </div>
      <FormularioGasto
        tipoFijo="menor"
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
