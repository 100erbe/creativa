import Link from "next/link";
import { BotonAvisos } from "@/components/ui/boton-avisos";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { Icono } from "@/components/ui/iconos";
import { PasosDocumento } from "@/components/admin/pasos-documento";
import { euros, fechaMedia } from "@/lib/formato";
import {
  ETIQUETA_CAUSA_RECTIFICACION,
  ETIQUETA_COBRO,
  ETIQUETA_ESTADO_DOC,
  ETIQUETA_TIPO,
  clasificarAgingCobro,
  validezVencida,
  type CausaRectificacion,
} from "@/lib/documentos";
import { SALDO_MINIMO } from "@/lib/estado-cuenta";
import { componerDireccion } from "@/lib/direccion";
import { formatoCantidad, precioUnitarioImpreso } from "@/lib/documento-impresion";
import {
  AccionesDocumento,
  BotonSalirConCondiciones,
  CondicionesDocumento,
  Cobros,
  ProveedorCondiciones,
  RevisionDocumento,
} from "./controles";
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
      .select("*, clientes(razon_social, numero_documento, direccion, codigo_postal, municipio, provincia, email_facturacion, dias_vencimiento)")
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
          .select("id, tipo, numero_completo, total, origen_datos")
          .eq("id", doc.documento_origen_id)
          .maybeSingle()
      ).data
    : null;

  // Rectificativa en borrador: lo ya rectificado de la factura por otras rectificativas emitidas y lo que queda.
  // Al emitir, la base de datos rechaza la que supere lo que queda (ver emitir_documento).
  const limiteRectificacion =
    doc.tipo === "rectificativa" && doc.estado === "borrador" && origen?.tipo === "factura"
      ? await (async () => {
          const { data: emitidas } = await supabase
            .from("documentos")
            .select("numero_completo, total")
            .eq("documento_origen_id", origen.id)
            .eq("tipo", "rectificativa")
            .neq("estado", "borrador")
            .neq("id", doc.id);
          const rectificado = -(emitidas ?? []).reduce((s, r) => s + Number(r.total), 0);
          const restante = Math.max(0, Number(origen.total) - rectificado);
          const excede = -Number(doc.total) > restante + 0.005;
          return {
            factura: origen.numero_completo ?? "",
            totalFactura: Number(origen.total),
            rectificado,
            restante,
            numeros: (emitidas ?? []).map((r) => r.numero_completo).filter(Boolean).join(", "),
            excede,
            // El borrador no abona exactamente lo que queda. En las facturas importadas las líneas pueden no
            // sumar el total del PDF: al copiarlas en negativo se recalculan y el abono sale por otro importe.
            noCuadra: !excede && Math.abs(-Number(doc.total) - restante) > 0.01,
            facturaImportada: !!origen.origen_datos,
          };
        })()
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
  const [{ data: formasPago }, { data: empresaBorrador }] = esBorrador
    ? await Promise.all([
        supabase.from("formas_pago").select("id, nombre, dias_vencimiento, plazos_dias").order("nombre"),
        supabase.from("empresa").select("vencimiento_defecto_dias").eq("id", 1).maybeSingle(),
      ])
    : [{ data: [] }, { data: null }];
  // Facturas y rectificativas emitidas llevan cobros (en la rectificativa, devoluciones o compensaciones).
  const cobrable = (doc.tipo === "factura" || doc.tipo === "rectificativa") && !esBorrador;
  const esRectificativa = doc.tipo === "rectificativa";

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

  // Factura ↔ rectificativas: estado de cobro de la otra parte, para el saldo neto y la compensación.
  const idsRectificativas = (derivados ?? []).filter((d) => d.tipo === "rectificativa" && d.numero_completo).map((d) => d.id);
  const relacionadas = cobrable
    ? esRectificativa
      ? doc.documento_origen_id
        ? [doc.documento_origen_id]
        : []
      : idsRectificativas
    : [];
  const { data: estadosRelacionados } =
    relacionadas.length > 0
      ? await supabase
          .from("v_estado_cobro")
          .select("id, numero_completo, total, pendiente")
          .in("id", relacionadas)
      : { data: [] };
  const otrasPartes = (estadosRelacionados ?? []).flatMap((r) => (r.id == null ? [] : [{ ...r, id: r.id }])).map((r) => ({
    id: r.id,
    numero: r.numero_completo ?? "",
    total: Number(r.total),
    pendiente: Number(r.pendiente),
  }));

  const pendienteBruto = Number(estadoCobro?.pendiente ?? 0);
  const abonosRelacionados = !esRectificativa
    ? otrasPartes.reduce((s, r) => s + (r.pendiente < -0.01 ? -r.pendiente : 0), 0)
    : 0;
  const pendienteNeto = Math.max(0, Math.round((pendienteBruto - Math.min(abonosRelacionados, pendienteBruto)) * 100) / 100);
  const aging =
    doc.tipo === "factura" &&
    !esBorrador &&
    doc.estado !== "anulado" &&
    estadoCobro?.estado_cobro &&
    estadoCobro.estado_cobro !== "cobrada" &&
    pendienteNeto >= SALDO_MINIMO
      ? clasificarAgingCobro(estadoCobro.estado_cobro, doc.fecha_vencimiento, new Date(), doc.fecha)
      : null;
  const esVencida = (aging?.diasVencido ?? 0) > 0;
  const esCritica90 = aging?.esCritica90 ?? false;

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
  const nombreDocumento = `${etiquetaTipo} ${doc.numero_completo ?? "(borrador)"}`.trim();
  const compartir = {
    archivo: nombreDocumento,
    titulo: nombreDocumento,
    texto: `${nombreDocumento} por importe de ${euros(Number(doc.total))}.`,
  };
  const filasLineas = lineas ?? [];
  // Factura en borrador ya creada desde este presupuesto/albarán: se sigue con ella en lugar de convertir otra vez.
  const facturaEnBorradorId = (derivados ?? []).find((d) => d.tipo === "factura" && !d.numero_completo)?.id ?? null;
  // Versión nueva de este presupuesto aún en borrador.
  const versionEnBorradorId =
    doc.tipo === "presupuesto"
      ? ((derivados ?? []).find((d) => d.tipo === "presupuesto" && !d.numero_completo)?.id ?? null)
      : null;
  const vencido = validezVencida(doc.tipo, doc.estado, doc.valido_hasta);
  // El tipo se puede cambiar en un borrador propio (no en una factura convertida ni en una versión).
  const tipoCambiable =
    esBorrador && !doc.documento_origen_id && ["presupuesto", "albaran", "factura"].includes(doc.tipo);
  // Origen y derivados del mismo tipo (presupuesto → presupuesto) son versiones.
  const etiquetaRelacion = (tipo: string, esOrigen: boolean) =>
    tipo === "presupuesto" && doc.tipo === "presupuesto"
      ? esOrigen
        ? "Versión anterior"
        : "Nueva versión"
      : esOrigen
        ? "Origen"
        : (ETIQUETA_TIPO[tipo] ?? tipo);

  return (
    <ProveedorCondiciones>
    <div className={esBorrador ? "flex flex-col gap-esp6 pb-24 xl:pb-0" : "flex flex-col gap-esp6"}>
      <div className="flex flex-col gap-esp2">
        <Link
          href="/admin/documentos"
          className="group hidden w-fit items-center gap-esp1 text-sm text-texto-secundario transition-colors duration-rapida ease-suave hover:text-texto-primario md:flex"
        >
          <Icono nombre="atras" size={16} className="transition-transform duration-rapida ease-salida group-hover:-translate-x-0.5" />
          Documentos
        </Link>
        {esBorrador && (
          <div className="py-esp2">
            <PasosDocumento actual={4} documentoId={doc.id} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-esp3">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-texto-primario md:text-titulo-pagina">{titulo}</h1>
            <p className="text-sm text-texto-secundario">
              {etiquetaTipo}
              {doc.version > 1 ? ` · versión ${doc.version}` : ""} · {fechaMedia(doc.fecha)}
              {doc.fecha_vencimiento && !esBorrador && doc.tipo !== "presupuesto" ? (
                <span className={esCritica90 ? "font-medium text-texto-critico" : esVencida ? "font-medium text-texto-peligro" : undefined}>
                  {` · vence ${fechaMedia(doc.fecha_vencimiento)}`}
                </span>
              ) : (
                ""
              )}
              {doc.valido_hasta ? ` · válido hasta ${fechaMedia(doc.valido_hasta)}` : ""}
              {tipoCambiable && (
                <>
                  {" · "}
                  <Link
                    href={`/admin/documentos/nuevo?documento=${doc.id}&paso=cliente`}
                    className="font-medium text-texto-marca"
                  >
                    Cambiar tipo
                  </Link>
                </>
              )}
            </p>
          </div>
          {estadoCobro?.estado_cobro &&
            (esCritica90 && aging ? (
              <Insignia tono="critico" solido>
                90+ días · {aging.diasVencido}d
              </Insignia>
            ) : (
              <Insignia tono={esVencida ? "peligro" : (TONO_POR_ESTADO[estadoCobro.estado_cobro] ?? "neutro")}>
                {esVencida && aging
                  ? `${ETIQUETA_COBRO[estadoCobro.estado_cobro] ?? estadoCobro.estado_cobro} (${aging.diasVencido}d)`
                  : (ETIQUETA_COBRO[estadoCobro.estado_cobro] ?? estadoCobro.estado_cobro)}
              </Insignia>
            ))}
          {vencido && <Insignia tono="aviso">Validez vencida</Insignia>}
          <Insignia tono={TONO_POR_ESTADO[doc.estado] ?? "neutro"}>
            {ETIQUETA_ESTADO_DOC[doc.estado] ?? doc.estado}
          </Insignia>
          {esBorrador && <BotonSalirConCondiciones documentoId={doc.id} />}
          <BotonAvisos />
        </div>

        {(origen || (derivados ?? []).length > 0) && (
          <div className="flex flex-wrap gap-esp3 text-xs text-texto-secundario">
            {origen && (
              <span>
                {etiquetaRelacion(origen.tipo, true)}:{" "}
                <Link href={`/admin/documentos/${origen.id}`} className="font-medium text-texto-marca">
                  {origen.numero_completo ?? ETIQUETA_TIPO[origen.tipo]}
                </Link>
              </span>
            )}
            {(derivados ?? []).map((d) => (
              <span key={d.id}>
                {etiquetaRelacion(d.tipo, false)}:{" "}
                <Link href={`/admin/documentos/${d.id}`} className="font-medium text-texto-marca">
                  {d.numero_completo ?? "borrador"}
                </Link>
              </span>
            ))}
          </div>
        )}
        {doc.motivo_rectificacion && (
          <p className="text-xs text-texto-secundario">
            Motivo: {doc.motivo_rectificacion}
            {doc.causa_rectificacion && (
              <>
                {" "}
                · Causa {doc.causa_rectificacion} (
                {ETIQUETA_CAUSA_RECTIFICACION[doc.causa_rectificacion as CausaRectificacion] ?? "—"})
              </>
            )}
          </p>
        )}
        {limiteRectificacion &&
          (limiteRectificacion.rectificado > 0.005 || limiteRectificacion.excede || limiteRectificacion.noCuadra) && (
          <div
            role={limiteRectificacion.excede || limiteRectificacion.noCuadra ? "alert" : undefined}
            className={`flex flex-col gap-1 rounded-md border px-esp3 py-esp2 text-xs text-texto-primario ${
              limiteRectificacion.excede || limiteRectificacion.noCuadra
                ? "border-borde-aviso bg-fondo-aviso-sutil"
                : "border-borde-default bg-fondo-superficie"
            }`}
          >
            <p>
              {limiteRectificacion.rectificado > 0.005 ? (
                <>
                  La factura {limiteRectificacion.factura} ({euros(limiteRectificacion.totalFactura)}) ya está rectificada en{" "}
                  {euros(limiteRectificacion.rectificado)}
                  {limiteRectificacion.numeros ? ` (${limiteRectificacion.numeros})` : ""}. Queda por rectificar{" "}
                </>
              ) : (
                <>
                  La factura {limiteRectificacion.factura} no tiene otras rectificativas emitidas. Queda por rectificar{" "}
                </>
              )}
              <strong>{euros(limiteRectificacion.restante)}</strong>.
            </p>
            {limiteRectificacion.excede && (
              <p className="font-medium text-texto-aviso">
                Esta rectificativa ({euros(Number(doc.total))}) supera lo que queda: ajusta las líneas hasta un máximo de{" "}
                {euros(-limiteRectificacion.restante)} o no se podrá emitir.
              </p>
            )}
            {limiteRectificacion.noCuadra && (
              <>
                <p className="text-sm font-semibold text-texto-aviso">
                  Este borrador no es un abono total: rectifica {euros(Number(doc.total))} y lo que queda de la factura es{" "}
                  {euros(-limiteRectificacion.restante)}.
                </p>
                <p>
                  {limiteRectificacion.facturaImportada
                    ? `La factura ${limiteRectificacion.factura} es importada y sus líneas no corresponden a su total: al copiarlas en negativo se recalculan con su cantidad y precio y dan otro importe.`
                    : "Las líneas copiadas de la factura no dan el importe que queda por rectificar."}{" "}
                  Si quieres anular la factura entera, corrige las líneas a mano («Editar líneas») hasta{" "}
                  {euros(-limiteRectificacion.restante)} antes de emitir. Si es un abono parcial a propósito, puedes
                  emitirlo así.
                </p>
              </>
            )}
          </div>
        )}
        {esCritica90 && aging && (
          <div
            role="region"
            aria-label="Factura vencida con más de 90 días"
            className="flex flex-wrap items-center gap-esp3 rounded-lg border border-borde-critico-sutil border-l-4 border-l-borde-critico bg-fondo-critico-sutil px-esp4 py-esp3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fondo-critico text-texto-inverso">
              <Icono nombre="alerta" size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-texto-critico">
                Factura vencida con más de 90 días ({aging.diasVencido} días)
              </p>
              <p className="tabular-nums text-xs text-texto-primario">
                Saldo pendiente en riesgo crítico:{" "}
                <strong className="font-semibold text-texto-critico">{euros(pendienteNeto)}</strong>
                {doc.fecha_vencimiento
                  ? ` (vencimiento ${fechaMedia(doc.fecha_vencimiento)}).`
                  : ` (sin vencimiento: se cuentan 30 días desde la emisión, ${fechaMedia(doc.fecha)}).`}
              </p>
            </div>
          </div>
        )}
        {cobrable && !doc.fecha_vencimiento && doc.tipo === "factura" && (
          <p className="text-xs text-texto-aviso">
            Esta factura no tiene fecha de vencimiento: se considera vencida a los 30 días de su emisión.
          </p>
        )}
      </div>

      {(doc.revisar || doc.sin_pdf || doc.origen_datos || doc.archivo_origen) && (
        <RevisionDocumento
          documentoId={doc.id}
          revisar={doc.revisar}
          motivo={doc.motivo_revision}
          sinPdf={doc.sin_pdf}
          origen={doc.origen_datos}
          archivo={doc.archivo_origen}
          enlaceDrive={doc.drive_file_id ? `https://drive.google.com/file/d/${encodeURIComponent(doc.drive_file_id)}/view` : null}
        />
      )}

      <div className="flex flex-col gap-esp6 xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-esp4">
          <div className="flex flex-col gap-1 rounded-xl border border-borde-default bg-fondo-superficie px-esp6 py-esp4">
            <p className="text-xs text-texto-terciario">Cliente</p>
            <p className="text-sm font-medium text-texto-primario">{razonSocial}</p>
            {nif && <p className="text-xs text-texto-secundario">{nif}</p>}
            {direccion && <p className="text-xs text-texto-secundario">{direccion}</p>}
          </div>

          {(campanaVinculada || esBorrador) && (
            <div className="flex items-center gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie px-esp6 py-esp4">
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

          <div className="flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
            <h2 className="text-titulo-panel text-texto-primario">Líneas</h2>
            <div className="flex flex-col divide-y divide-borde-default">
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
            <div className="flex flex-col gap-esp2 rounded-xl border border-borde-default bg-fondo-superficie px-esp6 py-esp4 text-xs text-texto-secundario">
              {doc.texto_forma_pago && <p>Forma de pago: {doc.texto_forma_pago}</p>}
              {doc.iban_cobro && <p>IBAN: {doc.iban_cobro}</p>}
              {doc.motivo_exencion && <p>{doc.motivo_exencion}</p>}
              {doc.notas_cliente && <p>{doc.notas_cliente}</p>}
            </div>
          )}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-esp4 xl:w-[360px]">
          <div className="flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
            <h2 className="text-titulo-panel text-texto-primario">Resumen</h2>
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
                <Fila
                  etiqueta={esRectificativa ? "Devuelto / compensado" : "Cobrado"}
                  valor={euros(Number(estadoCobro.cobrado))}
                />
                <Fila
                  etiqueta={esRectificativa && Number(estadoCobro.pendiente) < 0 ? "Pendiente a favor del cliente" : "Pendiente"}
                  valor={euros(Number(estadoCobro.pendiente))}
                  valorClassName={esCritica90 ? "text-texto-critico" : esVencida ? "text-texto-peligro" : undefined}
                />
              </>
            )}
            {/* Factura con rectificativas: lo que de verdad se debe, sumando los abonos. */}
            {!esRectificativa && estadoCobro && otrasPartes.length > 0 && (
              <>
                <div className="h-px bg-fondo-hover" />
                {otrasPartes.map((r) => (
                  <div key={r.id} className="flex items-center">
                    <span className="flex-1 text-sm text-texto-secundario">
                      Rectificativa{" "}
                      <Link href={`/admin/documentos/${r.id}`} className="font-medium text-texto-marca">
                        {r.numero}
                      </Link>
                    </span>
                    <span className="text-sm font-medium text-texto-primario">{euros(r.total)}</span>
                  </div>
                ))}
                <Fila
                  etiqueta="Saldo neto facturado"
                  valor={euros(Number(doc.total) + otrasPartes.reduce((s, r) => s + r.total, 0))}
                />
                <Fila
                  etiqueta="Pendiente neto"
                  valor={euros(Number(estadoCobro.pendiente) + otrasPartes.reduce((s, r) => s + r.pendiente, 0))}
                  valorClassName={esCritica90 ? "text-texto-critico" : esVencida ? "text-texto-peligro" : undefined}
                />
              </>
            )}
            {esRectificativa && otrasPartes[0] && (
              <>
                <div className="h-px bg-fondo-hover" />
                <div className="flex items-center">
                  <span className="flex-1 text-sm text-texto-secundario">
                    Factura rectificada{" "}
                    <Link href={`/admin/documentos/${otrasPartes[0].id}`} className="font-medium text-texto-marca">
                      {otrasPartes[0].numero}
                    </Link>
                  </span>
                  <span className="text-sm font-medium text-texto-primario">{euros(otrasPartes[0].total)}</span>
                </div>
                <Fila etiqueta="Saldo neto" valor={euros(Number(doc.total) + otrasPartes[0].total)} />
              </>
            )}
          </div>

          {esBorrador && (
            <div className="flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
              <h2 className="text-titulo-panel text-texto-primario">Condiciones</h2>
              <CondicionesDocumento
                documentoId={doc.id}
                tipo={doc.tipo}
                formasPago={formasPago ?? []}
                vencimientoClienteDias={cliente?.dias_vencimiento ?? null}
                vencimientoGeneralDias={empresaBorrador?.vencimiento_defecto_dias ?? 30}
                inicial={{
                  fechaVencimiento: doc.fecha_vencimiento,
                  plazoDias: doc.plazo_dias,
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

          <div id="acciones" className="scroll-mt-esp4 flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
            <h2 className="text-titulo-panel text-texto-primario">Acciones</h2>
            <AccionesDocumento
              documentoId={doc.id}
              tipo={doc.tipo}
              estado={doc.estado}
              etiquetaTipo={etiquetaTipo}
              mailto={mailto}
              compartir={compartir}
              hayDestinatario={destinatarios.length > 0}
              facturaEnBorradorId={facturaEnBorradorId}
              versionEnBorradorId={versionEnBorradorId}
              vencido={vencido}
              avisoEmision={
                limiteRectificacion?.noCuadra
                  ? `Esta rectificativa abona ${euros(Number(doc.total))}, no lo que queda de la factura ${limiteRectificacion.factura} (${euros(-limiteRectificacion.restante)}): no es un abono total.`
                  : null
              }
              facturaImportada={doc.tipo === "factura" && !!doc.origen_datos}
            />
          </div>

          {cobrable && estadoCobro && (
            <div className="flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
              <h2 className="text-titulo-panel text-texto-primario">Cobros</h2>
              <Cobros
                key={`${cobros?.length ?? 0}-${estadoCobro.pendiente}`}
                documentoId={doc.id}
                compartir={esRectificativa ? undefined : compartir}
                esRectificativa={esRectificativa}
                compensables={otrasPartes
                  .filter((r) =>
                    esRectificativa
                      ? Number(estadoCobro.pendiente) < -0.005 && r.pendiente > 0.005
                      : Number(estadoCobro.pendiente) > 0.005 && r.pendiente < -0.005,
                  )
                  .map((r) => ({
                    rectificativaId: esRectificativa ? doc.id : r.id,
                    facturaId: esRectificativa ? r.id : doc.id,
                    numero: r.numero,
                    importe: Math.min(Math.abs(Number(estadoCobro.pendiente)), Math.abs(r.pendiente)),
                  }))}
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
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-esp3 border-t border-borde-default bg-fondo-superficie px-esp4 pt-esp3 pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-elevado xl:hidden print:hidden">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-texto-terciario">Total</p>
            <p className="text-lg font-semibold leading-tight text-texto-primario">{euros(Number(doc.total))}</p>
          </div>
          <a
            href="#acciones"
            className="inline-flex h-11 items-center rounded-md bg-fondo-marca px-esp5 text-sm font-medium text-texto-sobre-marca transition-colors duration-rapida ease-suave hover:bg-fondo-marca-hover active:scale-press"
          >
            Revisar y emitir
          </a>
        </div>
      )}
    </div>
    </ProveedorCondiciones>
  );
}

function Fila({ etiqueta, valor, valorClassName }: { etiqueta: string; valor: string; valorClassName?: string }) {
  return (
    <div className="flex items-center">
      <span className="flex-1 text-sm text-texto-secundario">{etiqueta}</span>
      <span className={`tabular-nums text-sm font-medium ${valorClassName ?? "text-texto-primario"}`}>{valor}</span>
    </div>
  );
}
