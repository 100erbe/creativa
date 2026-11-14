import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Icono } from "@/components/ui/iconos";
import { euros, fechaMedia } from "@/lib/formato";
import { ETIQUETA_TIPO } from "@/lib/documentos";
import { componerDireccion } from "@/lib/direccion";
import { BotonImprimir } from "./boton-imprimir";

export const dynamic = "force-dynamic";

const UNIDAD: Record<string, string> = {
  ud: "ud",
  m2: "m²",
  ml: "ml",
  millar: "millar",
  mes: "mes",
  servicio: "serv.",
  km: "km",
};

const redondear = (n: number) => Math.round(n * 100) / 100;

/** El título de la pestaña es el nombre que propone el navegador al "Guardar como PDF". */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const documentoId = Number(id);
  if (!Number.isInteger(documentoId)) return { title: "Documento" };

  const supabase = await createClient();
  const { data } = await supabase
    .from("documentos")
    .select("tipo, numero_completo")
    .eq("id", documentoId)
    .maybeSingle();
  if (!data) return { title: "Documento" };

  const numero = (data.numero_completo ?? "borrador").replace(/[\\/]/g, "-");
  return { title: `${ETIQUETA_TIPO[data.tipo] ?? "Documento"} ${numero}` };
}

export default async function PaginaImprimirDocumento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const documentoId = Number(id);
  if (!Number.isInteger(documentoId)) notFound();

  const supabase = await createClient();

  const [{ data: doc }, { data: lineas }, { data: empresa }] = await Promise.all([
    supabase
      .from("documentos")
      .select("*, clientes(razon_social, numero_documento, direccion, codigo_postal, municipio, provincia)")
      .eq("id", documentoId)
      .maybeSingle(),
    supabase
      .from("lineas_documento")
      .select("id, descripcion, piezas, unidad, precio_unitario, descuento_pct, iva_pct, importe")
      .eq("documento_id", documentoId)
      .order("orden"),
    supabase.from("empresa").select("*").limit(1).maybeSingle(),
  ]);
  if (!doc) notFound();

  const origen = doc.documento_origen_id
    ? (
        await supabase
          .from("documentos")
          .select("numero_completo, fecha")
          .eq("id", doc.documento_origen_id)
          .maybeSingle()
      ).data
    : null;

  const esBorrador = doc.estado === "borrador";
  const cliente = Array.isArray(doc.clientes) ? doc.clientes[0] : doc.clientes;
  // Un documento emitido lleva los datos del cliente congelados; un borrador, los de la ficha.
  const razonSocial = doc.cliente_razon_social ?? cliente?.razon_social ?? "";
  const nif = doc.cliente_documento ?? cliente?.numero_documento;
  const direccionCliente = componerDireccion({
    direccion: doc.cliente_direccion ?? cliente?.direccion,
    codigoPostal: doc.cliente_cp ?? cliente?.codigo_postal,
    municipio: doc.cliente_municipio ?? cliente?.municipio,
    provincia: doc.cliente_provincia ?? cliente?.provincia,
  });

  const filasLineas = lineas ?? [];
  const sinIva = doc.regimen_iva === "exento" || doc.regimen_iva === "intracomunitario";
  const descuentoGlobal = Number(doc.descuento_global_pct) / 100;

  // Desglose por tipo de IVA (mismo criterio que la vista v_resumen_iva_trimestral).
  const porTipo = new Map<number, number>();
  for (const l of filasLineas) {
    const tipo = Number(l.iva_pct);
    porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + Number(l.importe) * (1 - descuentoGlobal));
  }
  const desglose = [...porTipo.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tipo, base]) => ({ tipo, base: redondear(base), cuota: sinIva ? 0 : redondear((base * tipo) / 100) }));

  const etiquetaTipo = (ETIQUETA_TIPO[doc.tipo] ?? doc.tipo).toUpperCase();
  const mismaOperacion = !doc.fecha_operacion || doc.fecha_operacion === doc.fecha;
  const direccionEmpresa = empresa
    ? [empresa.direccion, [empresa.codigo_postal, empresa.municipio].filter(Boolean).join(" "), empresa.provincia]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <div className="flex flex-col gap-esp4">
      {/* Tamaño de página y márgenes al imprimir. */}
      <style>{`@page { size: A4; margin: 12mm; } @media print { body { background: #fff !important; } }`}</style>

      <div className="flex flex-wrap items-center gap-esp3 print:hidden">
        <Link
          href={`/admin/documentos/${documentoId}`}
          className="flex items-center gap-esp1 text-sm text-texto-secundario hover:text-texto-primario"
        >
          <Icono nombre="atras" size={16} />
          Volver al documento
        </Link>
        <p className="flex-1 text-xs text-texto-terciario">
          En el diálogo de impresión elige «Guardar como PDF» como destino.
        </p>
        <BotonImprimir />
      </div>

      <article className="mx-auto w-full max-w-[210mm] bg-white p-6 text-[13px] leading-snug text-neutral-900 shadow-sm ring-1 ring-black/10 md:p-10 print:max-w-none print:p-0 print:shadow-none print:ring-0">
        {esBorrador && (
          <p className="mb-4 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-center text-xs font-semibold tracking-wide text-amber-800 [print-color-adjust:exact]">
            BORRADOR · documento sin número ni validez hasta que se emita
          </p>
        )}

        <header className="flex flex-col gap-4 border-b border-neutral-300 pb-4 sm:flex-row sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <p className="text-lg font-bold">{empresa?.nombre_comercial ?? "—"}</p>
            {empresa?.razon_social && <p>{empresa.razon_social}</p>}
            {empresa?.nif && <p>NIF {empresa.nif}</p>}
            {direccionEmpresa && <p>{direccionEmpresa}</p>}
            <p>{[empresa?.telefono, empresa?.movil].filter(Boolean).join(" · ")}</p>
            {empresa?.email && <p>{empresa.email}</p>}
          </div>
          <div className="flex flex-col gap-0.5 sm:items-end sm:text-right">
            <p className="text-xl font-bold tracking-wide">{etiquetaTipo}</p>
            <p className="text-base font-semibold">{doc.numero_completo ?? "Sin número"}</p>
            <p>Fecha: {fechaMedia(doc.fecha)}</p>
            {!mismaOperacion && doc.fecha_operacion && <p>Fecha de la operación: {fechaMedia(doc.fecha_operacion)}</p>}
            {doc.fecha_vencimiento && !esBorrador && doc.tipo === "factura" && (
              <p>Vencimiento: {fechaMedia(doc.fecha_vencimiento)}</p>
            )}
            {doc.valido_hasta && <p>Válido hasta: {fechaMedia(doc.valido_hasta)}</p>}
          </div>
        </header>

        <section className="grid gap-4 py-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Cliente</p>
            <p className="font-semibold">{razonSocial || "—"}</p>
            {nif && <p>{nif}</p>}
            {direccionCliente && <p>{direccionCliente}</p>}
          </div>
          {(doc.campana || doc.descripcion || origen) && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Referencia</p>
              {doc.campana && <p>Campaña: {doc.campana}</p>}
              {doc.descripcion && <p>{doc.descripcion}</p>}
              {doc.tipo === "rectificativa" && origen && (
                <p>
                  Rectifica la factura {origen.numero_completo} ({fechaMedia(origen.fecha)})
                </p>
              )}
              {doc.motivo_rectificacion && <p>Motivo: {doc.motivo_rectificacion}</p>}
            </div>
          )}
        </section>

        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-neutral-400 text-[11px] uppercase tracking-wide text-neutral-600">
              <th className="py-1.5 pr-2 font-semibold">Concepto</th>
              <th className="px-2 py-1.5 text-right font-semibold">Cant.</th>
              <th className="px-2 py-1.5 text-right font-semibold">Precio</th>
              <th className="px-2 py-1.5 text-right font-semibold">Dto.</th>
              <th className="px-2 py-1.5 text-right font-semibold">IVA</th>
              <th className="py-1.5 pl-2 text-right font-semibold">Importe</th>
            </tr>
          </thead>
          <tbody>
            {filasLineas.map((l) => (
              <tr key={l.id} className="border-b border-neutral-200 align-top [break-inside:avoid]">
                <td className="py-1.5 pr-2">{l.descripcion}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right">
                  {Number(l.piezas)} {UNIDAD[l.unidad] ?? l.unidad}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right">{euros(Number(l.precio_unitario))}</td>
                <td className="px-2 py-1.5 text-right">
                  {Number(l.descuento_pct) > 0 ? `${Number(l.descuento_pct)} %` : "—"}
                </td>
                <td className="px-2 py-1.5 text-right">{sinIva ? "0 %" : `${Number(l.iva_pct)} %`}</td>
                <td className="whitespace-nowrap py-1.5 pl-2 text-right font-medium">{euros(Number(l.importe))}</td>
              </tr>
            ))}
            {filasLineas.length === 0 && (
              <tr>
                <td colSpan={6} className="py-3 text-neutral-500">
                  Este documento no tiene líneas.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <section className="mt-4 flex justify-end [break-inside:avoid]">
          <div className="flex w-full max-w-[300px] flex-col gap-1">
            <Fila etiqueta="Suma de líneas" valor={euros(Number(doc.suma_lineas))} />
            {Number(doc.importe_descuento) !== 0 && (
              <Fila
                etiqueta={`Descuento (${Number(doc.descuento_global_pct)} %)`}
                valor={euros(-Number(doc.importe_descuento))}
              />
            )}
            <Fila etiqueta="Base imponible" valor={euros(Number(doc.base_imponible))} />
            {desglose.map((d) => (
              <Fila
                key={d.tipo}
                etiqueta={sinIva ? "IVA 0 % (sin IVA)" : `IVA ${d.tipo} % sobre ${euros(d.base)}`}
                valor={euros(d.cuota)}
              />
            ))}
            {Number(doc.importe_retencion) !== 0 && (
              <Fila
                etiqueta={`Retención (${Number(doc.retencion_pct)} %)`}
                valor={euros(-Number(doc.importe_retencion))}
              />
            )}
            <div className="mt-1 flex items-center border-t-2 border-neutral-900 pt-1.5 text-base font-bold">
              <span className="flex-1">TOTAL</span>
              <span>{euros(Number(doc.total))}</span>
            </div>
          </div>
        </section>

        {(doc.motivo_exencion || doc.texto_forma_pago || doc.iban_cobro || doc.notas_cliente) && (
          <section className="mt-6 flex flex-col gap-1 border-t border-neutral-300 pt-3 text-xs [break-inside:avoid]">
            {doc.motivo_exencion && <p>{doc.motivo_exencion}</p>}
            {doc.texto_forma_pago && <p>Forma de pago: {doc.texto_forma_pago}</p>}
            {doc.iban_cobro && <p>IBAN: {doc.iban_cobro}</p>}
            {doc.notas_cliente && <p>{doc.notas_cliente}</p>}
          </section>
        )}

        {empresa?.lema && (
          <p className="mt-6 text-center text-[11px] text-neutral-500">{empresa.lema}</p>
        )}
      </article>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex">
      <span className="flex-1 text-neutral-600">{etiqueta}</span>
      <span>{valor}</span>
    </div>
  );
}
