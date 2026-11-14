import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { euros, fechaMedia } from "@/lib/formato";
import { ETIQUETA_COBRO, ETIQUETA_ESTADO_DOC, ETIQUETA_TIPO } from "@/lib/documentos";

export const dynamic = "force-dynamic";

const POR_PAGINA = 25;

const TIPOS = [
  { valor: "", etiqueta: "Todos" },
  { valor: "presupuesto", etiqueta: "Presupuestos" },
  { valor: "albaran", etiqueta: "Albaranes" },
  { valor: "factura", etiqueta: "Facturas" },
  { valor: "rectificativa", etiqueta: "Rectificativas" },
];

const ESTADOS = [
  { valor: "", etiqueta: "Cualquier estado" },
  { valor: "borrador", etiqueta: "Borradores" },
  { valor: "emitido", etiqueta: "Emitidos" },
  { valor: "facturado", etiqueta: "Facturados" },
];

type Filtros = { tipo?: string; estado?: string; q?: string; pagina?: string };

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
      "id, tipo, estado, numero_completo, fecha, creado_en, total, cliente_razon_social, clientes(razon_social)",
      { count: "exact" },
    )
    .order("fecha", { ascending: false })
    .order("id", { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (tipo) consulta = consulta.eq("tipo", tipo as "factura");
  if (estado) consulta = consulta.eq("estado", estado as "borrador");
  if (condicionBusqueda) consulta = consulta.or(condicionBusqueda);

  const { data: documentos, count } = await consulta;
  const filas = documentos ?? [];
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  // Estado de cobro solo de las facturas que se muestran.
  const idsFacturas = filas.filter((d) => d.tipo === "factura" && d.estado !== "borrador").map((d) => d.id);
  const { data: cobros } = idsFacturas.length
    ? await supabase.from("v_estado_cobro").select("id, estado_cobro").in("id", idsFacturas)
    : { data: [] };
  const cobroPorId = new Map((cobros ?? []).map((c) => [c.id, c.estado_cobro]));

  const actual: Filtros = { tipo, estado, q };

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

      <div className="flex flex-col gap-esp3 md:flex-row md:flex-wrap md:items-center">
        <div className="-mx-esp4 flex gap-esp2 overflow-x-auto px-esp4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
          {TIPOS.map((t) => (
            <Link
              key={t.valor}
              href={enlace(actual, { tipo: t.valor, pagina: "" })}
              className={
                tipo === t.valor
                  ? "inline-flex min-h-10 shrink-0 items-center rounded-completo bg-fondo-marca px-esp3 text-sm font-medium text-texto-sobre-marca md:min-h-0 md:py-esp1"
                  : "inline-flex min-h-10 shrink-0 items-center rounded-completo border border-borde-default bg-fondo-superficie px-esp3 text-sm text-texto-secundario hover:bg-fondo-sutil md:min-h-0 md:py-esp1"
              }
            >
              {t.etiqueta}
            </Link>
          ))}
        </div>
        <form action="/admin/documentos" className="flex flex-wrap items-center gap-esp2 md:ml-auto md:flex-nowrap">
          {tipo && <input type="hidden" name="tipo" value={tipo} />}
          <select
            name="estado"
            defaultValue={estado}
            className="h-10 min-w-0 flex-1 rounded-md border border-borde-fuerte bg-fondo-superficie px-esp2 md:flex-none text-base text-texto-primario md:h-9 md:text-sm"
          >
            {ESTADOS.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.etiqueta}
              </option>
            ))}
          </select>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Número o cliente…"
            className="order-first h-10 w-full min-w-0 rounded-md border border-borde-fuerte bg-fondo-superficie px-esp3 text-base text-texto-primario outline-none focus:border-borde-foco md:order-none md:h-9 md:w-[200px] md:text-sm"
          />
          <Boton type="submit" variante="secundario">
            Buscar
          </Boton>
        </form>
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
                <p className="truncate text-sm font-medium text-texto-primario">
                  {d.numero_completo ?? `${ETIQUETA_TIPO[d.tipo] ?? d.tipo} (borrador)`}
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
