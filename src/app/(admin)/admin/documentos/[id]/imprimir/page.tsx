import { METODOS_COBRO, resolverVencimientoDefecto, sumarDias, textoFormaPago } from "@/lib/documentos";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Icono } from "@/components/ui/iconos";
import { HojaDocumento, type DatosHoja } from "@/components/admin/hoja-documento";
import { componerDireccionEnLineas } from "@/lib/direccion";
import { etiquetaDocumentoIdentidad, nombreArchivo } from "@/lib/documento-impresion";
import { BotonImprimir } from "./boton-imprimir";

export const dynamic = "force-dynamic";

const LOGO_PRINCIPAL = "/brand/logo-creativa.svg";
const LOGO_SECUNDARIO = "/brand/logo-crea-comunicacion.svg";

/** El título de la pestaña es el nombre que propone el navegador al "Guardar como PDF". */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pagada?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const conSello = (await searchParams).pagada === "1";
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
  const nombre = nombreArchivo(data.tipo, data.numero_completo, data.cliente_razon_social ?? cliente?.razon_social ?? "");
  // «PAGADA» en el nombre solo si de verdad lleva el sello (factura cobrada por completo).
  const cobrada =
    conSello &&
    data.tipo === "factura" &&
    (await supabase.from("v_estado_cobro").select("estado_cobro").eq("id", documentoId).maybeSingle()).data
      ?.estado_cobro === "cobrada";
  return { title: cobrada ? `${nombre} PAGADA` : nombre };
}

export default async function PaginaImprimirDocumento({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pagada?: string }>;
}) {
  const { id } = await params;
  const pideSello = (await searchParams).pagada === "1";
  const documentoId = Number(id);
  if (!Number.isInteger(documentoId)) notFound();

  const supabase = await createClient();

  const [{ data: doc }, { data: lineas }, { data: empresa }] = await Promise.all([
    supabase
      .from("documentos")
      .select(
        "*, clientes(razon_social, numero_documento, tipo_documento, direccion, codigo_postal, municipio, provincia, dias_vencimiento)",
      )
      .eq("id", documentoId)
      .maybeSingle(),
    supabase
      .from("lineas_documento")
      .select(
        "id, descripcion, artista, alcance, unidad, piezas, cantidad, ancho_cm, alto_cm, precio_unitario, recargo_acabados, descuento_pct, iva_pct, importe",
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

  // Un borrador aún no tiene el texto de pago ni el vencimiento congelados (se fijan al emitir): se muestra cómo quedarán.
  let textoPago = doc.texto_forma_pago;
  let fechaVencimientoPreview = doc.fecha_vencimiento;
  if (doc.estado === "borrador") {
    const forma = doc.forma_pago_id
      ? (
          await supabase
            .from("formas_pago")
            .select("texto_factura, dias_vencimiento")
            .eq("id", doc.forma_pago_id)
            .maybeSingle()
        ).data
      : null;
    const defecto = resolverVencimientoDefecto({
      diasCliente: cliente?.dias_vencimiento,
      diasFormaPago: forma?.dias_vencimiento ?? null,
      diasGeneral: empresa?.vencimiento_defecto_dias ?? 30,
    });
    fechaVencimientoPreview = doc.plazo_dias
      ? sumarDias(doc.fecha, doc.plazo_dias)
      : (doc.fecha_vencimiento ?? sumarDias(doc.fecha, defecto.dias));
    if (!textoPago && forma?.texto_factura) {
      textoPago = textoFormaPago(forma.texto_factura, doc.plazo_dias, fechaVencimientoPreview);
    }
  }

  // Sello «PAGADA»: solo en facturas emitidas y cobradas por completo.
  const facturaEmitida = doc.tipo === "factura" && doc.estado !== "borrador";
  const [{ data: estadoCobro }, { data: cobros }] = facturaEmitida
    ? await Promise.all([
        supabase.from("v_estado_cobro").select("estado_cobro, ultimo_cobro").eq("id", documentoId).maybeSingle(),
        supabase.from("cobros").select("metodo").eq("documento_id", documentoId),
      ])
    : [{ data: null }, { data: [] }];
  const cobrada = estadoCobro?.estado_cobro === "cobrada";
  // El método solo se indica si todos los cobros se hicieron igual.
  const metodos = [...new Set((cobros ?? []).map((c) => c.metodo))];
  const pagada =
    pideSello && cobrada
      ? {
          fecha: estadoCobro?.ultimo_cobro ?? null,
          metodo: metodos.length === 1 ? (METODOS_COBRO.find((m) => m.valor === metodos[0])?.etiqueta ?? null) : null,
        }
      : null;

  // Un documento emitido lleva los datos del cliente congelados; un borrador, los de la ficha.
  const numeroDocumentoCliente = doc.cliente_documento ?? cliente?.numero_documento ?? null;

  const datos: DatosHoja = {
    tipo: doc.tipo,
    estado: doc.estado,
    numero: doc.numero_completo,
    fecha: doc.fecha,
    fechaOperacion: doc.fecha_operacion,
    fechaVencimiento: fechaVencimientoPreview,
    validoHasta: doc.valido_hasta,
    empresa: {
      nombreComercial: empresa?.nombre_comercial ?? null,
      razonSocial: empresa?.razon_social ?? null,
      nif: empresa?.nif ?? null,
      direccion: empresa
        ? componerDireccionEnLineas({
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
      direccion: componerDireccionEnLineas({
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
    causaRectificacion: doc.causa_rectificacion,
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
    pago: { texto: textoPago, banco: cuenta?.banco ?? null, iban: doc.iban_cobro },
    notasCliente: doc.notas_cliente,
    pagada,
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
        {facturaEmitida &&
          (cobrada ? (
            <Link
              href={`/admin/documentos/${documentoId}/imprimir${pagada ? "" : "?pagada=1"}`}
              replace
              aria-pressed={!!pagada}
              className="inline-flex h-10 items-center gap-esp2 rounded-md border border-borde-campo bg-fondo-superficie px-esp3 text-sm font-medium text-texto-primario hover:bg-fondo-sutil"
            >
              <Icono nombre={pagada ? "cerrar" : "check"} size={16} />
              {pagada ? "Quitar sello «PAGADA»" : "Añadir sello «PAGADA»"}
            </Link>
          ) : (
            pideSello && (
              <p className="text-xs text-texto-aviso">
                Sin sello «PAGADA»: la factura aún no está cobrada por completo.
              </p>
            )
          ))}
        <BotonImprimir />
      </div>

      {/* En pantallas estrechas la hoja A4 se desplaza en horizontal en vez de deformarse. */}
      <div className="overflow-x-auto pb-esp4 print:overflow-visible print:p-0">
        <HojaDocumento d={datos} />
      </div>
    </div>
  );
}
