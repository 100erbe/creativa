import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { TarjetaKpi } from "@/components/ui/tarjeta-kpi";
import { Insignia } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { euros, fechaMedia } from "@/lib/formato";
import { ModalRevisarGasto, type GastoRevision } from "./modal-revisar";
import {
  BUCKET_TICKETS,
  ESTADOS_GASTO,
  ETIQUETA_ESTADO_GASTO,
  ETIQUETA_FORMA_PAGO_GASTO,
  ETIQUETA_TIPO_GASTO,
  TONO_ESTADO_GASTO,
} from "@/lib/gastos";

export const dynamic = "force-dynamic";

const POR_PAGINA = 50;
const TRIMESTRES = [1, 2, 3, 4];

type Filtros = { revisar?: string; tipo?: string; estado?: string; ejercicio?: string; trimestre?: string; q?: string; pagina?: string };

function enlace(actual: Filtros, cambios: Partial<Filtros>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...actual, ...cambios })) if (v) params.set(k, v);
  const s = params.toString();
  return s ? `/admin/gastos?${s}` : "/admin/gastos";
}

export default async function PaginaGastos({ searchParams }: { searchParams: Promise<Filtros> }) {
  const filtros = await searchParams;
  await exigirAdmin();
  const supabase = await createClient();

  const res = await supabase
    .from("gastos")
    .select("*, categorias_gasto(nombre), usuarios!gastos_usuario_id_fkey(nombre, apellidos)")
    .order("fecha", { ascending: false })
    .order("id", { ascending: false })
    .limit(5000);
  lanzarSiError(res);
  const todos = res.data ?? [];

  const ejercicios = [...new Set(todos.map((g) => Number(g.fecha.slice(0, 4))))].sort((a, b) => b - a);
  const pedido = Number(filtros.ejercicio);
  const ejercicio = ejercicios.includes(pedido) ? pedido : (ejercicios[0] ?? new Date().getFullYear());
  const trimestre = TRIMESTRES.includes(Number(filtros.trimestre)) ? Number(filtros.trimestre) : 0;
  const tipo = filtros.tipo === "deducible" || filtros.tipo === "menor" ? filtros.tipo : "todos";
  const estado = (ESTADOS_GASTO as readonly string[]).includes(filtros.estado ?? "") ? filtros.estado : "";
  const q = (filtros.q ?? "").trim().toLowerCase();
  const pagina = Math.max(1, Number(filtros.pagina) || 1);

  const delAnio = todos.filter((g) => g.fecha.startsWith(String(ejercicio)));
  const trimestreDe = (fecha: string) => Math.ceil(Number(fecha.slice(5, 7)) / 3);
  const filtrados = delAnio.filter(
    (g) =>
      (tipo === "todos" || g.tipo === tipo) &&
      (!estado || g.estado === estado) &&
      (!trimestre || trimestreDe(g.fecha) === trimestre) &&
      (!q ||
        [g.codigo, g.concepto, g.proveedor, g.numero_factura, g.usuarios?.nombre].some((v) =>
          v?.toLowerCase().includes(q),
        )),
  );
  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const visibles = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const suma = (filas: typeof todos, campo: "total" | "base_imponible" | "cuota_iva") =>
    filas.reduce((s, g) => s + Number(g[campo] ?? 0), 0);
  const deduciblesAnio = delAnio.filter((g) => g.tipo === "deducible");
  const menoresAnio = delAnio.filter((g) => g.tipo === "menor");
  const porAprobar = delAnio.filter((g) => g.estado === "pendiente");
  const porReembolsar = delAnio.filter((g) => g.estado === "aprobado");
  const ivaSoportado = suma(
    deduciblesAnio.filter((g) => g.estado === "aprobado" || g.estado === "reembolsado"),
    "cuota_iva",
  );

  const actual: Filtros = {
    tipo: tipo === "todos" ? "" : tipo,
    estado: estado ?? "",
    ejercicio: String(ejercicio),
    trimestre: trimestre ? String(trimestre) : "",
    q: filtros.q ?? "",
  };
  // Panel de revisión (se abre desde el aviso de la campana o con "Revisar"): ?revisar=ID
  const aRevisar = todos.find((g) => String(g.id) === filtros.revisar);
  let revision: GastoRevision | null = null;
  if (aRevisar) {
    const firma = aRevisar.ticket_path
      ? await supabase.storage.from(BUCKET_TICKETS).createSignedUrl(aRevisar.ticket_path, 600)
      : null;
    revision = {
      id: aRevisar.id,
      codigo: aRevisar.codigo,
      tipo: aRevisar.tipo,
      estado: aRevisar.estado,
      concepto: aRevisar.concepto,
      fecha: fechaMedia(aRevisar.fecha),
      total: euros(Number(aRevisar.total)),
      responsable: aRevisar.usuarios ? [aRevisar.usuarios.nombre, aRevisar.usuarios.apellidos].filter(Boolean).join(" ") : null,
      categoria: aRevisar.categorias_gasto?.nombre ?? null,
      formaPago: aRevisar.forma_pago,
      notas: aRevisar.notas,
      proveedor: aRevisar.proveedor,
      numeroFactura: aRevisar.numero_factura,
      urlTicket: firma?.data?.signedUrl ?? null,
      esPdf: aRevisar.ticket_path?.endsWith(".pdf") ?? false,
    };
  }
  const primeraPendiente = todos.filter((g) => g.estado === "pendiente").at(-1);

  const chip = (activo: boolean) =>
    activo
      ? "rounded-completo bg-fondo-marca px-esp3 py-esp1 text-sm font-medium text-texto-sobre-marca"
      : "rounded-completo border border-borde-default bg-fondo-superficie px-esp3 py-esp1 text-sm text-texto-secundario hover:bg-fondo-sutil";

  return (
    <div className="flex flex-col gap-esp6">
      {revision && <ModalRevisarGasto gasto={revision} cerrarHref={enlace(actual, {})} />}
      <div className="flex flex-wrap items-center gap-esp3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-texto-primario">Gastos</h1>
          <p className="text-sm text-texto-secundario">
            Gastos deducibles (con IVA soportado) y gastos menores de caja, con aprobación y reembolso.
          </p>
        </div>
        <form action="/admin/gastos" className="flex items-center gap-esp2">
          <label className="text-sm text-texto-secundario" htmlFor="ejercicio">
            Ejercicio
          </label>
          <select
            id="ejercicio"
            name="ejercicio"
            defaultValue={ejercicio}
            className="h-9 rounded-md border border-borde-campo bg-fondo-superficie px-esp2 text-sm text-texto-primario"
          >
            {(ejercicios.length ? ejercicios : [ejercicio]).map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <Boton type="submit" variante="secundario">
            Ver
          </Boton>
        </form>
        <Link href="/admin/gastos/nuevo">
          <Boton>
            <Icono nombre="mas" size={16} />
            Nuevo gasto
          </Boton>
        </Link>
      </div>

      {primeraPendiente && (
        <div className="flex flex-wrap items-center gap-esp3 rounded-md border border-borde-aviso bg-fondo-aviso-sutil px-esp4 py-esp3">
          <Icono nombre="alerta" size={18} className="text-texto-aviso" />
          <p className="flex-1 text-sm text-texto-primario">
            {todos.filter((g) => g.estado === "pendiente").length} gasto(s) esperan tu revisión.
          </p>
          <Link href={enlace(actual, { revisar: String(primeraPendiente.id) })}>
            <Boton tamano="s">Revisar el más antiguo</Boton>
          </Link>
        </div>
      )}

      <div className="flex flex-wrap gap-esp4 [&>*]:min-w-[160px]">
        <TarjetaKpi
          etiqueta="Pendientes de aprobar"
          valor={euros(suma(porAprobar, "total"))}
          detalle={`${porAprobar.length} gasto${porAprobar.length === 1 ? "" : "s"}`}
          colorDetalle={porAprobar.length ? "text-texto-aviso" : undefined}
          href={enlace(actual, { estado: "pendiente", pagina: "" })}
        />
        <TarjetaKpi
          etiqueta="Pendientes de reembolso"
          valor={euros(suma(porReembolsar, "total"))}
          detalle={`${porReembolsar.length} aprobado${porReembolsar.length === 1 ? "" : "s"}`}
          href={enlace(actual, { estado: "aprobado", pagina: "" })}
        />
        <TarjetaKpi
          etiqueta={`IVA soportado ${ejercicio}`}
          valor={euros(ivaSoportado)}
          detalle={`${deduciblesAnio.length} deducibles · ${euros(suma(deduciblesAnio, "total"))}`}
        />
        <TarjetaKpi
          etiqueta="Gastos menores (no deducibles)"
          valor={euros(suma(menoresAnio, "total"))}
          detalle={`${menoresAnio.length} gasto${menoresAnio.length === 1 ? "" : "s"}`}
          href={enlace(actual, { tipo: "menor", pagina: "" })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-esp3">
        <div className="flex flex-wrap gap-esp2">
          {[
            { v: "", e: "Todos" },
            { v: "deducible", e: "Deducibles" },
            { v: "menor", e: "Menores" },
          ].map((t) => (
            <Link key={t.v} href={enlace(actual, { tipo: t.v, pagina: "" })} className={chip((tipo === "todos" ? "" : tipo) === t.v)}>
              {t.e}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-esp2">
          <Link href={enlace(actual, { estado: "", pagina: "" })} className={chip(!estado)}>
            Cualquier estado
          </Link>
          {ESTADOS_GASTO.map((e) => (
            <Link key={e} href={enlace(actual, { estado: e, pagina: "" })} className={chip(estado === e)}>
              {ETIQUETA_ESTADO_GASTO[e]}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-esp2">
          {[{ n: 0, e: "Año" }, ...TRIMESTRES.map((n) => ({ n, e: `T${n}` }))].map((t) => (
            <Link key={t.n} href={enlace(actual, { trimestre: t.n ? String(t.n) : "", pagina: "" })} className={chip(trimestre === t.n)}>
              {t.e}
            </Link>
          ))}
        </div>
        <form action="/admin/gastos" className="ml-auto flex items-center gap-esp2">
          {Object.entries({ ...actual, q: "" }).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
          <input
            name="q"
            defaultValue={filtros.q ?? ""}
            placeholder="Concepto, proveedor, código…"
            className="h-9 w-[220px] rounded-md border border-borde-campo bg-fondo-superficie px-esp3 text-sm text-texto-primario outline-none focus:border-borde-foco"
          />
          <Boton type="submit" variante="secundario">
            Buscar
          </Boton>
        </form>
      </div>

      <div className="flex flex-col divide-y divide-fondo-hover rounded-lg border border-borde-default bg-fondo-superficie px-esp4 md:px-esp6">
        {visibles.map((g) => (
          <Link
            key={g.id}
            // Pendiente → panel de revisión (con enlace a la ficha); el resto → ficha del gasto.
            href={g.estado === "pendiente" ? enlace(actual, { revisar: String(g.id) }) : `/admin/gastos/${g.id}`}
            className="grid grid-cols-[1fr_auto] items-center gap-x-esp3 gap-y-1 py-esp3 hover:bg-fondo-sutil lg:flex lg:gap-esp4"
          >
            <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md bg-fondo-sutil lg:flex">
              <Icono nombre="gastos" size={18} className="text-icono-default" />
            </div>
            <div className="min-w-0 lg:flex-1">
              <p className="truncate text-micro font-normal uppercase tracking-wide text-texto-terciario">
                {g.codigo} · {ETIQUETA_TIPO_GASTO[g.tipo]}
                {g.categorias_gasto?.nombre ? ` · ${g.categorias_gasto.nombre}` : ""}
              </p>
              <p className="truncate text-sm font-medium text-texto-primario">{g.concepto}</p>
              <p className="truncate text-xs text-texto-terciario">
                {g.proveedor ? `${g.proveedor} · ` : ""}
                {g.usuarios?.nombre ?? "—"}
                <span className="lg:hidden"> · {fechaMedia(g.fecha)}</span>
              </p>
            </div>
            <span className="hidden w-[100px] text-xs text-texto-terciario lg:block">{fechaMedia(g.fecha)}</span>
            <span className="hidden w-[110px] text-xs text-texto-terciario lg:block">
              {ETIQUETA_FORMA_PAGO_GASTO[g.forma_pago]}
            </span>
            <span className="hidden w-[90px] text-xs lg:block">
              {g.ticket_path ? (
                <span className="text-texto-exito">✓ Adjunto</span>
              ) : (
                <span className="text-texto-aviso">⚠ Falta ticket</span>
              )}
            </span>
            <span className="whitespace-nowrap text-right lg:w-[110px]">
              <span className="block text-sm font-medium text-texto-primario">{euros(Number(g.total))}</span>
              {g.cuota_iva != null && (
                <span className="block text-xs text-texto-terciario">IVA {euros(Number(g.cuota_iva))}</span>
              )}
            </span>
            <div className="col-span-2 flex flex-wrap items-center gap-1 lg:col-span-1 lg:w-[110px] lg:justify-end">
              <Insignia tono={TONO_ESTADO_GASTO[g.estado]}>{ETIQUETA_ESTADO_GASTO[g.estado]}</Insignia>
              {!g.ticket_path && <span className="text-xs text-texto-aviso lg:hidden">⚠ Falta ticket</span>}
            </div>
          </Link>
        ))}
        {visibles.length === 0 && (
          <p className="py-esp5 text-sm text-texto-terciario">No hay gastos con estos filtros.</p>
        )}
        {filtrados.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-esp5 gap-y-1 bg-fondo-sutil px-esp4 py-esp3 text-sm font-semibold text-texto-primario md:-mx-esp6 md:px-esp6">
            <span className="flex-1">
              Total ({filtrados.length} gasto{filtrados.length === 1 ? "" : "s"})
            </span>
            <span className="font-normal text-texto-secundario">Base {euros(suma(filtrados, "base_imponible"))}</span>
            <span className="font-normal text-texto-secundario">IVA {euros(suma(filtrados, "cuota_iva"))}</span>
            <span>{euros(suma(filtrados, "total"))}</span>
          </div>
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

      <div>
        <a href={`/admin/gastos/exportar?ejercicio=${ejercicio}${trimestre ? `&trimestre=${trimestre}` : ""}`} download>
          <Boton variante="secundario">
            <Icono nombre="descargar" size={16} />
            Exportar CSV{trimestre ? ` (T${trimestre})` : ""}
          </Boton>
        </a>
      </div>
    </div>
  );
}
