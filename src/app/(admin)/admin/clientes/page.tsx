import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { Insignia } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { euros } from "@/lib/formato";
import { ETIQUETA_TIPO_CLIENTE, TIPOS_CLIENTE, VALORES_TIPO_CLIENTE } from "@/lib/clientes";

export const dynamic = "force-dynamic";

const POR_PAGINA = 25;

type Filtros = { tipo?: string; q?: string; inactivos?: string; pagina?: string };

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
  // Se quitan los caracteres que rompen la sintaxis de .or() de PostgREST.
  const q = (filtros.q ?? "").replace(/[,()%*\\]/g, " ").trim();
  const pagina = Math.max(1, Number(filtros.pagina) || 1);

  const supabase = await createClient();

  let consulta = supabase
    .from("clientes")
    .select("id, codigo, razon_social, nombre_comercial, numero_documento, municipio, tipo_cliente, activo", {
      count: "exact",
    })
    .order("razon_social")
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (!inactivos) consulta = consulta.eq("activo", true);
  if (tipo) consulta = consulta.eq("tipo_cliente", tipo);
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

  // Facturado y pendiente solo de los clientes que se muestran.
  const ids = filas.map((c) => c.id);
  const [{ data: facturas }, { data: cobros }] = ids.length
    ? await Promise.all([
        supabase
          .from("documentos")
          .select("cliente_id, total")
          .in("cliente_id", ids)
          .in("tipo", ["factura", "rectificativa"])
          .neq("estado", "borrador"),
        supabase.from("v_estado_cobro").select("cliente_id, pendiente").in("cliente_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  const facturado = new Map<number, number>();
  for (const f of facturas ?? []) {
    if (f.cliente_id != null) facturado.set(f.cliente_id, (facturado.get(f.cliente_id) ?? 0) + Number(f.total));
  }
  const pendiente = new Map<number, number>();
  for (const c of cobros ?? []) {
    if (c.cliente_id != null) pendiente.set(c.cliente_id, (pendiente.get(c.cliente_id) ?? 0) + Number(c.pendiente));
  }

  const actual: Filtros = { tipo: tipo ?? "", q, inactivos: inactivos ? "1" : "" };

  return (
    <div className="flex flex-col gap-esp6">
      <div className="flex items-center gap-esp3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-texto-primario">Clientes</h1>
          <p className="text-sm text-texto-secundario">
            {total} cliente{total === 1 ? "" : "s"}
            {inactivos ? " (incluye inactivos)" : ""}
          </p>
        </div>
        <Link href="/admin/clientes/nuevo">
          <Boton>
            <Icono nombre="mas" size={16} />
            Nuevo cliente
          </Boton>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-esp3">
        <div className="flex flex-wrap gap-esp2">
          {[{ valor: "", etiqueta: "Todos" }, ...TIPOS_CLIENTE].map((t) => (
            <Link
              key={t.valor}
              href={enlace(actual, { tipo: t.valor, pagina: "" })}
              className={
                (tipo ?? "") === t.valor
                  ? "rounded-completo bg-fondo-marca px-esp3 py-esp1 text-sm font-medium text-texto-sobre-marca"
                  : "rounded-completo border border-borde-default bg-fondo-superficie px-esp3 py-esp1 text-sm text-texto-secundario hover:bg-fondo-sutil"
              }
            >
              {t.etiqueta}
            </Link>
          ))}
        </div>
        <form action="/admin/clientes" className="ml-auto flex items-center gap-esp2">
          {tipo && <input type="hidden" name="tipo" value={tipo} />}
          <label className="flex items-center gap-esp1 text-xs text-texto-secundario">
            <input type="checkbox" name="inactivos" value="1" defaultChecked={inactivos} />
            Ver inactivos
          </label>
          <input
            name="q"
            defaultValue={q}
            placeholder="Nombre, NIF, código…"
            className="h-9 w-[220px] rounded-md border border-borde-fuerte bg-fondo-superficie px-esp3 text-sm text-texto-primario outline-none focus:border-borde-foco"
          />
          <Boton type="submit" variante="secundario">
            Buscar
          </Boton>
        </form>
      </div>

      <div className="flex flex-col divide-y divide-fondo-hover rounded-lg border border-borde-default bg-fondo-superficie px-esp6">
        {filas.map((c) => (
          <Link key={c.id} href={`/admin/clientes/${c.id}`} className="flex items-center gap-esp4 py-esp3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-fondo-sutil">
              <Icono nombre="clientes" size={18} className="text-icono-default" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-texto-primario">{c.razon_social}</p>
              <p className="truncate text-xs text-texto-terciario">
                {c.codigo}
                {c.numero_documento ? ` · ${c.numero_documento}` : ""}
                {c.municipio ? ` · ${c.municipio}` : ""}
              </p>
            </div>
            <span className="hidden w-[170px] text-xs text-texto-terciario lg:block">
              {ETIQUETA_TIPO_CLIENTE[c.tipo_cliente] ?? c.tipo_cliente}
            </span>
            <div className="hidden w-[110px] flex-col items-end md:flex">
              <span className="text-sm font-medium text-texto-primario">
                {euros(facturado.get(c.id) ?? 0)}
              </span>
              <span className="text-xs text-texto-terciario">facturado</span>
            </div>
            <div className="hidden w-[110px] flex-col items-end md:flex">
              {(pendiente.get(c.id) ?? 0) > 0.005 ? (
                <span className="text-sm font-medium text-texto-peligro">{euros(pendiente.get(c.id) ?? 0)}</span>
              ) : (
                <span className="text-sm text-texto-terciario">—</span>
              )}
              <span className="text-xs text-texto-terciario">pendiente</span>
            </div>
            {!c.activo && <Insignia tono="neutro">Inactivo</Insignia>}
          </Link>
        ))}
        {filas.length === 0 && (
          <p className="py-esp5 text-sm text-texto-terciario">No hay clientes con estos filtros.</p>
        )}
      </div>

      {paginas > 1 && (
        <div className="flex items-center justify-center gap-esp4 text-sm text-texto-secundario">
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
