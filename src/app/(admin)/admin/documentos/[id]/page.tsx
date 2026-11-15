import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { Icono } from "@/components/ui/iconos";
import { PasosDocumento } from "@/components/admin/pasos-documento";
import { euros, fechaMedia } from "@/lib/formato";
import { ETIQUETA_COBRO, ETIQUETA_ESTADO_DOC, ETIQUETA_TIPO } from "@/lib/documentos";
import { componerDireccion } from "@/lib/direccion";
import { formatoCantidad, precioUnitarioImpreso } from "@/lib/documento-impresion";
import { AccionesDocumento, CondicionesDocumento, Cobros } from "./controles";
import { lanzarSiError } from "@/lib/supabase/consulta";

export const dynamic = "force-dynamic";

const ETIQUETA_REGIMEN: Record<string, string> = {
  general: "IVA general",
  reducido: "IVA reducido",
  intracomunitario: "Operación intracomunitaria",
  exento: "Exento de IVA",
};

export default async function PaginaDocumento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const documentoId = Number(id);
  if (!Number.isInteger(documentoId)) notFound();

  const supabase = await createClient();

  const resultados = await Promise.all([
    supabase
      .from("documentos")
      .select("*, clientes(razon_social, numero_documento, direccion, codigo_postal, municipio, provincia, email_facturacion)")
      .eq("id", documentoId)
      .maybeSingle(),
    supabase
      .from("lineas_documento")
      .select("id, descripcion, artista, cantidad, unidad, precio_unitario, recargo_acabados, descuento_pct, iva_pct, importe")
      .eq("documento_id", documentoId)
      .order("orden"),
    supabase
      .from("documentos")
      .select("id, tipo, numero_completo")
      .eq("documento_origen_id", documentoId),
  ]);
  if (resultados[0].error?.code !== "PGRST116") lanzarSiError(...resultados);
  const [{ data: doc }, { data: lineas }, { data: derivados }] = resultados;

  if (!doc) notFound();

  const origen = doc.documento_origen_id
    ? (
        await supabase
          .from("documentos")
          .select("id, tipo, numero_completo")
          .eq("id", doc.documento_origen_id)
          .maybeSingle()
      ).data
    : null;

  const campanaVinculada = doc.campana_id
    ? (
        await supabase
          .from("v_progreso_campana")
          .select("campana_id, campana, puntos_totales")
          .eq("campana_id", doc.campana_id)
          .maybeSingle()
      ).data
    : null;

  const esBorrador = doc.estado === "borrador";
  const { data: formasPago } = esBorrador
    ? await supabase.from("formas_pago").select("id, nombre, dias_vencimiento").order("nombre")
    : { data: [] };
  const cobrable = doc.tipo === "factura" && !esBorrador;

  // Destinatarios del email: contactos marcados como "recibe las facturas" + el email de facturación.
  const [{ data: contactosFactura }, { data: empresa }] = esBorrador
    ? [{ data: [] }, { data: null }]
    : await Promise.all([
        supabase.from("contactos_cliente").select("email").eq("cliente_id", doc.cliente_id).eq("recibe_facturas", true),
        supabase.from("empresa").select("nombre_comercial").limit(1).maybeSingle(),
      ]);

  const [{ data: estadoCobro }, { data: cobros }] = cobrable
    ? await Promise.all([
        supabase
          .from("v_estado_cobro")
          .select("cobrado, pendiente, estado_cobro")
          .eq("id", documentoId)
          .maybeSingle(),
        supabase
          .from("cobros")
          .select("id, fecha, importe, metodo, referencia")
          .eq("documento_id", documentoId)
          .order("fecha"),
      ])
    : [{ data: null }, { data: [] }];

  const cliente = Array.isArray(doc.clientes) ? doc.clientes[0] : doc.clientes;
  // En un borrador los datos del cliente salen de la ficha; al emitir se congelan en el documento.
  const razonSocial = doc.cliente_razon_social ?? cliente?.razon_social ?? "Sin cliente";
  const nif = doc.cliente_documento ?? cliente?.numero_documento;
  const direccion = componerDireccion({
    direccion: doc.cliente_direccion ?? cliente?.direccion,
    codigoPostal: doc.cliente_cp ?? cliente?.codigo_postal,
    municipio: doc.cliente_municipio ?? cliente?.municipio,
    provincia: doc.cliente_provincia ?? cliente?.provincia,
  });

  const etiquetaTipo = ETIQUETA_TIPO[doc.tipo] ?? doc.tipo;
  const titulo = doc.numero_completo ?? `${etiquetaTipo} en borrador`;

  const destinatarios = [
    ...new Set(
      [...(contactosFactura ?? []).map((c) => c.email), cliente?.email_facturacion].filter((e): e is string => !!e),
    ),
  ];
  const mailto = esBorrador
    ? null
    : `mailto:${destinatarios.join(",")}?subject=${encodeURIComponent(`${etiquetaTipo} ${doc.numero_completo ?? ""}`.trim())}&body=${encodeURIComponent(
        `Hola,\n\nTe adjunto ${doc.tipo === "factura" || doc.tipo === "rectificativa" ? "la" : "el"} ${etiquetaTipo.toLowerCase()} ${doc.numero_completo ?? ""} por importe de ${euros(Number(doc.total))}.\n\nUn saludo,\n${empresa?.nombre_comercial ?? ""}`,
      )}`;
  const filasLineas = lineas ?? [];

  return (
    <div className={esBorrador ? "flex flex-col gap-esp6 pb-24 xl:pb-0" : "flex flex-col gap-esp6"}>
      <div className="flex flex-col gap-esp2">
        <Link
          href="/admin/documentos"
          className="flex w-fit items-center gap-esp1 text-sm text-texto-secundario hover:text-texto-primario"
        >
          <Icono nombre="atras" size={16} />
          Documentos
        </Link>
        {esBorrador && (
          <div className="py-esp2">
            <PasosDocumento actual={4} documentoId={doc.id} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-esp3">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-texto-primario">{titulo}</h1>
            <p className="text-sm text-texto-secundario">
              {etiquetaTipo} · {fechaMedia(doc.fecha)}
              {doc.fecha_vencimiento && !esBorrador ? ` · vence ${fechaMedia(doc.fecha_vencimiento)}` : ""}
              {doc.valido_hasta ? ` · válido hasta ${fechaMedia(doc.valido_hasta)}` : ""}
            </p>
          </div>
          {estadoCobro?.estado_cobro && (
            <Insignia tono={TONO_POR_ESTADO[estadoCobro.estado_cobro] ?? "neutro"}>
              {ETIQUETA_COBRO[estadoCobro.estado_cobro] ?? estadoCobro.estado_cobro}
            </Insignia>
          )}
          <Insignia tono={TONO_POR_ESTADO[doc.estado] ?? "neutro"}>
            {ETIQUETA_ESTADO_DOC[doc.estado] ?? doc.estado}
          </Insignia>
        </div>

        {(origen || (derivados ?? []).length > 0) && (
          <div className="flex flex-wrap gap-esp3 text-xs text-texto-secundario">
            {origen && (
              <span>
                Origen:{" "}
                <Link href={`/admin/documentos/${origen.id}`} className="font-medium text-texto-marca">
                  {origen.numero_completo ?? ETIQUETA_TIPO[origen.tipo]}
                </Link>
              </span>
            )}
            {(derivados ?? []).map((d) => (
              <span key={d.id}>
                {ETIQUETA_TIPO[d.tipo] ?? d.tipo}:{" "}
                <Link href={`/admin/documentos/${d.id}`} className="font-medium text-texto-marca">
                  {d.numero_completo ?? "borrador"}
                </Link>
              </span>
            ))}
          </div>
        )}
        {doc.motivo_rectificacion && (
          <p className="text-xs text-texto-secundario">Motivo: {doc.motivo_rectificacion}</p>
        )}
      </div>

      <div className="flex flex-col gap-esp6 xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-esp4">
          <div className="flex flex-col gap-1 rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp4">
            <p className="text-xs text-texto-terciario">Cliente</p>
            <p className="text-sm font-medium text-texto-primario">{razonSocial}</p>
            {nif && <p className="text-xs text-texto-secundario">{nif}</p>}
            {direccion && <p className="text-xs text-texto-secundario">{direccion}</p>}
          </div>

          {(campanaVinculada || esBorrador) && (
            <div className="flex items-center gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp4">
              <div className="flex-1">
                <p className="text-xs text-texto-terciario">Campaña</p>
                {campanaVinculada ? (
                  <p className="text-sm font-medium text-texto-primario">
                    {campanaVinculada.campana} ·{" "}
                    <span className="font-normal text-texto-secundario">
                      {campanaVinculada.puntos_totales} puntos
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-texto-secundario">Sin campaña vinculada</p>
                )}
              </div>
              {esBorrador && (
                <Link
                  href={`/admin/documentos/nuevo?documento=${doc.id}&paso=campana`}
                  className="text-sm font-medium text-texto-marca"
                >
                  {campanaVinculada ? "Editar puntos" : "Añadir campaña"}
                </Link>
              )}
              {campanaVinculada && (
                <Link
                  href={`/admin/campanas/${campanaVinculada.campana_id}`}
                  className="text-sm font-medium text-texto-marca"
                >
                  Abrir
                </Link>
              )}
            </div>
          )}

          <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
            <h2 className="text-base font-semibold text-texto-primario">Líneas</h2>
            <div className="flex flex-col divide-y divide-fondo-hover">
              <div className="hidden grid-cols-[1fr_90px_90px_60px_100px] gap-esp3 pb-esp2 text-xs text-texto-terciario md:grid">
                <span>Descripción</span>
                <span className="text-right">Cantidad</span>
                <span className="text-right">Precio</span>
                <span className="text-right">Dto.</span>
                <span className="text-right">Importe</span>
              </div>
              {filasLineas.map((l) => (
                <div
                  key={l.id}
                  className="grid grid-cols-[1fr_auto] gap-x-esp3 gap-y-1 py-esp3 md:grid-cols-[1fr_90px_90px_60px_100px]"
                >
                  <span className="text-sm text-texto-primario">
                    {l.descripcion}
                    {l.artista && <span className="block text-xs text-texto-secundario">{l.artista}</span>}
                  </span>
                  <span className="text-right text-sm font-medium text-texto-primario md:order-last">
                    {euros(Number(l.importe))}
                  </span>
                  <span className="text-xs text-texto-terciario md:text-right md:text-sm md:text-texto-primario">
                    {formatoCantidad(l.cantidad)} {l.unidad}
                  </span>
                  <span className="hidden text-right text-sm text-texto-primario md:block">
                    {euros(precioUnitarioImpreso(l))}
                  </span>
                  <span className="hidden text-right text-sm text-texto-secundario md:block">
                    {Number(l.descuento_pct) > 0 ? `${Number(l.descuento_pct)}%` : "—"}
                  </span>
                </div>
              ))}
              {filasLineas.length === 0 && (
                <p className="py-esp4 text-sm text-texto-terciario">Este documento no tiene líneas.</p>
              )}
            </div>
          </div>

          {(doc.notas_cliente || doc.texto_forma_pago || doc.motivo_exencion) && (
            <div className="flex flex-col gap-esp2 rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp4 text-xs text-texto-secundario">
              {doc.texto_forma_pago && <p>Forma de pago: {doc.texto_forma_pago}</p>}
              {doc.iban_cobro && <p>IBAN: {doc.iban_cobro}</p>}
              {doc.motivo_exencion && <p>{doc.motivo_exencion}</p>}
              {doc.notas_cliente && <p>{doc.notas_cliente}</p>}
            </div>
          )}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-esp4 xl:w-[360px]">
          <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
            <h2 className="text-base font-semibold text-texto-primario">Resumen</h2>
            <Fila etiqueta="Suma de líneas" valor={euros(Number(doc.suma_lineas))} />
            {Number(doc.importe_descuento) !== 0 && (
              <Fila
                etiqueta={`Descuento (${Number(doc.descuento_global_pct)}%)`}
                valor={euros(-Number(doc.importe_descuento))}
              />
            )}
            <Fila etiqueta="Base imponible" valor={euros(Number(doc.base_imponible))} />
            <Fila etiqueta={ETIQUETA_REGIMEN[doc.regimen_iva] ?? "IVA"} valor={euros(Number(doc.cuota_iva))} />
            {Number(doc.importe_retencion) !== 0 && (
              <Fila
                etiqueta={`Retención (${Number(doc.retencion_pct)}%)`}
                valor={euros(-Number(doc.importe_retencion))}
              />
            )}
            <div className="h-px bg-fondo-hover" />
            <div className="flex items-center">
              <span className="flex-1 text-base font-semibold text-texto-primario">Total</span>
              <span className="whitespace-nowrap text-[clamp(1.375rem,7vw,1.75rem)] font-semibold leading-9 text-texto-primario">
                {euros(Number(doc.total))}
              </span>
            </div>
            {estadoCobro && (
              <>
                <Fila etiqueta="Cobrado" valor={euros(Number(estadoCobro.cobrado))} />
                <Fila etiqueta="Pendiente" valor={euros(Number(estadoCobro.pendiente))} />
              </>
            )}
          </div>

          {esBorrador && (
            <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
              <h2 className="text-base font-semibold text-texto-primario">Condiciones</h2>
              <CondicionesDocumento
                documentoId={doc.id}
                tipo={doc.tipo}
                formasPago={formasPago ?? []}
                inicial={{
                  fechaVencimiento: doc.fecha_vencimiento,
                  validoHasta: doc.valido_hasta,
                  formaPagoId: doc.forma_pago_id,
                  descuentoGlobalPct: Number(doc.descuento_global_pct),
                  retencionPct: Number(doc.retencion_pct),
                  campana: doc.campana,
                  descripcion: doc.descripcion,
                  notasCliente: doc.notas_cliente,
                }}
              />
            </div>
          )}

          <div id="acciones" className="scroll-mt-esp4 flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
            <h2 className="text-base font-semibold text-texto-primario">Acciones</h2>
            <AccionesDocumento
              documentoId={doc.id}
              tipo={doc.tipo}
              estado={doc.estado}
              etiquetaTipo={etiquetaTipo}
              mailto={mailto}
              hayDestinatario={destinatarios.length > 0}
            />
          </div>

          {cobrable && estadoCobro && (
            <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
              <h2 className="text-base font-semibold text-texto-primario">Cobros</h2>
              <Cobros
                key={`${cobros?.length ?? 0}-${estadoCobro.pendiente}`}
                documentoId={doc.id}
                pendiente={Number(estadoCobro.pendiente)}
                cobros={(cobros ?? []).map((c) => ({
                  id: c.id,
                  fecha: c.fecha,
                  importe: Number(c.importe),
                  metodo: c.metodo,
                  referencia: c.referencia,
                }))}
              />
            </div>
          )}
        </div>
      </div>

      {/* Móvil: el resumen y el botón de emitir quedan al pie, sin tener que recorrer toda la página. */}
      {esBorrador && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-esp3 border-t border-borde-default bg-fondo-superficie px-esp4 pt-esp3 pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-lg xl:hidden print:hidden">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-texto-terciario">Total</p>
            <p className="text-lg font-semibold leading-tight text-texto-primario">{euros(Number(doc.total))}</p>
          </div>
          <a
            href="#acciones"
            className="inline-flex h-11 items-center rounded-md bg-fondo-marca px-esp5 text-sm font-medium text-texto-sobre-marca"
          >
            Revisar y emitir
          </a>
        </div>
      )}
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center">
      <span className="flex-1 text-sm text-texto-secundario">{etiqueta}</span>
      <span className="text-sm font-medium text-texto-primario">{valor}</span>
    </div>
  );
}
