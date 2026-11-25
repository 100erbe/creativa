import Link from "next/link";
import { BotonAvisos } from "@/components/ui/boton-avisos";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TarjetaKpi } from "@/components/ui/tarjeta-kpi";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { clasesBoton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { euros, fechaMedia } from "@/lib/formato";
import { etiquetaReglaVencimiento, reglaVencimiento } from "@/lib/documentos";
import { resumirCobrosPendientes } from "@/lib/cobros-pendientes";
import { ETIQUETA_REGIMEN, ETIQUETA_TIPO_CLIENTE, inicialesCliente } from "@/lib/clientes";
import { componerDireccion } from "@/lib/direccion";
import { ETIQUETA_ESTADO_CAMPANA } from "@/lib/etiquetas";
import { BotonActivo, BotonEliminarCliente, Contactos } from "./controles";
import { cargarEstadoCuenta, mensajeReclamacion, nombreArchivoEstadoCuenta, nombreArchivoFactura } from "@/lib/estado-cuenta-datos";
import { cuentaConectada } from "@/lib/gmail";
import { ReclamarImpagadas } from "./reclamar-impagadas";
import { ProductosVendidos, type ProductoVendidoItem } from "./productos-vendidos";
import { DocumentosRecientes } from "./documentos-recientes";
import { EnlaceLista } from "@/components/ui/enlace-lista";

export const dynamic = "force-dynamic";

function normalizarWeb(url: string): string | null {
  const limpia = url.trim();
  if (!limpia || /^javascript:/i.test(limpia)) return null;
  return /^https?:\/\//i.test(limpia) ? limpia : `https://${limpia}`;
}

export default async function PaginaCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clienteId = Number(id);
  if (!Number.isInteger(clienteId)) notFound();

  const supabase = await createClient();
  const hoy = new Date();

  const { data: cliente } = await supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle();
  if (!cliente) notFound();

  const [
    { data: grupo },
    { data: formaPago },
    { data: cuenta },
    { data: contactos },
    { data: documentos },
    { data: facturas },
    { data: cobros },
    { data: campanas },
    { data: tarifas },
    estadoCuenta,
    gmail,
    { data: reclamaciones },
    { data: facturasConLineas },
    { data: empresa },
  ] = await Promise.all([
    cliente.grupo_id
      ? supabase.from("grupos_empresariales").select("nombre").eq("id", cliente.grupo_id).maybeSingle()
      : Promise.resolve({ data: null }),
    cliente.forma_pago_id
      ? supabase.from("formas_pago").select("nombre").eq("id", cliente.forma_pago_id).maybeSingle()
      : Promise.resolve({ data: null }),
    cliente.cuenta_cobro_id
      ? supabase.from("cuentas_bancarias").select("banco, iban").eq("id", cliente.cuenta_cobro_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("contactos_cliente")
      .select("id, nombre, cargo, email, telefono, recibe_facturas")
      .eq("cliente_id", clienteId)
      .order("id"),
    supabase
      .from("documentos")
      .select("id, tipo, estado, numero_completo, fecha, total")
      .eq("cliente_id", clienteId)
      .order("fecha", { ascending: false })
      .order("id", { ascending: false }),
    supabase
      .from("documentos")
      .select("id, total, estado, documento_origen_id")
      .eq("cliente_id", clienteId)
      .in("tipo", ["factura", "rectificativa"])
      .neq("estado", "borrador"),
    supabase
      .from("v_estado_cobro")
      .select("id, tipo, fecha, numero_completo, pendiente, estado_cobro, fecha_vencimiento")
      .eq("cliente_id", clienteId),
    supabase
      .from("campanas")
      .select("id, nombre, estado, fecha_inicio")
      .eq("cliente_id", clienteId)
      .order("fecha_inicio", { ascending: false }),
    supabase
      .from("tarifas_cliente")
      .select("id, precio_fabricacion, precio_instalacion, productos(nombre), formatos(nombre)")
      .eq("cliente_id", clienteId),
    cargarEstadoCuenta(supabase, clienteId),
    cuentaConectada(),
    supabase
      .from("reclamaciones")
      .select("id, creada_en, documentos, total_insoluto, destinatarios, remitente")
      .eq("cliente_id", clienteId)
      .order("creada_en", { ascending: false })
      .limit(5),
    supabase
      .from("documentos")
      .select(
        "id, numero_completo, fecha, lineas_documento(id, orden, descripcion, artista, cantidad, unidad, importe)",
      )
      .eq("cliente_id", clienteId)
      .eq("tipo", "factura")
      .neq("estado", "borrador")
      .neq("estado", "anulado")
      .order("fecha", { ascending: false })
      .order("id", { ascending: false }),
    supabase.from("empresa").select("vencimiento_defecto_dias, vencimiento_defecto_dia_mes").eq("id", 1).maybeSingle(),
  ]);
  const productosVendidos: ProductoVendidoItem[] = (facturasConLineas ?? []).flatMap((doc) =>
    [...(doc.lineas_documento ?? [])]
      .filter((l) => Number(l.importe) > 0)
      .sort((a, b) => a.orden - b.orden || a.id - b.id)
      .map((l) => ({
        id: l.id,
        documentoId: doc.id,
        numeroDocumento: doc.numero_completo,
        fecha: doc.fecha,
        descripcion: l.descripcion,
        artista: l.artista,
        cantidad: Number(l.cantidad),
        unidad: l.unidad,
        importe: Number(l.importe),
      })),
  );
  const insolutas = estadoCuenta?.estado.insolutas ?? [];
  const textoReclamacion = estadoCuenta ? mensajeReclamacion(estadoCuenta) : null;

  // Facturado: sin documentos anulados. Pendiente: mismas reglas que Cobros y el listado de clientes
  // (sin anulados y con los abonos descontados de su factura).
  const facturasVigentes = (facturas ?? []).filter((f) => f.estado !== "anulado");
  const facturado = facturasVigentes.reduce((s, f) => s + Number(f.total), 0);
  const resumenCobros = resumirCobrosPendientes(cobros ?? [], facturas ?? [], hoy);
  const pendiente = resumenCobros.totalPendiente;
  const vencidas = resumenCobros.vencidas;
  const criticas90 = resumenCobros.criticas90;

  // Vencidas sin cobrar: misma regla que el estado de cuenta (vencimiento ya pasado, ≥ 1 €).
  const sumaInsoluto = estadoCuenta?.estado.totalInsoluto ?? 0;
  const maxDiasVencido = insolutas.reduce((m, l) => Math.max(m, l.diasVencida), 0);

  const direccion = componerDireccion({
    direccion: cliente.direccion,
    codigoPostal: cliente.codigo_postal,
    municipio: cliente.municipio,
    provincia: cliente.provincia,
  });
  const webUrl = cliente.web ? normalizarWeb(cliente.web) : null;

  return (
    <div className="flex flex-col gap-esp6">
      <div className="flex flex-col gap-esp3">
        <EnlaceLista
          href="/admin/clientes"
          className="group hidden w-fit items-center gap-esp1 text-sm text-texto-secundario transition-colors duration-rapida ease-suave hover:text-texto-primario md:flex"
        >
          <Icono nombre="atras" size={16} className="transition-transform duration-rapida ease-salida group-hover:-translate-x-0.5" />
          Clientes
        </EnlaceLista>

        <div className="flex flex-col gap-esp4 rounded-xl border border-borde-default bg-fondo-superficie p-esp4 md:p-esp5 xl:flex-row xl:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-esp3 sm:items-center">
            <div
              aria-hidden="true"
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${
                insolutas.length > 0
                  ? "bg-fondo-critico text-texto-inverso"
                  : "border border-borde-marca bg-fondo-marca-sutil text-texto-marca"
              }`}
            >
              {inicialesCliente(cliente.razon_social)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-esp2">
                <h1 className="break-words text-2xl font-bold text-texto-primario md:text-titulo-pagina">
                  {cliente.razon_social}
                </h1>
                {!cliente.activo ? (
                  <Insignia tono="neutro">Inactivo</Insignia>
                ) : (
                  <Insignia tono="exito">Activo</Insignia>
                )}
                {insolutas.length > 0 && (
                  <Insignia tono="critico" solido>
                    {criticas90.length > 0 ? "90+ días" : "Vencida"} · {maxDiasVencido}d
                  </Insignia>
                )}
              </div>
              <p className="mt-0.5 text-sm text-texto-secundario">
                {cliente.codigo} · {ETIQUETA_TIPO_CLIENTE[cliente.tipo_cliente] ?? cliente.tipo_cliente}
                {grupo ? ` · ${grupo.nombre}` : ""}
                {cliente.nombre_comercial && cliente.nombre_comercial !== cliente.razon_social
                  ? ` · Com.: ${cliente.nombre_comercial}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-esp2 xl:max-w-[55%] xl:justify-end">
            <BotonAvisos />
            <Link href={`/admin/clientes/${clienteId}/editar`} className={clasesBoton("secundario", "m")}>Editar</Link>
            {(estadoCuenta?.estado.lineas.length ?? 0) > 0 && (
              <Link href={`/admin/clientes/${clienteId}/estado-cuenta`} className={clasesBoton("secundario", "m")}>
                <Icono nombre="documentos" size={16} />
                Estado de cuenta
              </Link>
            )}
            {estadoCuenta && textoReclamacion && insolutas.length > 0 && (
              <ReclamarImpagadas
                clienteId={clienteId}
                razonSocial={cliente.razon_social}
                insolutas={insolutas.map((l) => ({
                  id: l.id,
                  numero: l.numero,
                  fecha: l.fecha,
                  saldo: l.saldo,
                  vencimiento: l.vencimiento,
                  archivo: nombreArchivoFactura(l.tipo, l.numero, cliente.razon_social, l.concepto),
                }))}
                totalAReclamar={estadoCuenta.estado.totalAReclamar}
                archivoEstado={nombreArchivoEstadoCuenta(cliente.razon_social, estadoCuenta.estado.fecha)}
                destinatarios={estadoCuenta.destinatarios}
                asunto={textoReclamacion.asunto}
                cuerpo={textoReclamacion.cuerpo}
                gmail={gmail?.email ?? null}
              />
            )}
            {cliente.activo && (
              <>
                <Link href={`/admin/campanas/nueva?cliente=${clienteId}`} className={clasesBoton("secundario", "m")}>Nueva campaña</Link>
                <Link href={`/admin/documentos/nuevo?cliente=${clienteId}`} className={clasesBoton("primario", "m")}>
                  <Icono nombre="mas" size={16} />
                  Nuevo documento
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Banner de facturas vencidas (misma regla que el estado de cuenta) */}
      {insolutas.length > 0 && (
        <div
          role="region"
          aria-label="Alerta de facturas vencidas"
          className="flex flex-wrap items-center gap-esp3 rounded-lg border border-borde-critico-sutil border-l-4 border-l-borde-critico bg-fondo-critico-sutil px-esp4 py-esp3"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fondo-critico text-texto-inverso">
            <Icono nombre="alerta" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-texto-critico">
              {insolutas.length} factura{insolutas.length === 1 ? "" : "s"} vencida
              {insolutas.length === 1 ? "" : "s"} sin cobrar
            </p>
            <p className="tabular-nums text-xs text-texto-primario">
              Saldo vencido: <strong className="text-texto-critico">{euros(sumaInsoluto)}</strong> (la más antigua, vencida
              hace {maxDiasVencido} días).
            </p>
          </div>
          <Link href={`/admin/clientes/${clienteId}/estado-cuenta`} className={clasesBoton("critico", "s")}>
            Ver estado de cuenta
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-esp3 md:gap-esp4 xl:grid-cols-4">
        <TarjetaKpi
          etiqueta="Facturado (total)"
          valor={euros(facturado)}
          detalle={`${facturasVigentes.length} factura${facturasVigentes.length === 1 ? "" : "s"}`}
          href={`/admin/documentos?cliente=${clienteId}&tipo=factura`}
        />
        <TarjetaKpi
          etiqueta="Pendiente de cobro"
          valor={euros(pendiente)}
          detalle={
            criticas90.length > 0
              ? `${criticas90.length} con 90+ días`
              : vencidas.length > 0
                ? `${vencidas.length} vencida${vencidas.length === 1 ? "" : "s"}`
                : "al día"
          }
          colorDetalle={
            criticas90.length > 0
              ? "text-texto-critico font-medium"
              : vencidas.length > 0
                ? "text-texto-peligro"
                : "text-texto-exito"
          }
          tono={criticas90.length > 0 ? "critico" : vencidas.length > 0 ? "aviso" : "default"}
          href={insolutas.length > 0 ? `/admin/clientes/${clienteId}/estado-cuenta` : `/admin/documentos?cliente=${clienteId}&cobro=pendiente`}
        />
        <TarjetaKpi etiqueta="Campañas" valor={String((campanas ?? []).length)} />
        <TarjetaKpi etiqueta="Descuento habitual" valor={`${Number(cliente.descuento_habitual ?? 0)} %`} />
      </div>

      <div className="flex flex-col gap-esp6 xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-esp4">
          <DocumentosRecientes
            documentos={(documentos ?? []).map((d) => ({ ...d, total: Number(d.total) }))}
          />

          <ProductosVendidos items={productosVendidos} />

          {(campanas ?? []).length > 0 && (
            <div className="flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie px-esp4 py-esp5 md:px-esp6">
              <h2 className="text-titulo-panel text-texto-primario">Campañas</h2>
              <div className="flex flex-col divide-y divide-borde-default">
                {(campanas ?? []).map((c) => (
                  <Link
                    key={c.id}
                    href={`/admin/campanas/${c.id}`}
                    className="-mx-esp2 flex items-center gap-esp3 rounded-md px-esp2 py-esp3 transition-colors duration-rapida ease-suave hover:bg-fondo-sutil"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-texto-primario">{c.nombre}</p>
                      {c.fecha_inicio && (
                        <p className="tabular-nums text-xs text-texto-terciario">Inicio: {fechaMedia(c.fecha_inicio)}</p>
                      )}
                    </div>
                    <Insignia tono={TONO_POR_ESTADO[c.estado] ?? "neutro"}>
                      {ETIQUETA_ESTADO_CAMPANA[c.estado] ?? c.estado}
                    </Insignia>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {(tarifas ?? []).length > 0 && (
            <div className="flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie px-esp4 py-esp5 md:px-esp6">
              <h2 className="text-titulo-panel text-texto-primario">Tarifas especiales</h2>
              <div className="flex flex-col divide-y divide-borde-default">
                {(tarifas ?? []).map((t) => {
                  const producto = Array.isArray(t.productos) ? t.productos[0] : t.productos;
                  const formato = Array.isArray(t.formatos) ? t.formatos[0] : t.formatos;
                  return (
                    <div key={t.id} className="flex flex-wrap items-center justify-between gap-esp2 py-esp3 text-sm">
                      <span className="min-w-0 flex-1 font-medium text-texto-primario">
                        {producto?.nombre ?? "Producto"}
                        {formato ? <span className="font-normal text-texto-terciario"> · {formato.nombre}</span> : ""}
                      </span>
                      <div className="tabular-nums flex flex-wrap gap-esp2 text-xs text-texto-secundario">
                        {t.precio_fabricacion != null && (
                          <span className="rounded bg-fondo-sutil px-2 py-0.5">
                            Fab. <strong className="text-texto-primario">{euros(Number(t.precio_fabricacion))}</strong>
                          </span>
                        )}
                        {t.precio_instalacion != null && (
                          <span className="rounded bg-fondo-sutil px-2 py-0.5">
                            Inst. <strong className="text-texto-primario">{euros(Number(t.precio_instalacion))}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-esp4 xl:w-[360px]">
          <div className="flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie px-esp4 py-esp5 md:px-esp6">
            <h2 className="text-titulo-panel text-texto-primario">Ficha fiscal y comercial</h2>
            <dl className="grid grid-cols-1 gap-esp3 sm:grid-cols-2 xl:grid-cols-1">
              <Dato
                etiqueta="Documento"
                valor={cliente.numero_documento ? `${cliente.tipo_documento} ${cliente.numero_documento}` : null}
                tabular
              />
              <Dato etiqueta="Dirección" valor={direccion || null} />
              <Dato etiqueta="País" valor={cliente.pais?.trim() || null} />
              <Dato
                etiqueta="Email facturación"
                valor={cliente.email_facturacion}
                href={cliente.email_facturacion ? `mailto:${cliente.email_facturacion}` : undefined}
              />
              <Dato
                etiqueta="Teléfono"
                valor={cliente.telefono}
                href={cliente.telefono ? `tel:${cliente.telefono.replace(/\s+/g, "")}` : undefined}
                tabular
              />
              <Dato etiqueta="Web" valor={cliente.web} href={webUrl ?? undefined} externo />
              <Dato
                etiqueta="Régimen de IVA"
                valor={`${ETIQUETA_REGIMEN[cliente.regimen_iva] ?? cliente.regimen_iva}${cliente.motivo_exencion ? ` — ${cliente.motivo_exencion}` : ""}`}
              />
              <Dato etiqueta="Forma de pago" valor={formaPago?.nombre ?? null} />
              <Dato
                etiqueta="Vencimiento por defecto"
                valor={
                  (() => {
                    const propia = reglaVencimiento(cliente.dias_vencimiento, cliente.vencimiento_dia_mes);
                    if (propia) return etiquetaReglaVencimiento(propia);
                    const general = reglaVencimiento(
                      empresa?.vencimiento_defecto_dias ?? 30,
                      empresa?.vencimiento_defecto_dia_mes,
                    ) ?? { dias: 30 };
                    return `${etiquetaReglaVencimiento(general)} (general)`;
                  })()
                }
              />
              <Dato
                etiqueta="Cuenta de cobro"
                valor={cuenta ? `${cuenta.banco} · ${cuenta.iban}` : null}
                mono
              />
            </dl>
            {cliente.notas && (
              <div className="rounded-md border border-borde-default bg-fondo-sutil/70 px-esp3 py-esp2 text-xs text-texto-secundario">
                <p className="mb-0.5 text-etiqueta uppercase text-texto-secundario">Notas</p>
                <p className="whitespace-pre-line">{cliente.notas}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie px-esp4 py-esp5 md:px-esp6">
            <h2 className="text-titulo-panel text-texto-primario">Contactos</h2>
            <Contactos clienteId={clienteId} contactos={contactos ?? []} />
          </div>

          {(reclamaciones ?? []).length > 0 && (
            <div className="flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie px-esp4 py-esp5 md:px-esp6">
              <h2 className="text-titulo-panel text-texto-primario">Reclamaciones de impagados</h2>
              <ul className="flex flex-col divide-y divide-borde-default">
                {(reclamaciones ?? []).map((r) => (
                  <li key={r.id} className="flex flex-col gap-0.5 py-esp2 text-sm">
                    <div className="flex items-center justify-between gap-esp2">
                      <span className="font-medium text-texto-primario">{fechaMedia(r.creada_en)}</span>
                      <span className="tabular-nums font-medium text-texto-critico">{euros(Number(r.total_insoluto))}</span>
                    </div>
                    <p className="text-xs text-texto-terciario">
                      {r.documentos.length} factura{r.documentos.length === 1 ? "" : "s"} · para {r.destinatarios.join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-texto-terciario">
                Borradores creados en Gmail ({(reclamaciones ?? [])[0]?.remitente}) desde la app.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie px-esp4 py-esp5 md:px-esp6">
            <h2 className="text-titulo-panel text-texto-primario">Estado de la cuenta</h2>
            <BotonActivo clienteId={clienteId} activo={cliente.activo} />
            <BotonEliminarCliente
              clienteId={clienteId}
              puedeEliminar={(documentos ?? []).length === 0 && (campanas ?? []).length === 0}
            />
            <p className="text-xs text-texto-terciario">
              Los clientes con documentos no se pueden eliminar; al desactivarlos dejan de aparecer al crear
              documentos nuevos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  href,
  externo,
  tabular,
  mono,
}: {
  etiqueta: string;
  valor: string | null | undefined;
  href?: string;
  externo?: boolean;
  tabular?: boolean;
  mono?: boolean;
}) {
  if (!valor) return null;
  const claseValor = `mt-0.5 block break-words text-sm ${
    mono ? "font-mono text-xs tabular-nums" : tabular ? "tabular-nums" : ""
  }`;
  return (
    <div className="min-w-0">
      <dt className="text-etiqueta uppercase text-texto-secundario">{etiqueta}</dt>
      <dd>
        {href ? (
          <a
            href={href}
            target={externo ? "_blank" : undefined}
            rel={externo ? "noreferrer" : undefined}
            className={`${claseValor} font-medium text-texto-marca hover:underline`}
          >
            {valor}
          </a>
        ) : (
          <span className={`${claseValor} text-texto-primario`}>{valor}</span>
        )}
      </dd>
    </div>
  );
}
