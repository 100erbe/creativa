import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { TarjetaKpi } from "@/components/ui/tarjeta-kpi";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { euros, fechaLarga, fechaMedia } from "@/lib/formato";
import { saludo } from "@/lib/saludo";
import { clasificarAgingCobro, ETIQUETA_ESTADO_DOC, ETIQUETA_TIPO } from "@/lib/documentos";

export const dynamic = "force-dynamic";

export default async function PaginaPanel() {
  const supabase = await createClient();
  const usuario = await obtenerUsuarioActual();
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);

  const resultados = await Promise.all([
    supabase
      .from("documentos")
      .select("total")
      .in("tipo", ["factura", "rectificativa"])
      .neq("estado", "borrador")
      .gte("fecha", inicioMes),
    supabase
      .from("v_estado_cobro")
      .select("id, numero_completo, cliente_id, cliente_razon_social, fecha, fecha_vencimiento, total, pendiente, estado_cobro")
      .in("estado_cobro", ["pendiente", "parcial", "vencida"]),
    supabase.from("v_progreso_campana").select("*").eq("estado_campana", "en_curso"),
    supabase
      .from("documentos")
      .select("id, numero_completo, tipo, estado, total, cliente_razon_social, fecha, clientes(razon_social)")
      .order("fecha", { ascending: false })
      .limit(5),
  ]);
  lanzarSiError(...resultados);
  const [{ data: facturadoMes }, { data: pendientesCobro }, { data: campanasActivas }, { data: documentosRecientes }] =
    resultados;

  const totalFacturado = (facturadoMes ?? []).reduce((s, d) => s + Number(d.total), 0);
  const totalPendiente = (pendientesCobro ?? []).reduce((s, d) => s + Number(d.pendiente ?? 0), 0);

  const conSaldo = (pendientesCobro ?? [])
    .filter((d) => Number(d.pendiente ?? 0) > 0.01 && d.id != null)
    .map((d) => ({
      ...d,
      pendienteNum: Number(d.pendiente ?? 0),
      aging: clasificarAgingCobro(d.estado_cobro, d.fecha_vencimiento, hoy),
    }));

  const alDia = conSaldo.filter((d) => d.aging.tramo === "al_dia");
  const vencidas1a30 = conSaldo.filter((d) => d.aging.tramo === "vencida_30");
  const vencidas31a89 = conSaldo.filter((d) => d.aging.tramo === "vencida_60");
  const criticas90 = conSaldo
    .filter((d) => d.aging.tramo === "critica_90")
    .sort((a, b) => b.aging.diasVencido - a.aging.diasVencido);

  const sumarPendiente = (lista: typeof conSaldo) => lista.reduce((s, d) => s + d.pendienteNum, 0);
  const sumaAlDia = sumarPendiente(alDia);
  const suma1a30 = sumarPendiente(vencidas1a30);
  const suma31a89 = sumarPendiente(vencidas31a89);
  const sumaCriticas90 = sumarPendiente(criticas90);
  const totalAging = Math.max(0.01, sumaAlDia + suma1a30 + suma31a89 + sumaCriticas90);

  const vencidasTotales = vencidas1a30.length + vencidas31a89.length + criticas90.length;
  const totalPuntos = (campanasActivas ?? []).reduce((s, c) => s + Number(c.puntos_totales), 0);
  const totalIncidencias = (campanasActivas ?? []).reduce((s, c) => s + Number(c.puntos_con_incidencia), 0);

  const listaPrioritaria =
    criticas90.length > 0
      ? criticas90.slice(0, 6)
      : [...vencidas31a89, ...vencidas1a30].sort((a, b) => b.aging.diasVencido - a.aging.diasVencido).slice(0, 4);

  const tramos = [
    {
      clave: "al_dia",
      etiqueta: "En plazo",
      cantidad: alDia.length,
      importe: sumaAlDia,
      porcentaje: (sumaAlDia / totalAging) * 100,
      colorBarra: "bg-texto-info",
      punto: "bg-texto-info",
      href: "/admin/documentos?cobro=pendiente",
      destacado: false,
    },
    {
      clave: "1_30",
      etiqueta: "1–30 días",
      cantidad: vencidas1a30.length,
      importe: suma1a30,
      porcentaje: (suma1a30 / totalAging) * 100,
      colorBarra: "bg-texto-aviso",
      punto: "bg-texto-aviso",
      href: "/admin/documentos?cobro=vencida",
      destacado: false,
    },
    {
      clave: "31_89",
      etiqueta: "31–89 días",
      cantidad: vencidas31a89.length,
      importe: suma31a89,
      porcentaje: (suma31a89 / totalAging) * 100,
      colorBarra: "bg-fondo-peligro",
      punto: "bg-fondo-peligro",
      href: "/admin/documentos?cobro=vencida",
      destacado: false,
    },
    {
      clave: "90_mas",
      etiqueta: "90+ días (Crítico)",
      cantidad: criticas90.length,
      importe: sumaCriticas90,
      porcentaje: (sumaCriticas90 / totalAging) * 100,
      colorBarra: "bg-fondo-critico",
      punto: "bg-fondo-critico",
      href: "/admin/documentos?cobro=vencida_90",
      destacado: criticas90.length > 0,
    },
  ];

  return (
    <div className="flex flex-col gap-esp6">
      <div className="flex items-center gap-esp3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-texto-primario">
            {saludo()}, {usuario?.nombre}
          </h1>
          <p className="text-sm capitalize text-texto-secundario">{fechaLarga(hoy)}</p>
        </div>
        <Link href="/admin/documentos/nuevo" className="shrink-0" aria-label="Nuevo documento">
          <Boton>
            <Icono nombre="mas" size={16} />
            <span className="hidden sm:inline">Nuevo documento</span>
          </Boton>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-esp3 md:gap-esp4 xl:grid-cols-4">
        <TarjetaKpi
          etiqueta="Facturado este mes"
          valor={euros(totalFacturado)}
          href="/admin/documentos?tipo=factura"
        />
        <TarjetaKpi
          etiqueta="Pendiente de cobro"
          valor={euros(totalPendiente)}
          href={vencidasTotales > 0 ? "/admin/documentos?cobro=vencida" : "/admin/documentos?cobro=pendiente"}
          detalle={vencidasTotales > 0 ? `${vencidasTotales} vencidas` : "al día"}
          colorDetalle={vencidasTotales > 0 ? "text-texto-peligro" : "text-texto-exito"}
          tono={vencidasTotales > 0 ? "aviso" : "default"}
        />
        <TarjetaKpi
          etiqueta="Insoluto crítico (90+ días)"
          valor={euros(sumaCriticas90)}
          href="/admin/documentos?cobro=vencida_90"
          detalle={
            criticas90.length > 0
              ? `${criticas90.length} factura${criticas90.length === 1 ? "" : "s"} > 90d`
              : "sin riesgo > 90 días"
          }
          colorDetalle={criticas90.length > 0 ? "text-texto-critico font-medium" : "text-texto-exito"}
          tono={criticas90.length > 0 ? "critico" : "default"}
        />
        <TarjetaKpi
          etiqueta="Campañas activas"
          href="/admin/campanas?estado=en_curso"
          valor={String(campanasActivas?.length ?? 0)}
          detalle={`${totalPuntos} puntos · ${totalIncidencias} incidencia${totalIncidencias === 1 ? "" : "s"}`}
          colorDetalle={totalIncidencias > 0 ? "text-texto-peligro" : "text-texto-secundario"}
          tono={totalIncidencias > 0 ? "peligro" : "default"}
        />
      </div>

      {/* Sección prioritaria de Aging y facturas insolutas 90+ días */}
      <section
        aria-labelledby="titulo-aging"
        className="flex flex-col gap-esp4 rounded-lg border border-borde-default bg-fondo-superficie p-esp4 shadow-xs md:p-esp6"
      >
        <div className="flex flex-wrap items-center gap-esp2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-esp2">
              <h2 id="titulo-aging" className="text-base font-semibold text-texto-primario">
                Control de cobros y facturas insolutas
              </h2>
              {criticas90.length > 0 && (
                <Insignia tono="critico" solido>
                  {criticas90.length} en riesgo 90+ días
                </Insignia>
              )}
            </div>
            <p className="text-xs text-texto-secundario">
              Distribución de saldo pendiente por antigüedad desde el vencimiento.
            </p>
          </div>
          <Link
            href="/admin/documentos?cobro=vencida_90"
            className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-texto-marca hover:underline"
          >
            Revisar insolutas
            <Icono nombre="flechaDerecha" size={14} />
          </Link>
        </div>

        {conSaldo.length > 0 && (
          <div
            className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-completo bg-fondo-sutil"
            role="img"
            aria-label="Distribución de importes pendientes por antigüedad"
          >
            {tramos.map((t) =>
              t.importe > 0 ? (
                <div
                  key={t.clave}
                  className={t.colorBarra}
                  style={{ width: `${Math.max(2, t.porcentaje)}%` }}
                  title={`${t.etiqueta}: ${euros(t.importe)}`}
                />
              ) : null,
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-esp2 lg:grid-cols-4">
          {tramos.map((t) => (
            <Link
              key={t.clave}
              href={t.href}
              className={
                t.destacado
                  ? "flex flex-col gap-1 rounded-md border border-borde-critico-sutil border-l-4 border-l-borde-critico bg-fondo-critico-sutil/60 p-esp3 transition-colors hover:bg-fondo-critico-sutil"
                  : "flex flex-col gap-1 rounded-md border border-borde-default bg-fondo-sutil/50 p-esp3 transition-colors hover:bg-fondo-sutil"
              }
            >
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${t.punto}`} aria-hidden="true" />
                <span
                  className={`truncate text-xs font-medium ${t.destacado ? "text-texto-critico" : "text-texto-secundario"}`}
                >
                  {t.etiqueta}
                </span>
              </div>
              <p
                className={`tabular-nums text-base font-semibold ${t.destacado ? "text-texto-critico" : "text-texto-primario"}`}
              >
                {euros(t.importe)}
              </p>
              <p className="tabular-nums text-micro text-texto-terciario">
                {t.cantidad} factura{t.cantidad === 1 ? "" : "s"}
              </p>
            </Link>
          ))}
        </div>

        {listaPrioritaria.length > 0 ? (
          <div className="flex flex-col gap-esp2 border-t border-borde-default pt-esp3">
            <p className="text-micro font-semibold uppercase tracking-wider text-texto-terciario">
              {criticas90.length > 0 ? "Atención prioritaria — Vencidas 90+ días" : "Próximas facturas vencidas"}
            </p>
            <div className="flex flex-col gap-esp2">
              {listaPrioritaria.map((d) => {
                const es90 = d.aging.esCritica90;
                return (
                  <Link
                    key={d.id}
                    href={`/admin/documentos/${d.id}`}
                    className={
                      es90
                        ? "flex flex-col gap-esp2 rounded-md border border-borde-critico-sutil border-l-4 border-l-borde-critico bg-fondo-critico-sutil/60 px-esp3 py-esp3 transition-colors hover:bg-fondo-critico-sutil sm:flex-row sm:items-center sm:gap-esp4"
                        : "flex flex-col gap-esp2 rounded-md border border-borde-default bg-fondo-superficie px-esp3 py-esp3 transition-colors hover:bg-fondo-sutil sm:flex-row sm:items-center sm:gap-esp4"
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-esp2">
                        <span className="truncate text-sm font-semibold text-texto-primario">
                          {d.cliente_razon_social ?? "Sin cliente"}
                        </span>
                        <Insignia tono={es90 ? "critico" : "peligro"} solido={es90}>
                          {es90 ? `90+ días · ${d.aging.diasVencido}d` : `${d.aging.diasVencido}d vencida`}
                        </Insignia>
                      </div>
                      <p className="tabular-nums mt-0.5 text-xs text-texto-secundario">
                        {d.numero_completo ?? `Doc #${d.id}`}
                        {d.fecha_vencimiento ? ` · Venció el ${fechaMedia(d.fecha_vencimiento)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-esp4 sm:justify-end">
                      <span
                        className={`tabular-nums text-sm font-semibold ${es90 ? "text-texto-critico" : "text-texto-peligro"}`}
                      >
                        {euros(d.pendienteNum)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-texto-marca">
                        Gestionar cobro
                        <Icono nombre="flechaDerecha" size={13} />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="rounded-md bg-fondo-exito-sutil px-esp3 py-esp2 text-xs font-medium text-texto-exito">
            Todas las facturas emitidas están al día o sin vencimientos pendientes.
          </p>
        )}
      </section>

      <div className="flex flex-1 flex-col gap-esp6 xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-esp4 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp5 shadow-xs md:px-esp6">
          <div className="flex items-center">
            <h2 className="flex-1 text-base font-semibold text-texto-primario">Campañas en curso</h2>
            <Link href="/admin/campanas?vista=pipeline" className="text-sm font-medium text-texto-marca hover:underline">
              Ver pipeline
            </Link>
          </div>
          <div className="flex flex-col divide-y divide-fondo-hover">
            {(campanasActivas ?? []).map((c) => {
              const total = Number(c.puntos_totales) || 1;
              const hechos =
                Number(c.puntos_instalados) + Number(c.puntos_verificados) + Number(c.puntos_retirados);
              return (
                <Link
                  key={c.campana_id}
                  href={`/admin/campanas/${c.campana_id}`}
                  className="-mx-esp2 flex items-center gap-esp4 rounded-md px-esp2 py-esp3 transition-colors hover:bg-fondo-sutil"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-texto-primario">{c.campana}</p>
                    <p className="truncate text-xs text-texto-terciario">{c.cliente}</p>
                  </div>
                  <div className="hidden w-[160px] items-center gap-esp3 sm:flex">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-completo bg-fondo-sutil">
                      <div
                        className="h-full rounded-completo bg-fondo-marca"
                        style={{ width: `${Math.round((hechos / total) * 100)}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-xs text-texto-secundario">
                      {hechos}/{total}
                    </span>
                  </div>
                  <Insignia
                    tono={
                      Number(c.puntos_con_incidencia) > 0
                        ? "peligro"
                        : (TONO_POR_ESTADO[c.estado_campana ?? ""] ?? "neutro")
                    }
                  >
                    {Number(c.puntos_con_incidencia) > 0 ? "Incidencia" : "En curso"}
                  </Insignia>
                </Link>
              );
            })}
            {(campanasActivas ?? []).length === 0 && (
              <p className="py-esp4 text-sm text-texto-terciario">No hay campañas en curso ahora mismo.</p>
            )}
          </div>
        </div>

        <div className="flex w-full flex-col gap-esp4 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp5 shadow-xs md:px-esp6 xl:w-[420px]">
          <div className="flex items-center">
            <h2 className="flex-1 text-base font-semibold text-texto-primario">Documentos recientes</h2>
            <Link href="/admin/documentos" className="text-sm font-medium text-texto-marca hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="flex flex-col divide-y divide-fondo-hover">
            {(documentosRecientes ?? []).map((d) => (
              <Link
                key={d.id}
                href={`/admin/documentos/${d.id}`}
                className="-mx-esp2 flex items-center gap-esp3 rounded-md px-esp2 py-esp3 transition-colors hover:bg-fondo-sutil"
              >
                <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md bg-fondo-sutil sm:flex">
                  <Icono nombre="documentos" size={18} className="text-icono-default" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-micro font-normal uppercase tracking-wide text-texto-terciario">
                    {ETIQUETA_TIPO[d.tipo] ?? d.tipo}
                  </p>
                  <p className="truncate text-sm font-medium text-texto-primario">
                    {d.numero_completo ?? "Borrador"}
                  </p>
                  <p className="truncate text-xs text-texto-terciario">
                    {d.cliente_razon_social ?? (Array.isArray(d.clientes) ? d.clientes[0] : d.clientes)?.razon_social}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p className="tabular-nums whitespace-nowrap text-sm font-medium text-texto-primario">
                    {euros(Number(d.total))}
                  </p>
                  <Insignia tono={TONO_POR_ESTADO[d.estado] ?? "neutro"}>
                    {ETIQUETA_ESTADO_DOC[d.estado] ?? d.estado}
                  </Insignia>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
