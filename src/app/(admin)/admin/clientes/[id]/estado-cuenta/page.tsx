import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Icono } from "@/components/ui/iconos";
import { HojaEstadoCuenta } from "@/components/admin/hoja-estado-cuenta";
import { cargarEstadoCuenta, nombreArchivoEstadoCuenta } from "@/lib/estado-cuenta-datos";
import { DIAS_PARA_INSOLUTA, hoyEnEspana } from "@/lib/estado-cuenta";
import { BotonImprimir } from "@/app/(admin)/admin/documentos/[id]/imprimir/boton-imprimir";

export const dynamic = "force-dynamic";

/** El título es el nombre que propone el navegador al «Guardar como PDF». */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const clienteId = Number((await params).id);
  if (!Number.isInteger(clienteId)) return { title: "Estado de cuenta" };
  const supabase = await createClient();
  const { data } = await supabase.from("clientes").select("razon_social").eq("id", clienteId).maybeSingle();
  return { title: data ? nombreArchivoEstadoCuenta(data.razon_social, hoyEnEspana()) : "Estado de cuenta" };
}

export default async function PaginaEstadoCuenta({ params }: { params: Promise<{ id: string }> }) {
  const clienteId = Number((await params).id);
  if (!Number.isInteger(clienteId)) notFound();

  const supabase = await createClient();
  const datos = await cargarEstadoCuenta(supabase, clienteId);
  if (!datos) notFound();
  const centimos = datos.estado.lineas.filter((l) => l.centimosIgnorados > 0).length;

  return (
    <div className="flex flex-col gap-esp4">
      <div className="flex flex-wrap items-center gap-esp3 print:hidden">
        <Link
          href={`/admin/clientes/${clienteId}`}
          className="flex items-center gap-esp1 text-sm text-texto-secundario hover:text-texto-primario"
        >
          <Icono nombre="atras" size={16} />
          Volver al cliente
        </Link>
        <p className="flex-1 text-xs text-texto-terciario">
          Insolutas: facturas sin cobrar con más de {DIAS_PARA_INSOLUTA} días desde su emisión.
          {centimos > 0 &&
            ` ${centimos} factura${centimos === 1 ? "" : "s"} con una diferencia de céntimos (menos de 1 €) se da${centimos === 1 ? "" : "n"} por cobrada${centimos === 1 ? "" : "s"}.`}
        </p>
        <BotonImprimir />
      </div>

      <div className="overflow-x-auto pb-esp4 print:overflow-visible print:p-0">
        <HojaEstadoCuenta d={datos} />
      </div>
    </div>
  );
}
