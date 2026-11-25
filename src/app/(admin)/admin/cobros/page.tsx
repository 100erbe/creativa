import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { Tarjeta, CabeceraTarjeta } from "@/components/ui/tarjeta";
import { TarjetaKpi } from "@/components/ui/tarjeta-kpi";
import { PestanasEnlace } from "@/components/ui/pestanas";
import { FilaDocumento } from "@/components/ui/fila-documento";
import { Monograma, inicialesDe } from "@/components/ui/monograma";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { clasesBoton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { euros, fechaMedia } from "@/lib/formato";
import { ETIQUETA_TIPO, METODOS_COBRO } from "@/lib/documentos";
import { resumirCobrosPendientes } from "@/lib/cobros-pendientes";
import { hoyEnEspana, SALDO_MINIMO } from "@/lib/estado-cuenta";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

// Cobros: reúne en una página lo que antes estaba repartido en los filtros «?cobro=» de Documentos.
// Saldo pendiente, antigüedad desde el vencimiento (mismo cálculo que el panel), facturas con saldo,
// clientes con más deuda (enlace a su estado de cuenta para reclamar) y últimos cobros registrados.

type Vista = "todas" | "vencidas" | "90" | "sin_vencimiento" | "en_plazo" | "1_30" | "31_89";

// Pestañas visibles sobre la lista
const VISTAS: { valor: Vista; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "vencidas", etiqueta: "Vencidas" },
  { valor: "90", etiqueta: "90+ días" },
  { valor: "sin_vencimiento", etiqueta: "Sin vencimiento" },
];

// Vistas que solo se abren desde los tramos de antigüedad (no tienen pestaña propia)
const VISTAS_TRAMO: { valor: Vista; etiqueta: string }[] = [
  { valor: "en_plazo", etiqueta: "En plazo" },
  { valor: "1_30", etiqueta: "Vencidas 1–30 días" },
  { valor: "31_89", etiqueta: "Vencidas 31–89 días" },
];

const ANCLA_LISTA = "facturas";
const hrefVista = (v: Vista) => (v === "todas" ? `/admin/cobros#${ANCLA_LISTA}` : `/admin/cobros?ver=${v}#${ANCLA_LISTA}`);

const MAX_FILAS = 40;
const ETIQUETA_METODO: Record<string, string> = Object.fromEntries(METODOS_COBRO.map((m) => [m.valor, m.etiqueta]));

