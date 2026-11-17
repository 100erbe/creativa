import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { Insignia } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { euros } from "@/lib/formato";
import {
  ETIQUETA_TIPO_CLIENTE,
  inicialesCliente,
  TIPOS_CLIENTE,
  VALORES_TIPO_CLIENTE,
} from "@/lib/clientes";
import { clasificarAgingCobro } from "@/lib/documentos";

export const dynamic = "force-dynamic";

const POR_PAGINA = 25;

type Filtros = { tipo?: string; q?: string; inactivos?: string; con_deuda?: string; pagina?: string };

function enlace(actual: Filtros, cambios: Partial<Filtros>) {
  const f = { ...actual, ...cambios };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) params.set(k, v);
  const s = params.toString();
  return s ? `/admin/clientes?${s}` : "/admin/clientes";
}

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<Filtros>;
}) {
  const filtros = await searchParams;
  const tipo = VALORES_TIPO_CLIENTE.find((t) => t === filtros.tipo);
  const inactivos = filtros.inactivos === "1";
  const conDeuda = filtros.con_deuda === "1";
  // Se quitan los caracteres que rompen la sintaxis de .or() de PostgREST.
  const q = (filtros.q ?? "").replace(/[,()%*\\]/g, " ").trim();
  const pagina = Math.max(1, Number(filtros.pagina) || 1);

  const supabase = await createClient();
  const hoy = new Date();

  let idsConDeuda: number[] | null = null;
  if (conDeuda) {
    const { data: deudores } = await supabase
      .from("v_estado_cobro")
      .select("cliente_id")
      .in("estado_cobro", ["pendiente", "parcial", "vencida"])
      .gt("pendiente", 0.005);
    idsConDeuda = [
      ...new Set((deudores ?? []).map((d) => d.cliente_id).filter((id): id is number => id != null)),
    ];
  }

  let consulta = supabase
    .from("clientes")
    .select("id, codigo, razon_social, nombre_comercial, numero_documento, municipio, tipo_cliente, activo", {
      count: "exact",
    })
    .order("razon_social")
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (!inactivos) consulta = consulta.eq("activo", true);
  if (tipo) consulta = consulta.eq("tipo_cliente", tipo);
  if (idsConDeuda !== null) consulta = consulta.in("id", idsConDeuda.length ? idsConDeuda : [-1]);
  if (q) {
    consulta = consulta.or(
      ["razon_social", "nombre_comercial", "numero_documento", "codigo", "municipio"]
        .map((c) => `${c}.ilike.%${q}%`)
        .join(","),
    );
  }

  const { data: clientes, count, error: errorLista } = await consulta;
  lanzarSiError({ error: errorLista });
  const filas = clientes ?? [];
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  // Facturado, pendiente y riesgo 90+ días de los clientes visibles.
  const ids = filas.map((c) => c.id);
  const [{ data: facturas }, { data: cobros }] = ids.length
    ? await Promise.all([
        supabase
          .from("documentos")
          .select("cliente_id, total")
          .in("cliente_id", ids)
          .in("tipo", ["factura", "rectificativa"])
          .neq("estado", "borrador"),
        supabase
          .from("v_estado_cobro")
          .select("cliente_id, pendiente, estado_cobro, fecha_vencimiento")
          .in("cliente_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  const facturado = new Map<number, number>();
  for (const f of facturas ?? []) {
    if (f.cliente_id != null) facturado.set(f.cliente_id, (facturado.get(f.cliente_id) ?? 0) + Number(f.total));
  }

  const pendiente = new Map<number, number>();
  const maxDiasVencido = new Map<number, number>();
  const critica90 = new Set<number>();

  for (const c of cobros ?? []) {
    if (c.cliente_id == null) continue;
    const pend = Number(c.pendiente ?? 0);
    pendiente.set(c.cliente_id, (pendiente.get(c.cliente_id) ?? 0) + pend);
    if (pend > 0.01) {
      const aging = clasificarAgingCobro(c.estado_cobro, c.fecha_vencimiento, hoy);
      if (aging.esCritica90) critica90.add(c.cliente_id);
      if (aging.diasVencido > (maxDiasVencido.get(c.cliente_id) ?? 0)) {
        maxDiasVencido.set(c.cliente_id, aging.diasVencido);
      }
    }
  }

  const totalFacturadoVisible = filas.reduce((s, c) => s + (facturado.get(c.id) ?? 0), 0);
  const totalPendienteVisible = filas.reduce((s, c) => s + (pendiente.get(c.id) ?? 0), 0);

  const actual: Filtros = {
    tipo: tipo ?? "",
    q,
    inactivos: inactivos ? "1" : "",
    con_deuda: conDeuda ? "1" : "",
  };

  const chips: { clave: keyof Filtros; texto: string }[] = [];
  if (tipo) chips.push({ clave: "tipo", texto: ETIQUETA_TIPO_CLIENTE[tipo] ?? tipo });
  if (conDeuda) chips.push({ clave: "con_deuda", texto: "Con deuda pendiente" });
  if (inactivos) chips.push({ clave: "inactivos", texto: "Incluye inactivos" });
  if (q) chips.push({ clave: "q", texto: `"${q}"` });
  const hayFiltros = chips.length > 0;

  return (
    <div className="flex flex-col gap-esp5">
      <div className="flex flex-wrap items-center gap-esp3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-texto-primario">Clientes</h1>
          <p className="tabular-nums text-sm text-texto-secundario">
            {total} cliente{total === 1 ? "" : "s"}
            {inactivos ? " (incluye inactivos)" : ""}
            {filas.length > 0 && (
              <>
                {" · "}
                <span className="text-texto-primario">{euros(totalFacturadoVisible)}</span> facturados
                {totalPendienteVisible > 0.01 && (
                  <>
                    {" · "}
                    <span className="font-medium text-texto-peligro">{euros(totalPendienteVisible)}</span> pendientes
                  </>
                )}
              </>
            )}
          </p>
        </div>
        <Link href="/admin/clientes/nuevo" className="shrink-0">
          <Boton>
            <Icono nombre="mas" size={16} />
            Nuevo cliente
          </Boton>
        </Link>
      </div>

      {/* Barra de búsqueda y filtros compacta */}
      <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie p-esp3 shadow-xs md:p-esp4">
        <form action="/admin/clientes" className="flex flex-wrap items-center gap-esp2">
          {tipo && <input type="hidden" name="tipo" value={tipo} />}
          {conDeuda && <input type="hidden" name="con_deuda" value="1" />}
          <div className="relative min-w-[200px] flex-1 md:max-w-sm">
            <Icono
              nombre="buscar"
              size={15}
              className="pointer-events-none absolute left-esp3 top-1/2 -translate-y-1/2 text-icono-secundario"
            />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Nombre, NIF, código o ciudad…"
              aria-label="Buscar clientes"
              className="min-h-11 h-11 w-full rounded-md border border-borde-campo bg-fondo-superficie pl-9 pr-esp3 text-base text-texto-primario outline-none focus:border-borde-foco focus:ring-2 focus:ring-borde-foco/20 md:min-h-9 md:h-9 md:text-sm"
            />
          </div>
          <Boton type="submit" variante="secundario">
            Buscar
          </Boton>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-esp2 px-esp2 text-xs text-texto-secundario md:min-h-8">
            <input type="checkbox" name="inactivos" value="1" defaultChecked={inactivos} className="h-4 w-4" />
            Ver inactivos
          </label>
          <Link
            href={enlace(actual, { con_deuda: conDeuda ? "" : "1", pagina: "" })}
            aria-pressed={conDeuda}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-completo border px-esp3 text-xs font-medium transition-colors duration-rapida ease-suave active:scale-press md:ml-auto md:min-h-8 ${
              conDeuda
                ? "border-borde-critico bg-fondo-critico text-texto-inverso"
                : "border-borde-critico-sutil bg-fondo-critico-sutil text-texto-critico hover:border-borde-critico"
            }`}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-completo bg-current" />
            Con deuda pendiente
          </Link>
        </form>

        <div className="flex flex-col gap-esp1 border-t border-borde-default pt-esp3">
          <p className="text-micro font-semibold uppercase tracking-wide text-texto-terciario">Segmento</p>
          <div className="flex flex-wrap items-center gap-esp2" role="group" aria-label="Filtrar por tipo de cliente">
            {[{ valor: "", etiqueta: "Todos" }, ...TIPOS_CLIENTE].map((t) => {
              const activo = (tipo ?? "") === t.valor;
              return (
                <Link
                  key={t.valor}
                  href={enlace(actual, { tipo: t.valor, pagina: "" })}
                  aria-current={activo ? "true" : undefined}
                  className={`inline-flex min-h-10 items-center rounded-completo px-esp3 text-xs font-medium transition-colors duration-rapida ease-suave active:scale-press md:min-h-8 ${
                    activo
                      ? "bg-fondo-marca text-texto-sobre-marca"
                      : "border border-borde-default bg-fondo-superficie text-texto-secundario hover:bg-fondo-sutil"
                  }`}
                >
                  {t.etiqueta}
                </Link>
              );
            })}
          </div>
        </div>

        {hayFiltros && (
          <div className="flex flex-wrap items-center gap-esp2 border-t border-borde-default pt-esp3 text-sm">
            <span className="text-xs text-texto-terciario">Filtrando por:</span>
            {chips.map((c) => (
              <Link
                key={c.clave}
                href={enlace(actual, { [c.clave]: "", pagina: "" })}
                aria-label={`Quitar filtro ${c.texto}`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-completo border border-borde-campo bg-fondo-sutil pl-esp3 pr-esp2 text-xs text-texto-primario transition-colors duration-rapida ease-suave hover:bg-fondo-hover active:scale-press md:min-h-8"
              >
                <span className="max-w-[60vw] truncate">{c.texto}</span>
                <span aria-hidden="true" className="text-sm leading-none text-texto-terciario">
                  ×
                </span>
              </Link>
            ))}
            <Link
              href="/admin/clientes"
              className="inline-flex min-h-10 items-center px-esp2 text-xs font-medium text-texto-marca md:min-h-8"
            >
              Quitar todos
            </Link>
          </div>
        )}
      </div>

      {/* Data Grid estilo Attio con anchura garantizada para el nombre en tablet/desktop */}
      <div className="overflow-hidden rounded-lg border border-borde-default bg-fondo-superficie shadow-xs">
        <div className="hidden items-center gap-esp4 border-b border-borde-default bg-fondo-sutil/70 px-esp5 py-esp2 text-micro font-semibold uppercase tracking-wider text-texto-terciario md:grid md:grid-cols-[minmax(220px,1fr)_115px_145px] xl:grid-cols-[minmax(260px,1.8fr)_170px_130px_120px_155px] xl:px-esp6">
          <span>Cliente</span>
          <span className="hidden xl:block">Segmento</span>
          <span className="hidden xl:block">Ubicación</span>
          <span className="text-right">Facturado</span>
          <span className="text-right">Pendiente / Riesgo</span>
        </div>

        <div className="flex flex-col divide-y divide-borde-default">
          {filas.map((c) => {
            const fact = facturado.get(c.id) ?? 0;
            const pend = pendiente.get(c.id) ?? 0;
            const tieneDeuda = pend > 0.005;
            const esCritico90 = critica90.has(c.id);
            const diasMax = maxDiasVencido.get(c.id) ?? 0;
            const etiquetaTipo = ETIQUETA_TIPO_CLIENTE[c.tipo_cliente] ?? c.tipo_cliente;

            return (
              <Link
                key={c.id}
                href={`/admin/clientes/${c.id}`}
                className={`flex flex-col gap-esp2 px-esp4 py-esp3 transition-colors duration-rapida ease-suave md:grid md:grid-cols-[minmax(220px,1fr)_115px_145px] md:items-center md:gap-esp4 md:px-esp5 xl:grid-cols-[minmax(260px,1.8fr)_170px_130px_120px_155px] xl:px-esp6 ${
                  esCritico90
                    ? "border-l-4 border-l-borde-critico bg-fondo-critico-sutil/40 hover:bg-fondo-critico-sutil/70"
                    : "hover:bg-fondo-sutil/60"
                }`}
              >
                <div className="flex min-w-0 items-center gap-esp3">
                  <div
                    aria-hidden="true"
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-xs font-semibold md:h-9 md:w-9 ${
                      esCritico90
                        ? "bg-fondo-critico text-texto-inverso"
                        : "border border-borde-marca bg-fondo-marca-sutil text-texto-marca"
                    }`}
                  >
                    {inicialesCliente(c.razon_social)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-esp2">
                      <p className="truncate text-sm font-medium text-texto-primario">{c.razon_social}</p>
                      {!c.activo && <Insignia tono="neutro">Inactivo</Insignia>}
                    </div>
                    <p className="truncate text-xs text-texto-terciario">
                      {c.codigo}
                      {c.numero_documento ? ` · ${c.numero_documento}` : ""}
                      {c.municipio ? <span className="xl:hidden"> · {c.municipio}</span> : null}
                      <span className="hidden md:inline xl:hidden"> · {etiquetaTipo}</span>
                    </p>
                  </div>
                </div>

                <span className="hidden truncate text-xs text-texto-secundario xl:block">{etiquetaTipo}</span>

                <span className="hidden truncate text-xs text-texto-terciario xl:block">{c.municipio ?? "—"}</span>

                {/* Desktop/Tablet: Facturado */}
                <span className="tabular-nums hidden text-right text-sm font-medium text-texto-primario md:block">
                  {euros(fact)}
                </span>

                {/* Desktop/Tablet: Pendiente / Riesgo */}
                <div className="hidden flex-col items-end gap-0.5 md:flex">
                  {tieneDeuda ? (
                    <>
                      <span
                        className={`tabular-nums text-sm font-semibold ${
                          esCritico90 ? "text-texto-critico" : "text-texto-peligro"
                        }`}
                      >
                        {euros(pend)}
                      </span>
                      {esCritico90 ? (
                        <Insignia tono="critico" solido>
                          90+ días · {diasMax}d
                        </Insignia>
                      ) : diasMax > 0 ? (
                        <span className="tabular-nums text-micro text-texto-peligro">Vencida {diasMax}d</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="tabular-nums text-xs text-texto-exito">Al día</span>
                  )}
                </div>

                {/* Móvil: barra financiera compacta sin compresión */}
                <div className="flex flex-wrap items-center justify-between gap-esp2 rounded-md bg-fondo-sutil/70 px-esp3 py-esp1.5 text-xs md:hidden">
                  <span className="tabular-nums text-texto-secundario">
                    Facturado: <strong className="font-medium text-texto-primario">{euros(fact)}</strong>
                  </span>
                  {tieneDeuda ? (
                    <div className="flex items-center gap-esp2">
                      <span
                        className={`tabular-nums font-semibold ${
                          esCritico90 ? "text-texto-critico" : "text-texto-peligro"
                        }`}
                      >
                        Pend.: {euros(pend)}
                      </span>
                      {esCritico90 && (
                        <Insignia tono="critico" solido>
                          90+d
                        </Insignia>
                      )}
                    </div>
                  ) : (
                    <span className="font-medium text-texto-exito">Al día</span>
                  )}
                </div>
              </Link>
            );
          })}
          {filas.length === 0 && (
            <p className="px-esp6 py-esp6 text-sm text-texto-terciario">No hay clientes con estos filtros.</p>
          )}
        </div>
      </div>

      {paginas > 1 && (
        <div className="flex items-center justify-center gap-esp4 text-sm text-texto-secundario [&_a]:inline-flex [&_a]:min-h-10 [&_a]:items-center">
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
