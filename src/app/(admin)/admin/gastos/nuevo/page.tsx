import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { FormularioGasto } from "@/components/gastos/formulario-gasto";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { cargarOpcionesGasto, hoyEnEspana } from "../opciones";
import { EnlaceVolver } from "@/components/shared/detail-layout";

export const dynamic = "force-dynamic";

export default async function PaginaNuevoGasto() {
  const usuario = await exigirAdmin();
  const supabase = await createClient();
  const opciones = await cargarOpcionesGasto(supabase);

  return (
    <div className="flex max-w-3xl flex-col gap-esp5">
      <CabeceraPagina
        antes={
          <EnlaceVolver href="/admin/gastos" etiqueta="Gastos" />
        }
        titulo="Nuevo gasto"
        subtitulo={
          <>
            Elige si es un gasto deducible (con factura e IVA) o un gasto menor sin IVA. El código (GAS-0001) se asigna solo.
          </>
        }
      />
      <FormularioGasto
        hoy={hoyEnEspana()}
        usuarioId={usuario.id}
        esAdmin
        cancelarHref="/admin/gastos"
        {...opciones}
      />
    </div>
  );
}
