import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { Icono } from "@/components/ui/iconos";
import { Insignia } from "@/components/ui/insignia";
import { clasesBoton } from "@/components/ui/boton";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { euros, fechaMedia } from "@/lib/formato";
import {
  BUCKET_TICKETS,
  ETIQUETA_ESTADO_GASTO,
  ETIQUETA_FORMA_PAGO_GASTO,
  ETIQUETA_TIPO_GASTO,
  TONO_ESTADO_GASTO,
  cuotaDeducible,
  etiquetaConceptoAeat,
  etiquetaTipoIva,
} from "@/lib/gastos";
import { LecturaTicketResumen } from "@/components/gastos/lectura-ticket";
import { ControlesGasto } from "./controles";

export const dynamic = "force-dynamic";

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-texto-terciario">{etiqueta}</span>
      <span className="text-sm text-texto-primario">{children || "—"}</span>
    </div>
  );
}

export default async function PaginaGasto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await exigirAdmin();
  const supabase = await createClient();

  const { data: gasto } = await supabase
    .from("gastos")
    .select("*, categorias_gasto(nombre), usuarios!gastos_usuario_id_fkey(nombre, apellidos)")
    .eq("id", Number(id))
    .maybeSingle();
  if (!gasto) notFound();

  const firma = gasto.ticket_path
    ? await supabase.storage.from(BUCKET_TICKETS).createSignedUrl(gasto.ticket_path, 600)
    : null;
  const urlTicket = firma?.data?.signedUrl ?? null;
  const esPdf = gasto.ticket_path?.endsWith(".pdf") ?? false;
  const deducible = gasto.tipo === "deducible";
  const responsable = gasto.usuarios
    ? [gasto.usuarios.nombre, gasto.usuarios.apellidos].filter(Boolean).join(" ")
    : null;

  return (
    <div className="flex max-w-3xl flex-col gap-esp5">
      <CabeceraPagina
        antes={
          <Link
            href="/admin/gastos"
            className="hidden w-fit items-center gap-esp1 text-sm text-texto-secundario hover:text-texto-primario md:flex"
          >
            <Icono nombre="atras" size={16} />
            Gastos
          </Link>
        }
        titulo={
          <span className="flex flex-wrap items-center gap-esp3">
            {gasto.codigo}
            <Insignia tono={TONO_ESTADO_GASTO[gasto.estado]}>{ETIQUETA_ESTADO_GASTO[gasto.estado]}</Insignia>
            <Insignia tono={deducible ? "marca" : "neutro"}>{ETIQUETA_TIPO_GASTO[gasto.tipo]}</Insignia>
          </span>
        }
        subtitulo={gasto.concepto}
        acciones={
          gasto.estado !== "reembolsado" ? (
            <Link href={`/admin/gastos/${gasto.id}/editar`} className={clasesBoton("secundario")}>
              Editar
            </Link>
          ) : undefined
        }
      />

      {gasto.estado === "rechazado" && gasto.motivo_rechazo && (
        <div className="rounded-md border border-borde-peligro-sutil bg-fondo-peligro-sutil px-esp4 py-esp3 text-sm text-texto-peligro">
          <strong>Rechazado:</strong> {gasto.motivo_rechazo}
        </div>
      )}

      <div className="grid grid-cols-2 gap-esp4 rounded-xl border border-borde-default bg-fondo-superficie px-esp5 py-esp5 md:grid-cols-3">
        <Dato etiqueta="Fecha">{fechaMedia(gasto.fecha)}</Dato>
        <Dato etiqueta="Categoría">{gasto.categorias_gasto?.nombre}</Dato>
        <Dato etiqueta="Responsable">{responsable}</Dato>
        <Dato etiqueta="Forma de pago">{ETIQUETA_FORMA_PAGO_GASTO[gasto.forma_pago]}</Dato>
        <Dato etiqueta="Total">
          <strong>{euros(Number(gasto.total))}</strong>
        </Dato>
        {deducible ? (
          <>
            <Dato etiqueta="Tipo de IVA">{gasto.iva_pct != null ? etiquetaTipoIva(Number(gasto.iva_pct)) : null}</Dato>
            <Dato etiqueta="Base imponible">{gasto.base_imponible != null ? euros(Number(gasto.base_imponible)) : null}</Dato>
            <Dato etiqueta="Cuota IVA">{gasto.cuota_iva != null ? euros(Number(gasto.cuota_iva)) : null}</Dato>
            <Dato etiqueta="Proveedor">{gasto.proveedor}</Dato>
            <Dato etiqueta="NIF proveedor">{gasto.nif_proveedor}</Dato>
            <Dato etiqueta="Nº de factura">{gasto.numero_factura}</Dato>
            <Dato etiqueta="Concepto fiscal">{etiquetaConceptoAeat(gasto.concepto_aeat) ?? "Sin clasificar"}</Dato>
            <Dato etiqueta="Retención IRPF">
              {Number(gasto.retencion_pct) > 0
                ? `${Number(gasto.retencion_pct)} % · ${euros(Number(gasto.importe_retencion))} (a pagar ${euros(Number(gasto.total) - Number(gasto.importe_retencion))})`
                : "Sin retención"}
            </Dato>
            <Dato etiqueta="IVA deducible">
              {Number(gasto.pct_deducible_iva)} %
              {Number(gasto.pct_deducible_iva) < 100 ? ` · ${euros(cuotaDeducible(gasto.cuota_iva, gasto.pct_deducible_iva))}` : ""}
              {gasto.bien_inversion ? " · Bien de inversión" : ""}
            </Dato>
          </>
        ) : (
          <Dato etiqueta="IVA">No deducible</Dato>
        )}
        {gasto.notas && (
          <div className="col-span-2 md:col-span-3">
            <Dato etiqueta="Notas">{gasto.notas}</Dato>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie px-esp5 py-esp5">
        <h2 className="text-titulo-panel text-texto-primario">{deducible ? "Factura" : "Ticket"}</h2>
        {urlTicket ? (
          esPdf ? (
            <a href={urlTicket} target="_blank" rel="noreferrer" className="text-sm font-medium text-texto-marca">
              Abrir PDF 📄
            </a>
          ) : (
            <a href={urlTicket} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlTicket} alt="Ticket del gasto" className="max-h-96 rounded-md border border-borde-default" />
            </a>
          )
        ) : (
          <p className="text-sm text-texto-aviso">⚠ Falta {deducible ? "la factura" : "el ticket"}.</p>
        )}
        <LecturaTicketResumen
          gastoId={gasto.id}
          tipo={gasto.tipo}
          datos={gasto.datos_ticket}
          editable={gasto.estado !== "reembolsado"}
        />
      </div>

      <ControlesGasto
        id={gasto.id}
        estado={gasto.estado}
        puedeAprobar={!deducible || !!gasto.ticket_path}
      />
    </div>
  );
}
