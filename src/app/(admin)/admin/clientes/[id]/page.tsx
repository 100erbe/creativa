import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TarjetaKpi } from "@/components/ui/tarjeta-kpi";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { euros, fechaMedia } from "@/lib/formato";
import { ETIQUETA_ESTADO_DOC, ETIQUETA_TIPO } from "@/lib/documentos";
import { ETIQUETA_REGIMEN, ETIQUETA_TIPO_CLIENTE } from "@/lib/clientes";
import { componerDireccion } from "@/lib/direccion";
import { ETIQUETA_ESTADO_CAMPANA } from "@/lib/etiquetas";
import { BotonActivo, BotonEliminarCliente, Contactos } from "./controles";

export const dynamic = "force-dynamic";

export default async function PaginaCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clienteId = Number(id);
  if (!Number.isInteger(clienteId)) notFound();

  const supabase = await createClient();

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
      .order("id", { ascending: false })
      .limit(8),
    supabase
      .from("documentos")
      .select("total")
      .eq("cliente_id", clienteId)
      .in("tipo", ["factura", "rectificativa"])
      .neq("estado", "borrador"),
    supabase.from("v_estado_cobro").select("pendiente, estado_cobro").eq("cliente_id", clienteId),
    supabase
      .from("campanas")
      .select("id, nombre, estado, fecha_inicio")
      .eq("cliente_id", clienteId)
      .order("fecha_inicio", { ascending: false }),
    supabase
      .from("tarifas_cliente")
      .select("id, precio_fabricacion, precio_instalacion, productos(nombre), formatos(nombre)")
      .eq("cliente_id", clienteId),
  ]);

  const facturado = (facturas ?? []).reduce((s, f) => s + Number(f.total), 0);
  const pendiente = (cobros ?? []).reduce((s, c) => s + Number(c.pendiente), 0);
  const vencidas = (cobros ?? []).filter((c) => c.estado_cobro === "vencida").length;

  const direccion = componerDireccion({
    direccion: cliente.direccion,
    codigoPostal: cliente.codigo_postal,
    municipio: cliente.municipio,
    provincia: cliente.provincia,
  });

  return (
    <div className="flex flex-col gap-esp6">
      <div className="flex flex-col gap-esp2">
        <Link
          href="/admin/clientes"
          className="flex w-fit items-center gap-esp1 text-sm text-texto-secundario hover:text-texto-primario"
        >
          <Icono nombre="atras" size={16} />
          Clientes
        </Link>
        <div className="flex flex-wrap items-center gap-esp3">
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-2xl font-semibold text-texto-primario">{cliente.razon_social}</h1>
            <p className="text-sm text-texto-secundario">
              {cliente.codigo} · {ETIQUETA_TIPO_CLIENTE[cliente.tipo_cliente] ?? cliente.tipo_cliente}
              {grupo ? ` · ${grupo.nombre}` : ""}
            </p>
          </div>
          {!cliente.activo && <Insignia tono="neutro">Inactivo</Insignia>}
          <Link href={`/admin/clientes/${clienteId}/editar`}>
            <Boton variante="secundario">Editar</Boton>
          </Link>
          {cliente.activo && (
            <>
              <Link href={`/admin/campanas/nueva?cliente=${clienteId}`} className="hidden sm:block">
                <Boton variante="secundario">Nueva campaña</Boton>
              </Link>
              <Link href={`/admin/documentos/nuevo?cliente=${clienteId}`}>
                <Boton>
                  <Icono nombre="mas" size={16} />
                  Nuevo documento
                </Boton>
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-esp4 [&>*]:min-w-[150px]">
        <TarjetaKpi etiqueta="Facturado (total)" valor={euros(facturado)} detalle={`${(facturas ?? []).length} facturas`} />
        <TarjetaKpi
          etiqueta="Pendiente de cobro"
          valor={euros(pendiente)}
          detalle={vencidas > 0 ? `${vencidas} vencidas` : "al día"}
          colorDetalle={vencidas > 0 ? "text-texto-peligro" : "text-texto-exito"}
        />
        <TarjetaKpi etiqueta="Campañas" valor={String((campanas ?? []).length)} />
        <TarjetaKpi
          etiqueta="Descuento habitual"
          valor={`${Number(cliente.descuento_habitual ?? 0)} %`}
        />
      </div>

      <div className="flex flex-col gap-esp6 xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-esp4">
          <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp5 md:px-esp6">
            <h2 className="text-base font-semibold text-texto-primario">Documentos recientes</h2>
            <div className="flex flex-col divide-y divide-fondo-hover">
              {(documentos ?? []).map((d) => (
                <Link key={d.id} href={`/admin/documentos/${d.id}`} className="flex items-center gap-esp3 py-esp3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-texto-primario">
                      {d.numero_completo ?? `${ETIQUETA_TIPO[d.tipo] ?? d.tipo} (borrador)`}
                    </p>
                    <p className="text-xs text-texto-terciario">
                      {ETIQUETA_TIPO[d.tipo] ?? d.tipo} · {fechaMedia(d.fecha)}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-sm font-medium text-texto-primario">{euros(Number(d.total))}</span>
                  <Insignia tono={TONO_POR_ESTADO[d.estado] ?? "neutro"}>
                    {ETIQUETA_ESTADO_DOC[d.estado] ?? d.estado}
                  </Insignia>
                </Link>
              ))}
              {(documentos ?? []).length === 0 && (
                <p className="py-esp3 text-sm text-texto-terciario">Este cliente aún no tiene documentos.</p>
              )}
            </div>
            <Link
              href={`/admin/documentos?cliente=${clienteId}`}
              className="text-sm font-medium text-texto-marca"
            >
              Ver todos los documentos
            </Link>
          </div>

          {(campanas ?? []).length > 0 && (
            <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp5 md:px-esp6">
              <h2 className="text-base font-semibold text-texto-primario">Campañas</h2>
              <div className="flex flex-col divide-y divide-fondo-hover">
                {(campanas ?? []).map((c) => (
                  <Link key={c.id} href={`/admin/campanas/${c.id}`} className="flex items-center gap-esp3 py-esp3">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-texto-primario">{c.nombre}</span>
                    <Insignia tono={TONO_POR_ESTADO[c.estado] ?? "neutro"}>{ETIQUETA_ESTADO_CAMPANA[c.estado] ?? c.estado}</Insignia>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {(tarifas ?? []).length > 0 && (
            <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp5 md:px-esp6">
              <h2 className="text-base font-semibold text-texto-primario">Tarifas especiales</h2>
              <div className="flex flex-col divide-y divide-fondo-hover">
                {(tarifas ?? []).map((t) => {
                  const producto = Array.isArray(t.productos) ? t.productos[0] : t.productos;
                  const formato = Array.isArray(t.formatos) ? t.formatos[0] : t.formatos;
                  return (
                    <div key={t.id} className="flex items-center gap-esp3 py-esp3 text-sm">
                      <span className="flex-1 text-texto-primario">
                        {producto?.nombre ?? "Producto"}
                        {formato ? ` · ${formato.nombre}` : ""}
                      </span>
                      <span className="text-texto-secundario">
                        {t.precio_fabricacion != null ? `fab. ${euros(Number(t.precio_fabricacion))}` : ""}
                        {t.precio_fabricacion != null && t.precio_instalacion != null ? " · " : ""}
                        {t.precio_instalacion != null ? `inst. ${euros(Number(t.precio_instalacion))}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-esp4 xl:w-[360px]">
          <div className="flex flex-col gap-esp2 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp5 md:px-esp6">
            <h2 className="text-base font-semibold text-texto-primario">Datos</h2>
            <Dato etiqueta="Documento" valor={cliente.numero_documento ? `${cliente.tipo_documento} ${cliente.numero_documento}` : null} />
            <Dato etiqueta="Dirección" valor={direccion || null} />
            <Dato etiqueta="País" valor={cliente.pais?.trim() || null} />
            <Dato etiqueta="Email facturación" valor={cliente.email_facturacion} />
            <Dato etiqueta="Teléfono" valor={cliente.telefono} />
            <Dato etiqueta="Web" valor={cliente.web} />
            <Dato
              etiqueta="IVA"
              valor={`${ETIQUETA_REGIMEN[cliente.regimen_iva] ?? cliente.regimen_iva}${cliente.motivo_exencion ? ` — ${cliente.motivo_exencion}` : ""}`}
            />
            <Dato etiqueta="Forma de pago" valor={formaPago?.nombre ?? null} />
            <Dato etiqueta="Cuenta de cobro" valor={cuenta ? `${cuenta.banco} · ${cuenta.iban}` : null} />
            {cliente.notas && (
              <p className="mt-esp2 rounded-md bg-fondo-sutil px-esp3 py-esp2 text-xs text-texto-secundario">
                {cliente.notas}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp5 md:px-esp6">
            <h2 className="text-base font-semibold text-texto-primario">Contactos</h2>
            <Contactos clienteId={clienteId} contactos={contactos ?? []} />
          </div>

          <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp5 md:px-esp6">
            <h2 className="text-base font-semibold text-texto-primario">Estado</h2>
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

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  if (!valor) return null;
  return (
    <div className="flex gap-esp3 text-sm">
      <span className="w-[96px] shrink-0 text-texto-terciario sm:w-[110px]">{etiqueta}</span>
      <span className="min-w-0 flex-1 break-words text-texto-primario">{valor}</span>
    </div>
  );
}
