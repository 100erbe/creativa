import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { TarjetaKpi } from "@/components/ui/tarjeta-kpi";
import { Insignia } from "@/components/ui/insignia";
import { Boton, clasesBoton } from "@/components/ui/boton";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { Icono } from "@/components/ui/iconos";
import { BuscadorAdmin } from "@/components/admin/buscador-admin";
import { euros, fechaMedia } from "@/lib/formato";
import { ModalRevisarGasto, type GastoRevision } from "./modal-revisar";
import {
  BUCKET_TICKETS,
  ESTADOS_GASTO,
  ETIQUETA_ESTADO_GASTO,
  ETIQUETA_FORMA_PAGO_GASTO,
  ETIQUETA_TIPO_GASTO,
  TONO_ESTADO_GASTO,
  cuotaDeducible,
  trimestreDe,
} from "@/lib/gastos";
import { REVISIONES, cumpleRevision, esSinFactura, type Revision } from "@/lib/fiscal-gastos";
import { ResumenFiscalAnual, ResumenFiscalTrimestre } from "./resumen-fiscal";
import { hoyEnEspana } from "./opciones";

export const dynamic = "force-dynamic";

const POR_PAGINA = 50;
const TRIMESTRES = [1, 2, 3, 4];

type Filtros = {
  revisar?: string;
  tipo?: string;
  estado?: string;
  ejercicio?: string;
  trimestre?: string;
  q?: string;
  pagina?: string;
  /** Aviso del resumen fiscal: pendiente, sin_ticket, sin_nif, sin_numero, sin_concepto. */
  revision?: string;
};

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

  // Ejercicios disponibles (primer y último gasto) y gastos pendientes de revisar de cualquier año:
  // consultas ligeras. El listado completo se pide ya filtrado por ejercicio en la base de datos.
  const [resPrimero, resUltimo, resPendientes, resEmpresa] = await Promise.all([
    supabase.from("gastos").select("fecha").order("fecha", { ascending: true }).limit(1),
    supabase.from("gastos").select("fecha").order("fecha", { ascending: false }).limit(1),
    supabase.from("gastos").select("id").eq("estado", "pendiente").order("fecha", { ascending: false }).order("id", { ascending: false }),
    supabase.from("empresa").select("actividad_codigo, epigrafe_iae").eq("id", 1).maybeSingle(),
  ]);
  lanzarSiError(resPrimero, resUltimo, resPendientes, resEmpresa);
  const actividadConfigurada = !!(resEmpresa.data?.actividad_codigo && resEmpresa.data?.epigrafe_iae);
  const anioActual = new Date().getFullYear();
  const desde = Number(resPrimero.data?.[0]?.fecha.slice(0, 4) ?? anioActual);
  const hasta = Math.max(Number(resUltimo.data?.[0]?.fecha.slice(0, 4) ?? anioActual), anioActual);
  const ejercicios = Array.from({ length: hasta - desde + 1 }, (_, i) => hasta - i);
  const pedido = Number(filtros.ejercicio);
  const ejercicio = ejercicios.includes(pedido)
    ? pedido
    : resUltimo.data?.[0]
      ? Number(resUltimo.data[0].fecha.slice(0, 4))
      : anioActual;

  const SELECCION = "*, categorias_gasto(nombre), usuarios!gastos_usuario_id_fkey(nombre, apellidos)";
  const res = await supabase
    .from("gastos")
    .select(SELECCION)
    .gte("fecha", `${ejercicio}-01-01`)
    .lte("fecha", `${ejercicio}-12-31`)
    .order("fecha", { ascending: false })
    .order("id", { ascending: false })
    .limit(5000);
  lanzarSiError(res);
  const todos = res.data ?? [];
  const pendientes = resPendientes.data ?? [];
  const trimestre = TRIMESTRES.includes(Number(filtros.trimestre)) ? Number(filtros.trimestre) : 0;
  const tipo = filtros.tipo === "deducible" || filtros.tipo === "menor" ? filtros.tipo : "todos";
  const estado = (ESTADOS_GASTO as readonly string[]).includes(filtros.estado ?? "") ? filtros.estado : "";
  const q = (filtros.q ?? "").trim().toLowerCase();
  const pagina = Math.max(1, Number(filtros.pagina) || 1);

  const aviso = filtros.revision && filtros.revision in REVISIONES ? (filtros.revision as Revision) : null;

  const delAnio = todos.filter((g) => g.fecha.startsWith(String(ejercicio)));
  const filtrados = delAnio.filter(
    (g) =>
      (tipo === "todos" || g.tipo === tipo) &&
      (!estado || g.estado === estado) &&
      (!trimestre || trimestreDe(g.fecha) === trimestre) &&
      (!aviso || cumpleRevision(g, aviso)) &&
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
  // IVA soportado deducible: solo la parte deducible (pct_deducible_iva) y sin nóminas,
  // igual que el resumen fiscal del trimestre (casillas 29 + 31 del 303).
  const ivaSoportado = deduciblesAnio
    .filter((g) => (g.estado === "aprobado" || g.estado === "reembolsado") && !esSinFactura(g))
    .reduce((s, g) => s + cuotaDeducible(g.cuota_iva, g.pct_deducible_iva), 0);

  const actual: Filtros = {
    tipo: tipo === "todos" ? "" : tipo,
    estado: estado ?? "",
    ejercicio: String(ejercicio),
    trimestre: trimestre ? String(trimestre) : "",
    q: filtros.q ?? "",
    revision: aviso ?? "",
  };
  const hoy = hoyEnEspana();
  // Panel de revisión (se abre desde el aviso de la campana o con "Revisar"): ?revisar=ID
  // El gasto a revisar puede ser de otro ejercicio: si no está en la lista, se pide aparte.
  const idRevisar = Number(filtros.revisar);
  const aRevisar =
    todos.find((g) => g.id === idRevisar) ??
    (Number.isInteger(idRevisar) && idRevisar > 0
      ? (await supabase.from("gastos").select(SELECCION).eq("id", idRevisar).maybeSingle()).data
      : null);
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
      datosTicket: aRevisar.datos_ticket,
    };
  }
  const primeraPendiente = pendientes.at(-1);

  const chip = (activo: boolean) =>
    activo
      ? "inline-flex min-h-10 items-center rounded-md bg-fondo-marca px-esp3 text-xs font-medium text-texto-sobre-marca transition-colors duration-rapida ease-suave active:scale-press md:min-h-8"
      : "inline-flex min-h-10 items-center rounded-md border border-borde-default bg-fondo-superficie px-esp3 text-xs text-texto-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press md:min-h-8";

  return (
    <div className="flex flex-col gap-esp6">
      {revision && <ModalRevisarGasto gasto={revision} cerrarHref={enlace(actual, {})} />}
      <CabeceraPagina
        titulo="Gastos"
        subtitulo="Gastos deducibles (con IVA soportado) y gastos menores de caja, con aprobación y reembolso."
        acciones={
          <>
            <form action="/admin/gastos" className="flex items-center gap-esp2">
              <label className="text-etiqueta text-texto-secundario" htmlFor="ejercicio">
                Ejercicio
              </label>
              <select
                id="ejercicio"
                name="ejercicio"
                defaultValue={ejercicio}
                className="h-11 rounded-lg border border-borde-campo bg-fondo-superficie px-esp2 text-sm text-texto-primario md:h-[42px]"
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
            <Link href="/admin/gastos/nuevo" className={clasesBoton("primario")}>
              <Icono nombre="mas" size={16} />
              Nuevo gasto
            </Link>
          </>
        }
      />

      {primeraPendiente && (
        <div className="flex flex-wrap items-center gap-esp3 rounded-md border border-borde-aviso bg-fondo-aviso-sutil px-esp4 py-esp3">
          <Icono nombre="alerta" size={18} className="text-texto-aviso" />
          <p className="flex-1 text-sm text-texto-primario">
            {pendientes.length} gasto(s) esperan tu revisión.
          </p>
          <Link href={enlace(actual, { revisar: String(primeraPendiente.id) })}>
            <Boton tamano="s">Revisar el más antiguo</Boton>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-esp3 md:gap-esp4 xl:grid-cols-4">
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

      {trimestre ? (
        <ResumenFiscalTrimestre
          gastos={delAnio}
          ejercicio={ejercicio}
          trimestre={trimestre}
          hoy={hoy}
          actividadConfigurada={actividadConfigurada}
          enlaceRevision={(clave) => enlace(actual, { revision: clave, estado: "", tipo: "", pagina: "" })}
        />
      ) : (
        <ResumenFiscalAnual
          gastos={delAnio}
          ejercicio={ejercicio}
          hoy={hoy}
          enlaceTrimestre={(t) => enlace(actual, { trimestre: String(t), pagina: "" })}
        />
      )}

      {aviso && (
        <div className="flex flex-wrap items-center gap-esp3 rounded-md border border-borde-aviso bg-fondo-aviso-sutil px-esp4 py-esp2 text-sm">
          <Icono nombre="filtro" size={16} className="text-texto-aviso" />
          <span className="flex-1 text-texto-primario">Mostrando: {REVISIONES[aviso]}</span>
          <Link href={enlace(actual, { revision: "", pagina: "" })} className="font-medium text-texto-marca">
            Quitar filtro
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie p-esp3 md:p-esp4">
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
          <BuscadorAdmin
            key={filtros.q ?? ""}
            fuente="gastos"
            ejercicio={ejercicio}
            defaultValue={filtros.q ?? ""}
            placeholder="Concepto, proveedor, código…"
            ariaLabel="Buscar gastos"
            classNameContenedor="w-[260px]"
            className="h-9 w-full rounded-lg border border-borde-campo bg-fondo-superficie pr-esp3 text-sm text-texto-primario outline-none focus:border-borde-foco"
          />
          <Boton type="submit" variante="secundario">
            Buscar
          </Boton>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-borde-default bg-fondo-superficie">
        <div className="hidden items-center gap-esp4 border-b border-borde-default bg-fondo-sutil/70 px-esp6 py-esp2 text-etiqueta uppercase text-texto-secundario lg:flex">
          <span className="flex-1">Concepto y responsable</span>
          <span className="w-[100px]">Fecha</span>
          <span className="w-[110px]">Pago</span>
          <span className="w-[90px]">Ticket</span>
          <span className="w-[110px] text-right">Importe</span>
          <span className="w-[110px] text-right">Estado</span>
        </div>
        <div className="flex flex-col divide-y divide-borde-default">
          {visibles.map((g) => (
            <Link
              key={g.id}
              // Pendiente → panel de revisión (con enlace a la ficha); el resto → ficha del gasto.
              href={g.estado === "pendiente" ? enlace(actual, { revisar: String(g.id) }) : `/admin/gastos/${g.id}`}
              className="grid grid-cols-[1fr_auto] items-center gap-x-esp3 gap-y-1 px-esp4 py-esp3 transition-colors duration-rapida ease-suave hover:bg-fondo-sutil/60 md:px-esp6 lg:flex lg:gap-esp4"
            >
              <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fondo-sutil lg:flex">
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
              <span className="tabular-nums hidden w-[100px] text-xs text-texto-terciario lg:block">{fechaMedia(g.fecha)}</span>
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
              <span className="tabular-nums whitespace-nowrap text-right lg:w-[110px]">
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
            <p className="px-esp4 py-esp5 text-sm text-texto-terciario md:px-esp6">No hay gastos con estos filtros.</p>
          )}
          {filtrados.length > 0 && (
            <div className="tabular-nums flex flex-wrap items-center gap-x-esp5 gap-y-1 bg-fondo-sutil px-esp4 py-esp3 text-sm font-semibold text-texto-primario md:px-esp6">
              <span className="flex-1">
                Total ({filtrados.length} gasto{filtrados.length === 1 ? "" : "s"})
              </span>
              <span className="font-normal text-texto-secundario">Base {euros(suma(filtrados, "base_imponible"))}</span>
              <span className="font-normal text-texto-secundario">IVA {euros(suma(filtrados, "cuota_iva"))}</span>
              <span>{euros(suma(filtrados, "total"))}</span>
            </div>
          )}
        </div>
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
