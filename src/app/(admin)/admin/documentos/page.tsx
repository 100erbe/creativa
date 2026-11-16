import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { euros, fechaMedia } from "@/lib/formato";
import {
  clasificarAgingCobro,
  ETIQUETA_COBRO,
  ETIQUETA_ESTADO_DOC,
  ETIQUETA_TIPO,
  sumarDias,
  validezVencida,
} from "@/lib/documentos";
import { LimpiarBorradores } from "./limpiar-borradores";

export const dynamic = "force-dynamic";

const TIPOS = [
  { valor: "presupuesto", etiqueta: "Presupuestos" },
  { valor: "albaran", etiqueta: "Albaranes" },
  { valor: "factura", etiqueta: "Facturas" },
  { valor: "rectificativa", etiqueta: "Rectificativas" },
];

const ESTADOS = [
  { valor: "borrador", etiqueta: "Borrador" },
  { valor: "emitido", etiqueta: "Emitido" },
  { valor: "enviado", etiqueta: "Enviado" },
  { valor: "aceptado", etiqueta: "Aceptado" },
  { valor: "rechazado", etiqueta: "Rechazado" },
  { valor: "caducado", etiqueta: "Caducado" },
  { valor: "facturado", etiqueta: "Facturado" },
  { valor: "sustituido", etiqueta: "Sustituido" },
];

const COBROS = [
  { valor: "pendiente", etiqueta: "Por cobrar", critico: false },
  { valor: "vencida", etiqueta: "Vencidas", critico: false },
  { valor: "vencida_90", etiqueta: "Insolutas 90+ días", critico: true },
] as const;

const PILDORA =
  "inline-flex min-h-11 items-center gap-1.5 rounded-completo px-esp3 text-sm transition-colors md:min-h-8 md:text-xs";

type Filtros = {
  tipo?: string;
  estado?: string;
  q?: string;
  cliente?: string;
  cobro?: string;
  vista?: string;
  pagina?: string;
};

function enlace(actual: Filtros, cambios: Partial<Filtros>) {
  const f = { ...actual, ...cambios };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) params.set(k, v);
  const s = params.toString();
  return s ? `/admin/documentos?${s}` : "/admin/documentos";
}