export default async function PaginaCobros({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { ver } = await searchParams;
  const vista: Vista = [...VISTAS, ...VISTAS_TRAMO].some((v) => v.valor === ver) ? (ver as Vista) : "todas";
  const vistaTramo = VISTAS_TRAMO.find((v) => v.valor === vista);

  const supabase = await createClient();
  const hoy = new Date();
  const inicioMes = `${hoyEnEspana(hoy).slice(0, 7)}-01`;

  const resultados = await Promise.all([
    supabase
      .from("v_estado_cobro")
      .select("id, tipo, numero_completo, cliente_id, cliente_razon_social, fecha, fecha_vencimiento, total, pendiente, estado_cobro")
      .in("estado_cobro", ["pendiente", "parcial", "vencida"])
      .limit(5000),
    supabase
      .from("documentos")
      .select("id, estado, documento_origen_id")
      .in("tipo", ["factura", "rectificativa"])
      .neq("estado", "borrador")
      .limit(5000),
    supabase
      .from("cobros")
      .select("id, fecha, importe, metodo, documento_id, documento:documentos!documento_id(numero_completo, tipo, cliente_razon_social, clientes(razon_social))")
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })
      .limit(10),
    supabase.from("cobros").select("importe").gte("fecha", inicioMes),
  ]);
  lanzarSiError(...resultados);
  const [{ data: pendientes }, { data: metaDocs }, { data: ultimosCobros }, { data: cobrosMes }] = resultados;

  // Mismo criterio que el panel y el estado de cuenta: saldo neto de abonos ligados y 90+ días desde vencimiento o emisión.
  const {
    totalPendiente,
    conSaldo,
    criticas90: v90,
    vencidas,
    sinVencimiento: sinVenc,
    sumaSaldo: suma,
    abonosSinAplicar,
  } = resumirCobrosPendientes(pendientes ?? [], metaDocs ?? [], hoy);
  const v30 = conSaldo.filter((d) => d.saldoNeto >= SALDO_MINIMO && d.aging.tramo === "vencida_30");
  const v60 = conSaldo.filter((d) => d.saldoNeto >= SALDO_MINIMO && d.aging.tramo === "vencida_60");
  const idsVencidas = new Set(vencidas.map((d) => d.id));
  const alDia = conSaldo.filter((d) => !idsVencidas.has(d.id));
  const totalAging = Math.max(0.01, suma(conSaldo));
  const cobradoMes = (cobrosMes ?? []).reduce((s, c) => s + Number(c.importe), 0);

  const tramos = [
    { clave: "al_dia", etiqueta: "En plazo", lista: alDia, color: "bg-texto-info", vista: "en_plazo" as Vista },
    { clave: "1_30", etiqueta: "1–30 días", lista: v30, color: "bg-texto-aviso", vista: "1_30" as Vista },
    { clave: "31_89", etiqueta: "31–89 días", lista: v60, color: "bg-fondo-peligro", vista: "31_89" as Vista },
    { clave: "90", etiqueta: "90+ días", lista: v90, color: "bg-fondo-critico", vista: "90" as Vista },
  ].map((t) => ({ ...t, importe: suma(t.lista), cantidad: t.lista.length }));

  const LISTAS: Record<Vista, typeof conSaldo> = {
    todas: conSaldo,
    vencidas,
    "90": v90,
    sin_vencimiento: sinVenc,
    en_plazo: alDia,
    "1_30": v30,
    "31_89": v60,
  };
  const listaVista = LISTAS[vista];
  const filas = [...listaVista].sort(
    (a, b) => b.aging.diasVencido - a.aging.diasVencido || b.saldoNeto - a.saldoNeto,
  );

  // Clientes con más saldo pendiente
  const porCliente = new Map<number, { id: number; nombre: string; importe: number; facturas: number; maxDias: number; esCritico90: boolean }>();
  for (const d of conSaldo) {
    if (d.cliente_id == null) continue;
    const c = porCliente.get(d.cliente_id) ?? {
      id: d.cliente_id,
      nombre: d.cliente_razon_social ?? "Sin nombre",
      importe: 0,
      facturas: 0,
      maxDias: 0,
      esCritico90: false,
    };
    c.importe += d.saldoNeto;
    c.facturas += 1;
    c.maxDias = Math.max(c.maxDias, d.aging.diasVencido);
    if (d.saldoNeto >= SALDO_MINIMO && d.aging.esCritica90) c.esCritico90 = true;
    porCliente.set(d.cliente_id, c);
  }
  const clientes = [...porCliente.values()].sort((a, b) => b.importe - a.importe).slice(0, 8);

  const textoEstado = (d: (typeof conSaldo)[number]) =>
    d.aging.esCritica90 && !d.fecha_vencimiento
      ? `Emitida hace ${d.aging.diasVencido} días`
      : d.sinVencimiento
        ? "Sin fecha de vencimiento"
        : d.aging.diasVencido > 0
          ? `Vencida hace ${d.aging.diasVencido} día${d.aging.diasVencido === 1 ? "" : "s"}`
          : d.fecha_vencimiento
            ? `Vence el ${fechaMedia(d.fecha_vencimiento)}`
            : "Pendiente de cobro";

  return (
    <div className="flex flex-col gap-esp5">
      <CabeceraPagina
        titulo="Cobros"
        subtitulo="Saldo pendiente de las facturas emitidas, antigüedad desde el vencimiento y cobros registrados."
        acciones={
          <Link href="/admin/clientes?con_deuda=1" className={clasesBoton("secundario")}>
            Clientes con deuda
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-esp4 xl:grid-cols-4">
        <TarjetaKpi
          etiqueta="Pendiente de cobro"
          valor={euros(totalPendiente)}
          significado={abonosSinAplicar < -0.01 ? "Neto de abonos sin aplicar" : "Saldo de las facturas emitidas"}
          detalle={`${conSaldo.length} factura${conSaldo.length === 1 ? "" : "s"}${abonosSinAplicar < -0.01 ? ` · abonos ${euros(abonosSinAplicar)}` : ""}`}
          href={hrefVista("todas")}
        />
        <TarjetaKpi
          etiqueta="Vencido"
          valor={euros(suma(vencidas))}
          significado="Con fecha de vencimiento pasada"
          detalle={`${vencidas.length} vencida${vencidas.length === 1 ? "" : "s"}`}
          tono={vencidas.length > 0 ? "peligro" : "default"}
          href={hrefVista("vencidas")}
        />
        <TarjetaKpi
          etiqueta="Vencido · más de 90 días"
          valor={euros(suma(v90))}
          significado="Riesgo crítico conocido"
          detalle={v90.length > 0 ? `${v90.length} factura${v90.length === 1 ? "" : "s"}` : "Sin riesgo conocido > 90 días"}
          tono={v90.length > 0 ? "critico" : "default"}
          href={hrefVista("90")}
        />
        <TarjetaKpi
          etiqueta="Cobrado este mes"
          valor={euros(cobradoMes)}
          significado="Cobros registrados desde el día 1"
          detalle={`${(cobrosMes ?? []).length} cobro${(cobrosMes ?? []).length === 1 ? "" : "s"}`}
          tono="exito"
        />
      </div>

      {sinVenc.length > 0 && (
        <div className="flex flex-col gap-esp3 rounded-lg bg-fondo-aviso-sutil p-esp4 sm:flex-row sm:items-center sm:gap-esp4">
          <Icono nombre="alerta" size={20} className="text-icono-default" />
          <div className="min-w-0 flex-1">
            <p className="text-destacado text-texto-primario">
              {sinVenc.length} factura{sinVenc.length === 1 ? "" : "s"} sin fecha de vencimiento
            </p>
            <p className="text-meta font-medium text-texto-secundario">
              <span className="tabular-nums">{euros(suma(sinVenc))}</span> : se les aplica un
              vencimiento de 30 días desde la emisión hasta que se complete.
            </p>
          </div>
          <Link
            href="/admin/documentos?revision=sin_vencimiento&cobro=pendiente&tipo=factura"
            className={clasesBoton("primario", "m", "self-end sm:self-auto")}
          >
            Añadir vencimientos
          </Link>
        </div>
      )}

      {/* Antigüedad del saldo */}
      <Tarjeta como="section" aria-labelledby="titulo-antiguedad">
        <CabeceraTarjeta
          id="titulo-antiguedad"
          titulo="Antigüedad del saldo"
          descripcion="Saldo pendiente según los días transcurridos desde el vencimiento."
          estado={sinVenc.length > 0 ? <Insignia tono="aviso">Datos parciales</Insignia> : undefined}
        />
        {conSaldo.length > 0 && (
          <div
            className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-completo bg-fondo-sutil"
            role="img"
            aria-label={`Distribución del saldo: ${tramos.map((t) => `${t.etiqueta} ${euros(t.importe)}`).join(", ")}`}
          >
            {tramos.map((t) =>
              t.importe > 0 ? (
                <div key={t.clave} className={t.color} style={{ width: `${Math.max(2, (t.importe / totalAging) * 100)}%` }} />
              ) : null,
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-esp3 lg:grid-cols-4">
          {tramos.map((t) => (
            <Link
              key={t.clave}
              href={hrefVista(t.vista)}
              aria-current={vista === t.vista ? "true" : undefined}
              className={cn(
                "flex flex-col gap-esp1 rounded-lg bg-fondo-sutil p-esp4 transition-colors duration-rapida ease-suave hover:bg-fondo-hover",
                vista === t.vista && "ring-2 ring-inset ring-borde-foco",
              )}
            >
              <span className="flex items-center gap-esp2 text-meta font-medium text-texto-secundario">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", t.color)} aria-hidden="true" />
                {t.etiqueta}
              </span>
              <span className={cn("tabular-nums text-importe", t.clave === "90" && t.importe > 0 ? "text-texto-critico" : "text-texto-primario")}>
                {euros(t.importe)}
              </span>
              <span className="tabular-nums text-etiqueta text-texto-secundario">
                {t.cantidad} factura{t.cantidad === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      </Tarjeta>

      <div className="flex flex-col gap-esp5 xl:flex-row xl:items-start">
        {/* Facturas con saldo */}
        <Tarjeta
          como="section"
          id={ANCLA_LISTA}
          relleno="lista"
          aria-labelledby="titulo-facturas"
          className="min-w-0 flex-1 scroll-mt-esp5"
        >
          <div className="px-esp2">
            <CabeceraTarjeta
              id="titulo-facturas"
              titulo="Facturas con saldo pendiente"
              accion={
                <Link href="/admin/documentos?cobro=pendiente" className={clasesBoton("secundario")}>
                  Ver en Documentos
                </Link>
              }
            />
          </div>
          <PestanasEnlace
            etiqueta="Filtrar facturas con saldo"
            className="max-w-[560px]"
            opciones={VISTAS.map((v) => ({
              href: hrefVista(v.valor),
              etiqueta: v.etiqueta,
              activa: vista === v.valor,
              contador: LISTAS[v.valor].length,
            }))}
          />
          {vistaTramo && (
            <div className="flex items-center gap-esp2 px-esp4 pt-esp2">
              <span className="text-meta font-medium text-texto-secundario">Filtro:</span>
              <Insignia tono="info">
                {vistaTramo.etiqueta} · {listaVista.length}
              </Insignia>
              <Link href={hrefVista("todas")} className="text-meta font-medium text-texto-marca hover:underline">
                Quitar filtro
              </Link>
            </div>
          )}
          {filas.length > 0 ? (
            <div className="flex flex-col">
              {filas.slice(0, MAX_FILAS).map((d) => (
                <FilaDocumento
                  key={d.id}
                  href={`/admin/documentos/${d.id}`}
                  cliente={d.cliente_razon_social}
                  numero={d.numero_completo ?? `Doc #${d.id}`}
                  tipo={ETIQUETA_TIPO[d.tipo ?? ""] ?? d.tipo ?? ""}
                  importe={euros(d.saldoNeto)}
                  pago={
                    Number(d.total ?? 0) - d.saldoNeto > 0.01
                      ? { texto: `de ${euros(Number(d.total ?? 0))}`, tono: "neutro" }
                      : undefined
                  }
                  estado={d.aging.diasVencido > 0 ? "vencida" : "pendiente"}
                  textoEstado={textoEstado(d)}
                />
              ))}
              {filas.length > MAX_FILAS && (
                <p className="px-esp4 pt-esp2 text-meta font-medium text-texto-secundario">
                  Se muestran las {MAX_FILAS} más antiguas de {filas.length}.{" "}
                  <Link href="/admin/documentos?cobro=pendiente" className="text-texto-marca hover:underline">
                    Ver todas en Documentos
                  </Link>
                </p>
              )}
            </div>
          ) : (
            <EstadoVacio
              icono="cobros"
              titulo={vista === "todas" ? "No hay saldo pendiente" : "Nada en este filtro"}
              descripcion={
                vista === "todas"
                  ? "Todas las facturas emitidas están cobradas."
                  : "No hay facturas con saldo que cumplan este criterio."
              }
            />
          )}
        </Tarjeta>

        <div className="flex w-full flex-col gap-esp5 xl:w-[448px]">
          {/* Clientes con más saldo */}
          <Tarjeta como="section" aria-labelledby="titulo-clientes">
            <CabeceraTarjeta
              id="titulo-clientes"
              titulo="Clientes con más saldo"
              descripcion="Abre su estado de cuenta para reclamar las impagadas."
            />
            {clientes.length > 0 ? (
              <div className="flex flex-col divide-y divide-borde-default">
                {clientes.map((c) => (
                  <Link
                    key={c.id}
                    href={`/admin/clientes/${c.id}/estado-cuenta`}
                    className="-mx-esp2 flex items-center gap-esp3 rounded-lg px-esp2 py-esp3 transition-colors duration-rapida ease-suave hover:bg-fondo-sutil"
                  >
                    <Monograma texto={inicialesDe(c.nombre)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-etiqueta text-texto-primario">{c.nombre}</span>
                      <span className="block text-meta font-medium text-texto-secundario">
                        {c.facturas} factura{c.facturas === 1 ? "" : "s"}
                        {c.maxDias > 0 ? ` · hasta ${c.maxDias} días` : ""}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "tabular-nums whitespace-nowrap text-sm font-semibold",
                        c.esCritico90 ? "text-texto-critico" : "text-texto-primario",
                      )}
                    >
                      {euros(c.importe)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-cuerpo text-texto-secundario">Ningún cliente tiene saldo pendiente.</p>
            )}
          </Tarjeta>

          {/* Últimos cobros */}
          <Tarjeta como="section" aria-labelledby="titulo-ultimos">
            <CabeceraTarjeta id="titulo-ultimos" titulo="Últimos cobros registrados" />
            {(ultimosCobros ?? []).length > 0 ? (
              <div className="flex flex-col divide-y divide-borde-default">
                {(ultimosCobros ?? []).map((c) => {
                  const doc = Array.isArray(c.documento) ? c.documento[0] : c.documento;
                  const cli = doc ? (Array.isArray(doc.clientes) ? doc.clientes[0] : doc.clientes) : null;
                  const importe = Number(c.importe);
                  return (
                    <Link
                      key={c.id}
                      href={`/admin/documentos/${c.documento_id}`}
                      className="-mx-esp2 flex items-center gap-esp3 rounded-lg px-esp2 py-esp3 transition-colors duration-rapida ease-suave hover:bg-fondo-sutil"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-etiqueta text-texto-primario">
                          {doc?.cliente_razon_social ?? cli?.razon_social ?? "Sin cliente"}
                        </span>
                        <span className="block truncate text-meta font-medium text-texto-secundario">
                          {doc?.numero_completo ?? `Doc #${c.documento_id}`} · {fechaMedia(c.fecha)} ·{" "}
                          {ETIQUETA_METODO[c.metodo] ?? c.metodo}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "tabular-nums whitespace-nowrap text-sm font-semibold",
                          importe < 0 ? "text-texto-peligro" : "text-texto-exito",
                        )}
                      >
                        {euros(importe)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-cuerpo text-texto-secundario">Todavía no hay cobros registrados.</p>
            )}
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}
