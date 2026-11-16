import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { euros, fechaMedia } from "@/lib/formato";
import { ETIQUETA_COBRO, ETIQUETA_ESTADO_DOC, ETIQUETA_TIPO, validezVencida } from "@/lib/documentos";
import { LimpiarBorradores } from "./limpiar-borradores";

export const dynamic = "force-dynamic";

const POR_PAGINA = 25;

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
  { valor: "pendiente", etiqueta: "Por cobrar" },
  { valor: "vencida", etiqueta: "Vencida" },
];

const PILDORA = "inline-flex min-h-10 items-center gap-1.5 rounded-completo px-esp3 text-sm md:min-h-8";

type Filtros = { tipo?: string; estado?: string; q?: string; cliente?: string; cobro?: string; pagina?: string };

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
  const tipo = TIPOS.some((t) => t.valor === filtros.tipo) ? (filtros.tipo ?? "") : "";
  const estado = ESTADOS.some((e) => e.valor === filtros.estado) ? (filtros.estado ?? "") : "";
  // Se quitan los caracteres que rompen la sintaxis de .or() de PostgREST.
  const q = (filtros.q ?? "").replace(/[,()%*\\]/g, " ").trim();
  const pagina = Math.max(1, Number(filtros.pagina) || 1);
  const cobro = filtros.cobro === "pendiente" || filtros.cobro === "vencida" ? filtros.cobro : "";
  const clienteId = Number.isInteger(Number(filtros.cliente)) && Number(filtros.cliente) > 0 ? Number(filtros.cliente) : null;

  const supabase = await createClient();

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
    condicionBusqueda =
      `numero_completo.ilike.%${q}%` + (ids.length ? `,cliente_id.in.(${ids.join(",")})` : "");
  }

  let consulta = supabase
    .from("documentos")
    .select(
      "id, tipo, estado, numero_completo, fecha, valido_hasta, version, creado_en, total, cliente_razon_social, clientes(razon_social)",
      { count: "exact" },
    )
    .order("fecha", { ascending: false })
    .order("id", { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (tipo) consulta = consulta.eq("tipo", tipo as "factura");
  if (estado) consulta = consulta.eq("estado", estado as "borrador");
  if (condicionBusqueda) consulta = consulta.or(condicionBusqueda);
  if (clienteId) consulta = consulta.eq("cliente_id", clienteId);
  if (cobro) {
    // Facturas con algo por cobrar (o solo las vencidas), según la vista de cobros.
    const { data: porCobrar } = await supabase
      .from("v_estado_cobro")
      .select("id")
      .in("estado_cobro", cobro === "vencida" ? ["vencida"] : ["pendiente", "parcial", "vencida"]);
    const ids = (porCobrar ?? []).flatMap((c) => (c.id == null ? [] : [c.id]));
    consulta = consulta.in("id", ids.length ? ids : [-1]);
  }

  const { data: documentos, count, error: errorLista } = await consulta;
  lanzarSiError({ error: errorLista });
  const filas = documentos ?? [];
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  // Estado de cobro solo de las facturas que se muestran.
  const idsFacturas = filas.filter((d) => d.tipo === "factura" && d.estado !== "borrador").map((d) => d.id);
  const { data: cobros } = idsFacturas.length
    ? await supabase.from("v_estado_cobro").select("id, estado_cobro").in("id", idsFacturas)
    : { data: [] };
  const cobroPorId = new Map((cobros ?? []).map((c) => [c.id, c.estado_cobro]));

  const actual: Filtros = { tipo, estado, q, cobro, cliente: clienteId ? String(clienteId) : "" };

  // Borradores sin ninguna línea con más de una hora: restos del asistente.
  const { data: borradores } = await supabase
    .from("documentos")
    .select("id, lineas_documento(id)")
    .eq("estado", "borrador")
    .lt("creado_en", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  const borradoresVacios = (borradores ?? []).filter((b) => (b.lineas_documento ?? []).length === 0).length;

  // Cuando se llega desde la ficha de un cliente se muestra de quién son los documentos.
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

  return (
    <div className="flex flex-col gap-esp6">
      <div className="flex items-center gap-esp3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-texto-primario">Documentos</h1>
          <p className="text-sm text-texto-secundario">
            Presupuestos, albaranes y facturas · {total} resultado{total === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/admin/documentos/nuevo" className="shrink-0" aria-label="Nuevo documento">
          <Boton>
            <Icono nombre="mas" size={16} />
            <span className="hidden sm:inline">Nuevo documento</span>
          </Boton>
        </Link>
      </div>

      {borradoresVacios > 0 && <LimpiarBorradores cantidad={borradoresVacios} />}

      <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie p-esp3 md:p-esp4">
        <form action="/admin/documentos" className="flex items-center gap-esp2">
          {tipo && <input type="hidden" name="tipo" value={tipo} />}
          {estado && <input type="hidden" name="estado" value={estado} />}
          {cobro && <input type="hidden" name="cobro" value={cobro} />}
          {clienteId && <input type="hidden" name="cliente" value={clienteId} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por número o cliente…"
            className="h-10 w-full min-w-0 flex-1 rounded-md border border-borde-fuerte bg-fondo-superficie px-esp3 text-base text-texto-primario outline-none focus:border-borde-foco md:h-9 md:max-w-sm md:text-sm"
          />
          <Boton type="submit" variante="secundario">
            Buscar
          </Boton>
        </form>

        {/* Nivel 1: tipo de documento (relleno oscuro) */}
        <div className="flex flex-col gap-esp1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-texto-terciario">Tipo de documento</p>
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

        {/* Nivel 2: estado (pastillas con contorno y punto) */}
        <div className="flex flex-col gap-esp1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-texto-terciario">Estado</p>
          <div className="flex flex-wrap gap-esp2" role="group" aria-label="Estado">
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
                    activo
                      ? "border-borde-peligro-sutil bg-fondo-peligro font-medium text-texto-inverso"
                      : "border-borde-peligro-sutil bg-fondo-peligro-sutil text-texto-peligro hover:opacity-80"
                  }`}
                >
                  <span aria-hidden className="h-1.5 w-1.5 rounded-completo bg-current" />
                  {c.etiqueta}
                </Link>
              );
            })}
            <span aria-hidden className="mx-esp1 hidden w-px self-stretch bg-borde-default sm:block" />
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
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-completo ${activo ? "bg-current" : "bg-borde-fuerte"}`} />
                  {e.etiqueta}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Filtros activos: siempre visibles, cada uno se quita con un toque */}
        {hayFiltros && (
          <div className="flex flex-wrap items-center gap-esp2 border-t border-borde-default pt-esp3 text-sm">
            <span className="text-texto-terciario">Filtrando por:</span>
            {chips.map((c) => (
              <Link
                key={c.clave}
                href={enlace(actual, { [c.clave]: "", pagina: "" })}
                aria-label={`Quitar filtro ${c.texto}`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-completo border border-borde-fuerte bg-fondo-sutil pl-esp3 pr-esp2 text-texto-primario md:min-h-8"
              >
                <span className="max-w-[60vw] truncate">{c.texto}</span>
                <span aria-hidden className="text-base leading-none text-texto-terciario">×</span>
              </Link>
            ))}
            <Link
              href="/admin/documentos"
              className="inline-flex min-h-10 items-center px-esp2 font-medium text-texto-marca md:min-h-8"
            >
              Quitar todos
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-col divide-y divide-fondo-hover rounded-lg border border-borde-default bg-fondo-superficie px-esp4 md:px-esp6">
        {filas.map((d) => {
          const cliente = Array.isArray(d.clientes) ? d.clientes[0] : d.clientes;
          const cobro = cobroPorId.get(d.id);
          return (
            <Link
              key={d.id}
              href={`/admin/documentos/${d.id}`}
              className="grid grid-cols-[1fr_auto] items-center gap-x-esp3 gap-y-1 py-esp3 lg:flex lg:gap-esp4"
            >
              <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md bg-fondo-sutil lg:flex">
                <Icono nombre="documentos" size={18} className="text-icono-default" />
              </div>
              <div className="min-w-0 lg:flex-1">
                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-texto-terciario lg:hidden">
                  {ETIQUETA_TIPO[d.tipo] ?? d.tipo}
                </p>
                <p className="truncate text-sm font-medium text-texto-primario">
                  {d.numero_completo ?? `${ETIQUETA_TIPO[d.tipo] ?? d.tipo} (borrador)`}
                  {d.version > 1 && <span className="font-normal text-texto-terciario"> · v{d.version}</span>}
                </p>
                <p className="truncate text-xs text-texto-terciario">
                  {d.cliente_razon_social ?? cliente?.razon_social ?? "Sin cliente"}
                  <span className="lg:hidden"> · {fechaMedia(d.fecha)}</span>
                </p>
              </div>
              <span className="hidden w-[110px] text-xs text-texto-terciario lg:block">
                {ETIQUETA_TIPO[d.tipo] ?? d.tipo}
              </span>
              <span className="hidden w-[100px] text-xs text-texto-terciario lg:block">
                {fechaMedia(d.fecha)}
              </span>
              <span
                className="hidden w-[130px] text-xs text-texto-terciario lg:block"
                title="Fecha de creación del documento"
              >
                <span className="block text-[10px] uppercase tracking-wide">Creado</span>
                {fechaMedia(d.creado_en)}{" "}
                {new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(new Date(d.creado_en))}
              </span>
              <span className="whitespace-nowrap text-right text-sm font-medium text-texto-primario lg:w-[100px]">
                {euros(Number(d.total))}
              </span>
              <div className="col-span-2 flex flex-wrap items-center gap-1 lg:col-span-1 lg:w-[150px] lg:flex-col lg:items-end">
                <Insignia tono={TONO_POR_ESTADO[d.estado] ?? "neutro"}>
                  {ETIQUETA_ESTADO_DOC[d.estado] ?? d.estado}
                </Insignia>
                {validezVencida(d.tipo, d.estado, d.valido_hasta) && <Insignia tono="aviso">Validez vencida</Insignia>}
                {cobro && cobro !== "cobrada" && (
                  <Insignia tono={TONO_POR_ESTADO[cobro] ?? "neutro"}>
                    {ETIQUETA_COBRO[cobro] ?? cobro}
                  </Insignia>
                )}
              </div>
            </Link>
          );
        })}
        {filas.length === 0 && (
          <p className="py-esp5 text-sm text-texto-terciario">No hay documentos con estos filtros.</p>
        )}
      </div>

      {paginas > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-x-esp4 gap-y-esp2 text-sm text-texto-secundario [&_a]:inline-flex [&_a]:min-h-10 [&_a]:items-center">
          {pagina > 1 ? (
            <Link href={enlace(actual, { pagina: String(pagina - 1) })} className="font-medium text-texto-marca">
              ← Anterior
            </Link>
          ) : (
            <span className="text-texto-terciario">← Anterior</span>
          )}
          <span>
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
