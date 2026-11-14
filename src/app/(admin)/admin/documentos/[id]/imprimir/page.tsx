import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Icono } from "@/components/ui/iconos";
import { HojaDocumento, type DatosHoja } from "@/components/admin/hoja-documento";
import { componerDireccion } from "@/lib/direccion";
import { etiquetaDocumentoIdentidad, nombreArchivo } from "@/lib/documento-impresion";
import { BotonImprimir } from "./boton-imprimir";

export const dynamic = "force-dynamic";

const LOGO_PRINCIPAL = "/brand/logo-creativa.svg";
const LOGO_SECUNDARIO = "/brand/logo-crea-comunicacion.svg";

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
    .select("tipo, numero_completo, cliente_razon_social, clientes(razon_social)")
    .eq("id", documentoId)
    .maybeSingle();
  if (!data) return { title: "Documento" };

  const cliente = Array.isArray(data.clientes) ? data.clientes[0] : data.clientes;
  return {
    title: nombreArchivo(data.tipo, data.numero_completo, data.cliente_razon_social ?? cliente?.razon_social ?? ""),
  };
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
      .select(
        "*, clientes(razon_social, numero_documento, tipo_documento, direccion, codigo_postal, municipio, provincia)",
      )
      .eq("id", documentoId)
      .maybeSingle(),
    supabase
      .from("lineas_documento")
      .select(
        "id, descripcion, alcance, unidad, piezas, cantidad, ancho_cm, alto_cm, precio_unitario, recargo_acabados, descuento_pct, iva_pct, importe",
      )
      .eq("documento_id", documentoId)
      .order("orden"),
    supabase.from("empresa").select("*").limit(1).maybeSingle(),
  ]);
  if (!doc) notFound();

  const [origen, cuenta] = await Promise.all([
    doc.documento_origen_id
      ? supabase
          .from("documentos")
          .select("numero_completo, fecha")
          .eq("id", doc.documento_origen_id)
          .maybeSingle()
          .then((r) => r.data)
      : null,
    doc.cuenta_cobro_id
      ? supabase
          .from("cuentas_bancarias")
          .select("banco")
          .eq("id", doc.cuenta_cobro_id)
          .maybeSingle()
          .then((r) => r.data)
      : null,
  ]);

  const cliente = Array.isArray(doc.clientes) ? doc.clientes[0] : doc.clientes;
  // Un documento emitido lleva los datos del cliente congelados; un borrador, los de la ficha.
  const numeroDocumentoCliente = doc.cliente_documento ?? cliente?.numero_documento ?? null;

  const datos: DatosHoja = {
    tipo: doc.tipo,
    estado: doc.estado,
    numero: doc.numero_completo,
    fecha: doc.fecha,
    fechaOperacion: doc.fecha_operacion,
    fechaVencimiento: doc.fecha_vencimiento,
    validoHasta: doc.valido_hasta,
    empresa: {
      nombreComercial: empresa?.nombre_comercial ?? null,
      razonSocial: empresa?.razon_social ?? null,
      nif: empresa?.nif ?? null,
      direccion: empresa
        ? componerDireccion({
            direccion: empresa.direccion,
            codigoPostal: empresa.codigo_postal,
            municipio: empresa.municipio,
            provincia: empresa.provincia,
          })
        : "",
      telefonos: [
        empresa?.telefono ? `Tlf. ${empresa.telefono}` : null,
        empresa?.movil ? `Móvil ${empresa.movil}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      email: empresa?.email ?? null,
      lema: empresa?.lema ?? null,
      logoPrincipal: empresa?.logo_url || LOGO_PRINCIPAL,
      logoSecundario: LOGO_SECUNDARIO,
    },
    cliente: {
      razonSocial: doc.cliente_razon_social ?? cliente?.razon_social ?? "",
      documento: numeroDocumentoCliente
        ? etiquetaDocumentoIdentidad(cliente?.tipo_documento, numeroDocumentoCliente)
        : null,
      direccion: componerDireccion({
        direccion: doc.cliente_direccion ?? cliente?.direccion,
        codigoPostal: doc.cliente_cp ?? cliente?.codigo_postal,
        municipio: doc.cliente_municipio ?? cliente?.municipio,
        provincia: doc.cliente_provincia ?? cliente?.provincia,
      }),
    },
    campana: doc.campana,
    descripcion: doc.descripcion,
    rectifica: origen ? { numero: origen.numero_completo, fecha: origen.fecha } : null,
    motivoRectificacion: doc.motivo_rectificacion,
    lineas: lineas ?? [],
    totales: {
      suma: Number(doc.suma_lineas),
      descuentoPct: Number(doc.descuento_global_pct),
      descuentoImporte: Number(doc.importe_descuento),
      base: Number(doc.base_imponible),
      cuota: Number(doc.cuota_iva),
      retencionPct: Number(doc.retencion_pct),
      retencionImporte: Number(doc.importe_retencion),
      total: Number(doc.total),
    },
    regimenIva: doc.regimen_iva,
    motivoExencion: doc.motivo_exencion,
    pago: { texto: doc.texto_forma_pago, banco: cuenta?.banco ?? null, iban: doc.iban_cobro },
    notasCliente: doc.notas_cliente,
  };

  return (
    <div className="flex flex-col gap-esp4">
      <div className="flex flex-wrap items-center gap-esp3 print:hidden">
        <Link
          href={`/admin/documentos/${documentoId}`}
          className="flex items-center gap-esp1 text-sm text-texto-secundario hover:text-texto-primario"
        >
          <Icono nombre="atras" size={16} />
          Volver al documento
        </Link>
        <p className="flex-1 text-xs text-texto-terciario">
          En el diálogo de impresión elige «Guardar como PDF», tamaño A4 y activa «Gráficos de fondo» para que
          se vean los colores.
        </p>
        <BotonImprimir />
      </div>

      {/* En pantallas estrechas la hoja A4 se desplaza en horizontal en vez de deformarse. */}
      <div className="overflow-x-auto pb-esp4 print:overflow-visible print:p-0">
        <HojaDocumento d={datos} />
      </div>
    </div>
  );
}