export default async function PaginaDocumentos({
  searchParams,
}: {
  searchParams: Promise<Filtros>;
}) {
  const filtros = await searchParams;
  const vista = filtros.vista === "pipeline" ? "pipeline" : "lista";
  const porPagina = vista === "pipeline" ? 100 : 25;

  const tipo = TIPOS.some((t) => t.valor === filtros.tipo) ? (filtros.tipo ?? "") : "";
  const estado = ESTADOS.some((e) => e.valor === filtros.estado) ? (filtros.estado ?? "") : "";
  // Se quitan los caracteres que rompen la sintaxis de .or() de PostgREST.
  const q = (filtros.q ?? "").replace(/[,()%*\\]/g, " ").trim();
  const pagina = vista === "pipeline" ? 1 : Math.max(1, Number(filtros.pagina) || 1);
  const cobro =
    filtros.cobro === "pendiente" || filtros.cobro === "vencida" || filtros.cobro === "vencida_90"
      ? filtros.cobro
      : "";
  const clienteId =
    Number.isInteger(Number(filtros.cliente)) && Number(filtros.cliente) > 0 ? Number(filtros.cliente) : null;

  const supabase = await createClient();
  const hoy = new Date();
  const hoyIso = hoy.toISOString().slice(0, 10);
  const limite90 = sumarDias(hoyIso, -90);

  // Los borradores aún no tienen el nombre del cliente copiado en el documento,
  // así que la búsqueda por nombre se resuelve primero contra la tabla clientes.
  let condicionBusqueda: string | null = null;
  if (q) {
    const { data: clientes } = await supabase
      .from("clientes")
      .select("id")
      .ilike("razon_social", `%${q}%`)
      .limit(200);
    const ids = (clientes ?? []).map((c) => c.id);
    condicionBusqueda = `numero_completo.ilike.%${q}%` + (ids.length ? `,cliente_id.in.(${ids.join(",")})` : "");
  }

  let consulta = supabase
    .from("documentos")
    .select(
      "id, tipo, estado, numero_completo, fecha, valido_hasta, version, creado_en, total, cliente_razon_social, clientes(razon_social)",
      { count: "exact" },
    )
    .order("fecha", { ascending: false })
    .order("id", { ascending: false })
    .range((pagina - 1) * porPagina, pagina * porPagina - 1);
  if (tipo) consulta = consulta.eq("tipo", tipo as "factura");
  if (estado) consulta = consulta.eq("estado", estado as "borrador");
  if (condicionBusqueda) consulta = consulta.or(condicionBusqueda);
  if (clienteId) consulta = consulta.eq("cliente_id", clienteId);
  if (cobro) {
    let qCobro = supabase
      .from("v_estado_cobro")
      .select("id")
      .in("estado_cobro", ["pendiente", "parcial", "vencida"])
      .gt("pendiente", 0.01);
    if (cobro === "vencida_90") qCobro = qCobro.lte("fecha_vencimiento", limite90);
    else if (cobro === "vencida") qCobro = qCobro.lt("fecha_vencimiento", hoyIso);

    const { data: porCobrar } = await qCobro;
    const ids = (porCobrar ?? []).flatMap((c) => (c.id == null ? [] : [c.id]));
    consulta = consulta.in("id", ids.length ? ids : [-1]);
  }

  const [{ data: documentos, count, error: errorLista }, { data: criticas90Global }] = await Promise.all([
    consulta,
    supabase
      .from("v_estado_cobro")
      .select("id, pendiente")
      .in("estado_cobro", ["pendiente", "parcial", "vencida"])
      .gt("pendiente", 0.01)
      .lte("fecha_vencimiento", limite90),
  ]);
  lanzarSiError({ error: errorLista });

  const filas = documentos ?? [];
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / porPagina));

  // Estado de cobro + aging solo de las facturas que se muestran.
  const idsFacturas = filas.filter((d) => d.tipo === "factura" && d.estado !== "borrador").map((d) => d.id);
  const { data: cobros } = idsFacturas.length
    ? await supabase
        .from("v_estado_cobro")
        .select("id, estado_cobro, fecha_vencimiento, pendiente")
        .in("id", idsFacturas)
    : { data: [] };
  const cobroPorId = new Map((cobros ?? []).map((c) => [c.id, c]));

  const actual: Filtros = {
    tipo,
    estado,
    q,
    cobro,
    vista: vista === "pipeline" ? "pipeline" : "",
    cliente: clienteId ? String(clienteId) : "",
  };

  // Borradores sin ninguna línea con más de una hora: restos del asistente.
  const { data: borradores } = await supabase
    .from("documentos")
    .select("id, lineas_documento(id)")
    .eq("estado", "borrador")
    .lt("creado_en", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  const borradoresVacios = (borradores ?? []).filter((b) => (b.lineas_documento ?? []).length === 0).length;

  const clienteFiltrado = clienteId
    ? (await supabase.from("clientes").select("razon_social").eq("id", clienteId).maybeSingle()).data
    : null;

  const chips: { clave: keyof Filtros; texto: string }[] = [];
  if (tipo) chips.push({ clave: "tipo", texto: TIPOS.find((t) => t.valor === tipo)?.etiqueta ?? tipo });
  if (estado) chips.push({ clave: "estado", texto: ESTADOS.find((e) => e.valor === estado)?.etiqueta ?? estado });
  if (cobro) chips.push({ clave: "cobro", texto: COBROS.find((c) => c.valor === cobro)?.etiqueta ?? cobro });
  if (q) chips.push({ clave: "q", texto: `"${q}"` });
  if (clienteId) chips.push({ clave: "cliente", texto: clienteFiltrado?.razon_social ?? `Cliente #${clienteId}` });
  const hayFiltros = chips.length > 0;

  const totalCriticas90Global = (criticas90Global ?? []).length;
  const importeCriticas90Global = (criticas90Global ?? []).reduce((s, c) => s + Number(c.pendiente ?? 0), 0);

  // Agrupación en 4 etapas para la vista Pipeline
  const filasEnriquecidas = filas.map((d) => {
    const cobroDoc = cobroPorId.get(d.id);
    const aging = cobroDoc ? clasificarAgingCobro(cobroDoc.estado_cobro, cobroDoc.fecha_vencimiento, hoy) : null;
    const cliente = Array.isArray(d.clientes) ? d.clientes[0] : d.clientes;
    return {
      ...d,
      nombreCliente: d.cliente_razon_social ?? cliente?.razon_social ?? "Sin cliente",
      cobroDoc,
      aging,
    };
  });

  const colPorCobrar = filasEnriquecidas
    .filter(
      (d) =>
        d.tipo === "factura" &&
        d.estado !== "borrador" &&
        d.cobroDoc &&
        d.cobroDoc.estado_cobro !== "cobrada" &&
        Number(d.cobroDoc.pendiente ?? 0) > 0.01,
    )
    .sort((a, b) => (b.aging?.diasVencido ?? 0) - (a.aging?.diasVencido ?? 0));
  const idsColPorCobrar = new Set(colPorCobrar.map((d) => d.id));
  const colBorradores = filasEnriquecidas.filter((d) => d.estado === "borrador");
  const colNegociacion = filasEnriquecidas.filter(
    (d) => d.tipo !== "factura" && (d.estado === "emitido" || d.estado === "enviado"),
  );
  const colCerrados = filasEnriquecidas.filter(
    (d) =>
      !idsColPorCobrar.has(d.id) &&
      d.estado !== "borrador" &&
      !(d.tipo !== "factura" && (d.estado === "emitido" || d.estado === "enviado")) &&
      !["rechazado", "caducado", "anulado", "sustituido"].includes(d.estado),
  );

  const columnasPipeline = [
    {
      clave: "borradores",
      titulo: "Borradores",
      punto: "bg-borde-fuerte",
      items: colBorradores,
      totalEuros: colBorradores.reduce((s, d) => s + Number(d.total), 0),
      critica: false,
    },
    {
      clave: "negociacion",
      titulo: "En negociación",
      punto: "bg-texto-info",
      items: colNegociacion,
      totalEuros: colNegociacion.reduce((s, d) => s + Number(d.total), 0),
      critica: false,
    },
    {
      clave: "cerrados",
      titulo: "Aceptados / Cobrados",
      punto: "bg-texto-exito",
      items: colCerrados,
      totalEuros: colCerrados.reduce((s, d) => s + Number(d.total), 0),
      critica: false,
    },
    {
      clave: "por_cobrar",
      titulo: "Por cobrar / Insolutos",
      punto: "bg-fondo-critico",
      items: colPorCobrar,
      totalEuros: colPorCobrar.reduce((s, d) => s + Number(d.cobroDoc?.pendiente ?? d.total), 0),
      critica: colPorCobrar.some((d) => d.aging?.esCritica90),
    },
  ];

  return (
    <div className="flex flex-col gap-esp5">
      <div className="flex flex-wrap items-center gap-esp3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-texto-primario">Documentos</h1>
          <p className="tabular-nums text-sm text-texto-secundario">
            Presupuestos, albaranes y facturas · {total} resultado{total === 1 ? "" : "s"}
          </p>
        </div>

        {/* Selector Lista / Pipeline */}
        <div
          role="group"
          aria-label="Modo de visualización"
          className="inline-flex rounded-md border border-borde-default bg-fondo-superficie p-0.5 shadow-xs"
        >
          <Link
            href={enlace(actual, { vista: "", pagina: "" })}
            aria-current={vista === "lista" ? "true" : undefined}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded px-esp3 text-xs font-medium transition-colors md:min-h-8 ${
              vista === "lista"
                ? "bg-fondo-marca-sutil text-texto-marca"
                : "text-texto-secundario hover:text-texto-primario"
            }`}
          >
            <Icono nombre="lista" size={14} />
            Lista
          </Link>
          <Link
            href={enlace(actual, { vista: "pipeline", pagina: "" })}
            aria-current={vista === "pipeline" ? "true" : undefined}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded px-esp3 text-xs font-medium transition-colors md:min-h-8 ${
              vista === "pipeline"
                ? "bg-fondo-marca-sutil text-texto-marca"
                : "text-texto-secundario hover:text-texto-primario"
            }`}
          >
            <Icono nombre="kanban" size={14} />
            Pipeline
          </Link>
        </div>

        <Link href="/admin/documentos/nuevo" className="shrink-0" aria-label="Nuevo documento">
          <Boton>
            <Icono nombre="mas" size={16} />
            <span className="hidden sm:inline">Nuevo documento</span>
          </Boton>
        </Link>
      </div>

      {/* Banner resumen de facturas insolutas 90+ días */}
      {totalCriticas90Global > 0 && (
        <div
          role="region"
          aria-label="Alerta de facturas insolutas con más de 90 días"
          className="flex flex-wrap items-center gap-esp3 rounded-lg border border-borde-critico-sutil border-l-4 border-l-borde-critico bg-fondo-critico-sutil px-esp4 py-esp3"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-fondo-critico text-texto-inverso">
            <Icono nombre="alerta" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-texto-critico">
              {totalCriticas90Global} factura{totalCriticas90Global === 1 ? "" : "s"} insoluta
              {totalCriticas90Global === 1 ? "" : "s"} con 90+ días de retraso
            </p>
            <p className="tabular-nums text-xs text-texto-primario">
              Importe total en riesgo crítico:{" "}
              <strong className="font-semibold text-texto-critico">{euros(importeCriticas90Global)}</strong>
            </p>
          </div>
          {cobro === "vencida_90" ? (
            <Link href={enlace(actual, { cobro: "", pagina: "" })}>
              <Boton variante="secundario" tamano="s">
                Ver todos
              </Boton>
            </Link>
          ) : (
            <Link
              href={enlace(actual, { cobro: "vencida_90", estado: "", tipo: "factura", pagina: "" })}
            >
              <Boton variante="critico" tamano="s">
                Filtrar 90+ días
              </Boton>
            </Link>
          )}
        </div>
      )}

      {borradoresVacios > 0 && <LimpiarBorradores cantidad={borradoresVacios} />}

      <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie p-esp3 shadow-xs md:p-esp4">
        <form action="/admin/documentos" className="flex items-center gap-esp2">
          {tipo && <input type="hidden" name="tipo" value={tipo} />}
          {estado && <input type="hidden" name="estado" value={estado} />}
          {cobro && <input type="hidden" name="cobro" value={cobro} />}
          {clienteId && <input type="hidden" name="cliente" value={clienteId} />}
          {vista === "pipeline" && <input type="hidden" name="vista" value="pipeline" />}
          <div className="relative min-w-0 flex-1 md:max-w-sm">
            <Icono
              nombre="buscar"
              size={15}
              className="pointer-events-none absolute left-esp3 top-1/2 -translate-y-1/2 text-icono-secundario"
            />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar por número o cliente…"
              aria-label="Buscar documentos por número o cliente"
              className="min-h-11 h-11 w-full rounded-md border border-borde-campo bg-fondo-superficie pl-9 pr-esp3 text-base text-texto-primario outline-none focus:border-borde-foco focus:ring-2 focus:ring-borde-foco/20 md:min-h-9 md:h-9 md:text-sm"
            />
          </div>
          <Boton type="submit" variante="secundario">
            Buscar
          </Boton>
        </form>

        {/* Nivel 1: tipo de documento */}
        <div className="flex flex-col gap-esp1">
          <p className="text-micro font-semibold uppercase tracking-wide text-texto-terciario">Tipo de documento</p>
          <div className="flex flex-wrap gap-esp2" role="group" aria-label="Tipo de documento">
            {[{ valor: "", etiqueta: "Todos" }, ...TIPOS].map((t) => {
              const activo = tipo === t.valor;
              return (
                <Link
                  key={t.valor}
                  href={enlace(actual, {
                    tipo: t.valor,
                    cobro: t.valor === "" || t.valor === "factura" ? cobro : "",
                    pagina: "",
                  })}
                  aria-current={activo ? "true" : undefined}
                  className={`${PILDORA} ${
                    activo
                      ? "bg-fondo-marca font-medium text-texto-sobre-marca"
                      : "border border-borde-default bg-fondo-superficie text-texto-secundario hover:bg-fondo-sutil"
                  }`}
                >
                  {t.etiqueta}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Nivel 2: cobros y estado */}
        <div className="flex flex-col gap-esp1">
          <p className="text-micro font-semibold uppercase tracking-wide text-texto-terciario">Cobro y estado</p>
          <div className="flex flex-wrap gap-esp2" role="group" aria-label="Cobro y estado">
            {COBROS.map((c) => {
              const activo = cobro === c.valor;
              return (
                <Link
                  key={c.valor}
                  href={enlace(actual, {
                    cobro: activo ? "" : c.valor,
                    estado: "",
                    tipo: activo ? tipo : "factura",
                    pagina: "",
                  })}
                  aria-pressed={activo}
                  className={`${PILDORA} border ${
                    c.critico
                      ? activo
                        ? "border-borde-critico bg-fondo-critico font-semibold text-texto-inverso"
                        : "border-borde-critico-sutil bg-fondo-critico-sutil font-medium text-texto-critico hover:border-borde-critico"
                      : activo
                        ? "border-borde-peligro bg-fondo-peligro font-medium text-texto-inverso"
                        : "border-borde-peligro-sutil bg-fondo-peligro-sutil text-texto-peligro hover:opacity-90"
                  }`}
                >
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-completo bg-current" />
                  {c.etiqueta}
                </Link>
              );
            })}
            <span aria-hidden="true" className="mx-esp1 hidden w-px self-stretch bg-borde-default sm:block" />
            {ESTADOS.map((e) => {
              const activo = estado === e.valor;
              return (
                <Link
                  key={e.valor}
                  href={enlace(actual, { estado: activo ? "" : e.valor, cobro: "", pagina: "" })}
                  aria-pressed={activo}
                  className={`${PILDORA} border ${
                    activo
                      ? "border-borde-marca bg-fondo-marca-sutil font-medium text-texto-marca"
                      : "border-borde-default bg-fondo-superficie text-texto-secundario hover:bg-fondo-sutil"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-completo ${activo ? "bg-current" : "bg-borde-fuerte"}`}
                  />
                  {e.etiqueta}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Filtros activos */}
        {hayFiltros && (
          <div className="flex flex-wrap items-center gap-esp2 border-t border-borde-default pt-esp3 text-sm">
            <span className="text-texto-terciario">Filtrando por:</span>
            {chips.map((c) => (
              <Link
                key={c.clave}
                href={enlace(actual, { [c.clave]: "", pagina: "" })}
                aria-label={`Quitar filtro ${c.texto}`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-completo border border-borde-campo bg-fondo-sutil pl-esp3 pr-esp2 text-texto-primario md:min-h-8"
              >
                <span className="max-w-[60vw] truncate">{c.texto}</span>
                <span aria-hidden="true" className="text-base leading-none text-texto-terciario">
                  ×
                </span>
              </Link>
            ))}
            <Link
              href={vista === "pipeline" ? "/admin/documentos?vista=pipeline" : "/admin/documentos"}
              className="inline-flex min-h-10 items-center px-esp2 font-medium text-texto-marca md:min-h-8"
            >
              Quitar todos
            </Link>
          </div>
        )}
      </div>

      {vista === "pipeline" ? (
        <div className="grid grid-cols-1 gap-esp4 md:grid-cols-2 xl:grid-cols-4">
          {columnasPipeline.map((col) => (
            <section
              key={col.clave}
              aria-label={col.titulo}
              className={`flex flex-col gap-esp3 rounded-lg border p-esp3 ${
                col.critica
                  ? "border-borde-critico-sutil bg-fondo-critico-sutil/35"
                  : "border-borde-default bg-fondo-sutil/60"
              }`}
            >
              <div className="flex items-center justify-between gap-esp2 px-esp1">
                <div className="flex min-w-0 items-center gap-esp2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${col.punto}`} aria-hidden="true" />
                  <h2 className="truncate text-xs font-semibold uppercase tracking-wide text-texto-primario">
                    {col.titulo}
                  </h2>
                  <span className="tabular-nums rounded-completo bg-fondo-superficie px-1.5 py-0.5 text-micro font-medium text-texto-secundario">
                    {col.items.length}
                  </span>
                </div>
                <span
                  className={`tabular-nums text-xs font-semibold ${
                    col.critica ? "text-texto-critico" : "text-texto-secundario"
                  }`}
                >
                  {euros(col.totalEuros)}
                </span>
              </div>

              <div className="flex flex-col gap-esp2">
                {col.items.map((d) => {
                  const es90 = d.aging?.esCritica90 ?? false;
                  const cobroEstado = d.cobroDoc?.estado_cobro;
                  return (
                    <Link
                      key={d.id}
                      href={`/admin/documentos/${d.id}`}
                      className={
                        es90
                          ? "flex flex-col gap-esp2 rounded-md border border-borde-critico-sutil border-l-4 border-l-borde-critico bg-fondo-critico-sutil/70 p-esp3 shadow-xs transition-colors hover:bg-fondo-critico-sutil"
                          : "flex flex-col gap-esp2 rounded-md border border-borde-default bg-fondo-superficie p-esp3 shadow-xs transition-colors hover:border-borde-campo"
                      }
                    >
                      <div className="flex items-start justify-between gap-esp2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-micro uppercase tracking-wide text-texto-terciario">
                            {ETIQUETA_TIPO[d.tipo] ?? d.tipo} · {fechaMedia(d.fecha)}
                          </p>
                          <p className="truncate text-sm font-medium text-texto-primario">
                            {d.numero_completo ?? "Borrador"}
                          </p>
                        </div>
                        <span
                          className={`tabular-nums whitespace-nowrap text-sm font-semibold ${
                            es90 ? "text-texto-critico" : "text-texto-primario"
                          }`}
                        >
                          {euros(
                            col.clave === "por_cobrar" && d.cobroDoc?.pendiente != null
                              ? Number(d.cobroDoc.pendiente)
                              : Number(d.total),
                          )}
                        </span>
                      </div>
                      <p className="truncate text-xs text-texto-secundario">{d.nombreCliente}</p>
                      <div className="flex flex-wrap items-center gap-1">
                        {es90 ? (
                          <Insignia tono="critico" solido>
                            90+ días · {d.aging!.diasVencido}d
                          </Insignia>
                        ) : cobroEstado && cobroEstado !== "cobrada" ? (
                          <Insignia tono={TONO_POR_ESTADO[cobroEstado] ?? "neutro"}>
                            {ETIQUETA_COBRO[cobroEstado] ?? cobroEstado}
                          </Insignia>
                        ) : (
                          <Insignia tono={TONO_POR_ESTADO[d.estado] ?? "neutro"}>
                            {ETIQUETA_ESTADO_DOC[d.estado] ?? d.estado}
                          </Insignia>
                        )}
                      </div>
                    </Link>
                  );
                })}
                {col.items.length === 0 && (
                  <p className="rounded-md border border-dashed border-borde-default px-esp3 py-esp5 text-center text-xs text-texto-terciario">
                    Sin documentos en esta etapa
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-borde-default bg-fondo-superficie shadow-xs">
          <div className="hidden items-center gap-esp4 border-b border-borde-default bg-fondo-sutil/70 px-esp6 py-esp2 text-micro font-semibold uppercase tracking-wider text-texto-terciario lg:flex">
            <span className="flex-1">Documento y cliente</span>
            <span className="w-[100px]">Tipo</span>
            <span className="w-[100px]">Fecha</span>
            <span className="w-[130px]">Vencimiento / Creado</span>
            <span className="w-[115px] text-right">Importe</span>
            <span className="w-[175px] text-right">Estado</span>
          </div>
          <div className="flex flex-col divide-y divide-fondo-hover">
            {filasEnriquecidas.map((d) => {
              const cobroEstado = d.cobroDoc?.estado_cobro;
              const es90 = d.aging?.esCritica90 ?? false;
              const pendienteNum = Number(d.cobroDoc?.pendiente ?? 0);
              return (
                <Link
                  key={d.id}
                  href={`/admin/documentos/${d.id}`}
                  className={`grid grid-cols-[1fr_auto] items-center gap-x-esp3 gap-y-1.5 px-esp4 py-esp3 transition-colors md:px-esp6 lg:flex lg:gap-esp4 ${
                    es90
                      ? "border-l-4 border-l-borde-critico bg-fondo-critico-sutil/45 hover:bg-fondo-critico-sutil/75"
                      : "hover:bg-fondo-sutil/60"
                  }`}
                >
                  <div
                    className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-md lg:flex ${
                      es90 ? "bg-fondo-critico text-texto-inverso" : "bg-fondo-sutil text-icono-default"
                    }`}
                  >
                    <Icono nombre={es90 ? "alerta" : "documentos"} size={18} />
                  </div>
                  <div className="min-w-0 lg:flex-1">
                    <p className="truncate text-micro font-normal uppercase tracking-wide text-texto-terciario lg:hidden">
                      {ETIQUETA_TIPO[d.tipo] ?? d.tipo}
                    </p>
                    <p className="truncate text-sm font-medium text-texto-primario">
                      {d.numero_completo ?? `${ETIQUETA_TIPO[d.tipo] ?? d.tipo} (borrador)`}
                      {d.version > 1 && <span className="font-normal text-texto-terciario"> · v{d.version}</span>}
                    </p>
                    <p className="truncate text-xs text-texto-terciario">
                      {d.nombreCliente}
                      <span className="lg:hidden"> · {fechaMedia(d.fecha)}</span>
                    </p>
                  </div>
                  <span className="hidden w-[100px] text-xs text-texto-terciario lg:block">
                    {ETIQUETA_TIPO[d.tipo] ?? d.tipo}
                  </span>
                  <span className="tabular-nums hidden w-[100px] text-xs text-texto-terciario lg:block">
                    {fechaMedia(d.fecha)}
                  </span>
                  <span
                    className="tabular-nums hidden w-[130px] text-xs text-texto-terciario lg:block"
                    title="Vencimiento o fecha de creación"
                  >
                    {d.cobroDoc?.fecha_vencimiento && cobroEstado && cobroEstado !== "cobrada" ? (
                      <>
                        <span className={`block text-micro uppercase tracking-wide ${es90 ? "font-semibold text-texto-critico" : ""}`}>
                          Vencimiento
                        </span>
                        <span className={es90 ? "font-medium text-texto-critico" : undefined}>
                          {fechaMedia(d.cobroDoc.fecha_vencimiento)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="block text-micro uppercase tracking-wide">Creado</span>
                        {fechaMedia(d.creado_en)}
                      </>
                    )}
                  </span>
                  <div className="text-right lg:w-[115px]">
                    <span
                      className={`tabular-nums block whitespace-nowrap text-sm font-medium ${
                        es90 ? "text-texto-critico" : "text-texto-primario"
                      }`}
                    >
                      {euros(Number(d.total))}
                    </span>
                    {cobroEstado && cobroEstado !== "cobrada" && Math.abs(pendienteNum - Number(d.total)) > 0.01 && (
                      <span className="tabular-nums block text-micro text-texto-peligro">
                        Pend. {euros(pendienteNum)}
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 flex flex-wrap items-center gap-1 lg:col-span-1 lg:w-[175px] lg:flex-col lg:items-end">
                    {es90 ? (
                      <Insignia tono="critico" solido>
                        90+ días · {d.aging!.diasVencido}d
                      </Insignia>
                    ) : (
                      <>
                        <Insignia tono={TONO_POR_ESTADO[d.estado] ?? "neutro"}>
                          {ETIQUETA_ESTADO_DOC[d.estado] ?? d.estado}
                        </Insignia>
                        {validezVencida(d.tipo, d.estado, d.valido_hasta) && (
                          <Insignia tono="aviso">Validez vencida</Insignia>
                        )}
                        {cobroEstado && cobroEstado !== "cobrada" && (
                          <Insignia tono={TONO_POR_ESTADO[cobroEstado] ?? "neutro"}>
                            {d.aging && d.aging.diasVencido > 0
                              ? `${ETIQUETA_COBRO[cobroEstado] ?? cobroEstado} (${d.aging.diasVencido}d)`
                              : (ETIQUETA_COBRO[cobroEstado] ?? cobroEstado)}
                          </Insignia>
                        )}
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
            {filas.length === 0 && (
              <p className="px-esp6 py-esp6 text-sm text-texto-terciario">No hay documentos con estos filtros.</p>
            )}
          </div>
        </div>
      )}

      {vista === "lista" && paginas > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-x-esp4 gap-y-esp2 text-sm text-texto-secundario [&_a]:inline-flex [&_a]:min-h-10 [&_a]:items-center">
          {pagina > 1 ? (
            <Link href={enlace(actual, { pagina: String(pagina - 1) })} className="font-medium text-texto-marca">
              ← Anterior
            </Link>
          ) : (
            <span className="text-texto-terciario">← Anterior</span>
          )}
          <span className="tabular-nums">
            Página {pagina} de {paginas}
          </span>
          {pagina < paginas ? (
            <Link href={enlace(actual, { pagina: String(pagina + 1) })} className="font-medium text-texto-marca">
              Siguiente →
            </Link>
          ) : (
            <span className="text-texto-terciario">Siguiente →</span>
          )}
        </div>
      )}
    </div>
  );
}
