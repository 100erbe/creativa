import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { Icono } from "@/components/ui/iconos";
import { FormularioGasto } from "@/components/gastos/formulario-gasto";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { leerLecturaTicket } from "@/lib/datos-ticket";
import { TIPOS_IVA } from "@/lib/gastos";
import { cargarOpcionesGasto, hoyEnEspana } from "../../opciones";

export const dynamic = "force-dynamic";

export default async function PaginaEditarGasto({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ desde_ticket?: string }>;
}) {
  const { id } = await params;
  const { desde_ticket } = await searchParams;
  const usuario = await exigirAdmin();
  const supabase = await createClient();
  const [{ data: gasto }, opciones] = await Promise.all([
    supabase.from("gastos").select("*").eq("id", Number(id)).maybeSingle(),
    cargarOpcionesGasto(supabase),
  ]);
  if (!gasto) notFound();

  // "Convertir en deducible" desde la lectura del ticket: el formulario llega ya con los datos fiscales leídos.
  const lectura = desde_ticket ? leerLecturaTicket(gasto.datos_ticket) : null;
  const inicial = lectura
    ? {
        ...gasto,
        tipo: "deducible" as const,
        proveedor: gasto.proveedor ?? lectura.proveedor,
        nif_proveedor: gasto.nif_proveedor ?? lectura.nif_proveedor,
        numero_factura: gasto.numero_factura ?? lectura.numero_factura,
        iva_pct:
          gasto.iva_pct ?? (lectura.iva_pct != null && (TIPOS_IVA as readonly number[]).includes(lectura.iva_pct) ? lectura.iva_pct : null),
      }
    : gasto;

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
        titulo={lectura ? "Convertir en gasto deducible" : "Editar gasto"}
        subtitulo={lectura ? "Datos fiscales leídos del ticket: compruébalos y guarda." : undefined}
      />
      <FormularioGasto
        inicial={inicial}
        hoy={hoyEnEspana()}
        usuarioId={usuario.id}
        esAdmin
        cancelarHref={`/admin/gastos/${gasto.id}`}
        {...opciones}
      />
    </div>
  );
}
