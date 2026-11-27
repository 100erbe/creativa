import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { SubtituloHoy } from "@/components/ui/subtitulo-hoy";
import { AlertaDescartable } from "@/components/ui/alerta-descartable";
import { TarjetaKpiDinamica, type SerieKpi } from "@/components/ui/tarjeta-kpi-dinamica";
import { Tarjeta, CabeceraTarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { FilaTarea } from "@/components/ui/fila-tarea";
import { FilaDocumento } from "@/components/ui/fila-documento";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { clasesBoton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { euros } from "@/lib/formato";
import { saludo } from "@/lib/saludo";
import { ETIQUETA_TIPO } from "@/lib/documentos";
import { resumirCobrosPendientes } from "@/lib/cobros-pendientes";
import { cargarMetaDocumentosCobro } from "@/lib/cobros-abiertos";
import { hoyEnEspana } from "@/lib/estado-cuenta";
import {
  campanasActivas,
  crearCalculadora,
  facturado,
  intervalos,
  PERIODOS,
  sumarDiasIso,
  type Periodo,
} from "@/lib/series-panel";
import { cn } from "@/lib/cn";
import { PanelCampanas, PanelDocumentosRecientes, type CampanaResumen, type DocumentoReciente } from "./paneles";
import { TarjetaMargenMes } from "./tarjeta-margen-mes";
import { agregarMargen } from "@/lib/margen";
import { esMargenPrevisto, esMargenReal } from "@/lib/margen-cliente";
import { MESES } from "@/lib/margen-global";

export const dynamic = "force-dynamic";

// Resumen (diseño Figma "01 · Dashboard — vista completa"): cabecera, alerta de datos pendientes,
// 4 tarjetas KPI dinámicas (Semana / Mes / Año, tooltip al pasar el ratón), Cobros y vencimientos +
// Tareas pendientes, Documentos recientes + Campañas. La antigüedad completa del saldo está en /admin/cobros.

const DIAS_BORRADOR_ANTIGUO = 14;

export default async function PaginaPanel() {
  const supabase = await createClient();
  const usuario = await obtenerUsuarioActual();
  const ahora = new Date();
  const hoy = hoyEnEspana(ahora);

  const resultados = await Promise.all([
    supabase
      .from("v_estado_cobro")
      .select("id, tipo, numero_completo, cliente_razon_social, fecha, fecha_vencimiento, total, pendiente, estado_cobro")
      .limit(5000),
    cargarMetaDocumentosCobro(),
    supabase.from("cobros").select("documento_id, fecha, importe").limit(5000),
    supabase.from("campanas").select("id, estado, fecha_inicio, fecha_fin"),
    supabase.from("v_progreso_campana").select("*"),
    supabase
      .from("documentos")
      .select("id, numero_completo, tipo, estado, total, cliente_razon_social, fecha, clientes(razon_social)")
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })
      .limit(30),
    supabase.from("documentos").select("id", { count: "exact", head: true }).eq("revisar", true),
    supabase
      .from("documentos")
      .select("id", { count: "exact", head: true })
      .eq("estado", "borrador")
      .lt("fecha", sumarDiasIso(hoy, -DIAS_BORRADOR_ANTIGUO)),
    // Margen bruto del mes en curso (solo admin por RLS).
    supabase
      .from("v_margen_lineas")
      .select("tipo, estado, base_neta, coste_total")
      .in("tipo", ["factura", "rectificativa", "presupuesto"])
      .gte("fecha", `${hoy.slice(0, 7)}-01`)
      .lte("fecha", hoy)
      .limit(5000),
  ]);
  lanzarSiError(...resultados);
  const [
    { data: estadoCobro },
    { data: metaDocs },
    { data: cobros },
    { data: campanas },
    { data: progreso },
    { data: recientes },
    { count: porRevisar },
    { count: borradoresAntiguos },
    { data: lineasMargenMes },
  ] = resultados;
  const margenMes = lineasMargenMes ?? [];

  // ── Cobros (mismo criterio que /admin/cobros y que el estado de cuenta) ───────────────
  const metaPorId = new Map((metaDocs ?? []).map((d) => [d.id, d]));
  const {
    vigentes: filasCobro,
    totalPendiente,
    conSaldo,
    criticas90,
    vencidas,
    sinVencimiento,
    sumaSaldo,
    sumaCriticas90,
  } = resumirCobrosPendientes(estadoCobro ?? [], metaDocs ?? [], ahora);
  const nSinVenc = sinVencimiento.length;
  const nPorRevisar = porRevisar ?? 0;
  const nBorradores = borradoresAntiguos ?? 0;

  // ── Series de las tarjetas KPI ─────────────────────────────────────────────────────────
  const docs = filasCobro.map((d) => ({
    id: d.id as number,
    tipo: d.tipo ?? undefined,
    fecha: d.fecha as string,
    fechaVencimiento: d.fecha_vencimiento,
    documentoOrigenId: metaPorId.get(d.id as number)?.documento_origen_id ?? null,
    total: Number(d.total ?? 0),
  }));
  const calc = crearCalculadora(
    docs,
    (cobros ?? []).map((c) => ({ documentoId: c.documento_id, fecha: c.fecha, importe: Number(c.importe) })),
  );
  const fechasCampanas = (campanas ?? []).map((c) => ({ estado: c.estado, inicio: c.fecha_inicio, fin: c.fecha_fin }));
  const progresoCampanas = progreso ?? [];
  const enCurso = progresoCampanas.filter((c) => c.estado_campana === "en_curso");
  const nEnCurso = enCurso.length;
  const totalPuntos = enCurso.reduce((s, c) => s + Number(c.puntos_totales ?? 0), 0);
  const totalIncidencias = enCurso.reduce((s, c) => s + Number(c.puntos_con_incidencia ?? 0), 0);

  // Control: las series históricas se reconstruyen con documentos + cobros; hoy debe dar lo mismo que el resumen.
  const reconstruidoHoy = calc.pendiente(hoy);
  if (Math.abs(reconstruidoHoy - totalPendiente) > 0.01) {
    console.warn(
      `[panel] El saldo reconstruido (${reconstruidoHoy.toFixed(2)}) no coincide con v_estado_cobro (${totalPendiente.toFixed(2)}).`,
    );
  }
  const vencido90Hoy = calc.vencido90(hoy);
  if (Math.abs(vencido90Hoy - sumaCriticas90) > 0.01) {
    console.warn(
      `[panel] El vencido 90+ reconstruido (${vencido90Hoy.toFixed(2)}) no coincide con sumaCriticas90 (${sumaCriticas90.toFixed(2)}).`,
    );
  }

  const ints = Object.fromEntries(PERIODOS.map((p) => [p, intervalos(p, hoy)])) as Record<Periodo, ReturnType<typeof intervalos>>;
  const serie = (fn: (p: Periodo) => SerieKpi) => Object.fromEntries(PERIODOS.map((p) => [p, fn(p)])) as Record<Periodo, SerieKpi>;
  const ultimo = (p: Periodo) => ints[p].length - 1;

  const serieFacturacion = serie((p) => {
    const puntos = ints[p].map((i) => {
      const v = facturado(docs, i.inicio, i.fin);
      return { etiqueta: i.etiqueta, valor: v, texto: euros(v) };
    });
    return { valor: euros(puntos.reduce((s, x) => s + x.valor, 0)), puntos };
  });
  // Saldos: el último punto es exactamente la cifra de hoy (la misma de /admin/cobros).
  const seriePendiente = serie((p) => ({
    valor: euros(totalPendiente),
    puntos: ints[p].map((i, k) => {
      const v = k === ultimo(p) ? totalPendiente : calc.pendiente(i.fin);
      return { etiqueta: i.etiqueta, valor: Math.max(0, v), texto: euros(v) };
    }),
  }));
  const serieRiesgo = serie((p) => ({
    valor: euros(sumaCriticas90),
    puntos: ints[p].map((i, k) => {
      const v = k === ultimo(p) ? sumaCriticas90 : calc.vencido90(i.fin);
      return { etiqueta: i.etiqueta, valor: v, texto: euros(v) };
    }),
  }));
  const activas = (n: number) => `${n} activa${n === 1 ? "" : "s"}`;
  const serieCampanas = serie((p) => ({
    valor: String(nEnCurso),
    puntos: ints[p].map((i, k) => {
      const v = k === ultimo(p) ? nEnCurso : campanasActivas(fechasCampanas, i.fin);
      return { etiqueta: i.etiqueta, valor: v, texto: activas(v) };
    }),
  }));

  // ── Tareas pendientes (generadas a partir de los datos) ───────────────────────────────
  const tareas: { titulo: string; detalle: string; href: string }[] = [];
  if (nSinVenc > 0)
    tareas.push({
      titulo: "Añadir vencimientos",
      detalle: `${nSinVenc} factura${nSinVenc === 1 ? "" : "s"} · ${euros(sumaSaldo(sinVencimiento))}`,
      href: "/admin/documentos?revision=sin_vencimiento&cobro=pendiente&tipo=factura",
    });
  if (nPorRevisar > 0)
    tareas.push({
      titulo: "Validar importación",
      detalle: `${nPorRevisar} documento${nPorRevisar === 1 ? "" : "s"} pendiente${nPorRevisar === 1 ? "" : "s"}`,
      href: "/admin/documentos?revision=revisar",
    });
  if (criticas90.length > 0)
    tareas.push({
      titulo: "Reclamar las vencidas 90+ días",
      detalle: `${criticas90.length} factura${criticas90.length === 1 ? "" : "s"} · ${euros(sumaCriticas90)}`,
      href: "/admin/cobros?ver=90",
    });
  if (nBorradores > 0)
    tareas.push({
      titulo: "Revisar borradores antiguos",
      detalle: `${nBorradores} con más de ${DIAS_BORRADOR_ANTIGUO} días sin emitir`,
      href: "/admin/documentos?estado=borrador",
    });

  // ── Documentos recientes y campañas (para los paneles con pestañas) ───────────────────
  const cobroPorId = new Map(filasCobro.map((d) => [d.id as number, d.estado_cobro]));
  const documentosRecientes: DocumentoReciente[] = (recientes ?? []).map((d) => {
    const cobro = cobroPorId.get(d.id);
    const pago: DocumentoReciente["pago"] =
      d.tipo === "factura" && d.estado !== "anulado"
        ? cobro === "cobrada"
          ? { texto: "Cobrada", tono: "exito" }
          : cobro === "vencida"
            ? { texto: "Vencida", tono: "peligro" }
            : cobro === "parcial"
              ? { texto: "Cobro parcial", tono: "aviso" }
              : undefined
        : undefined;
    const cliente = Array.isArray(d.clientes) ? d.clientes[0] : d.clientes;
    return {
      id: d.id,
      tipo: d.tipo,
      tipoEtiqueta: ETIQUETA_TIPO[d.tipo] ?? d.tipo,
      numero: d.numero_completo ?? "Borrador",
      cliente: d.cliente_razon_social ?? cliente?.razon_social ?? null,
      importe: euros(Number(d.total)),
      estado: d.estado,
      pago,
    };
  });
  const campanasResumen: CampanaResumen[] = progresoCampanas
    .filter((c) => c.campana_id != null && c.estado_campana != null)
    .map((c) => ({
      id: c.campana_id as number,
      nombre: c.campana ?? "Campaña",
      cliente: c.cliente,
      estado: c.estado_campana as CampanaResumen["estado"],
      hechos: Number(c.puntos_instalados ?? 0) + Number(c.puntos_verificados ?? 0) + Number(c.puntos_retirados ?? 0),
      total: Number(c.puntos_totales ?? 0),
      incidencias: Number(c.puntos_con_incidencia ?? 0),
    }));

  // Saludo con el nombre de pila de quien ha entrado (se edita en Mi cuenta).
  const nombrePila = usuario?.nombre.trim().split(/\s+/)[0];

  return (
    <div className="flex flex-col gap-esp5">
      <CabeceraPagina
        titulo={nombrePila ? `${saludo(ahora)}, ${nombrePila}` : "Resumen"}
        subtitulo={<SubtituloHoy prefijo="Resumen de hoy" fecha={hoy} />}
        acciones={
          <Link href="/admin/documentos/nuevo" className={clasesBoton("primario", "m", "shrink-0")} aria-label="Nuevo documento">
            <Icono nombre="mas" size={16} />
            <span className="hidden sm:inline">Nuevo documento</span>
          </Link>
        }
      />

      {(nSinVenc > 0 || nPorRevisar > 0) && (
        <AlertaDescartable
          claveSesion="panel-datos-pendientes"
          titulo="Hay datos pendientes de revisar"
          descripcion={[
            nSinVenc > 0 ? `${nSinVenc} factura${nSinVenc === 1 ? "" : "s"} sin vencimiento` : null,
            nPorRevisar > 0
              ? `${nPorRevisar} documento${nPorRevisar === 1 ? "" : "s"} importado${nPorRevisar === 1 ? "" : "s"} por validar`
              : null,
          ]
            .filter(Boolean)
            .join(" y ")
            .concat(".")}
          accion={
            <a href="#tareas-pendientes" className={clasesBoton("primario")}>
              Ir a tareas
            </a>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-esp4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaKpiDinamica
          etiqueta="Facturación"
          significado="Documentos emitidos en el período"
          tipo="barras"
          color="facturacion"
          series={serieFacturacion}
          nota={{ texto: "Ver documentos", href: "/admin/documentos?tipo=factura", tono: "marca" }}
        />
        <TarjetaKpiDinamica
          etiqueta="Pendiente de cobro"
          significado="Saldo al cierre · no es facturación"
          tipo="linea"
          color="cobro"
          series={seriePendiente}
          nota={
            vencidas.length > 0
              ? { texto: `${vencidas.length} vencida${vencidas.length === 1 ? "" : "s"}`, href: "/admin/cobros?ver=vencidas", tono: "peligro" }
              : nSinVenc > 0
                ? { texto: `${nSinVenc} factura${nSinVenc === 1 ? "" : "s"} sin vencimiento`, href: "/admin/cobros?ver=sin_vencimiento" }
                : { texto: "Ver cobros", href: "/admin/cobros", tono: "marca" }
          }
        />
        <TarjetaKpiDinamica
          etiqueta="Vencido · más de 90 días"
          significado={nSinVenc > 0 ? "Más de 90 días desde vencimiento o emisión" : "Saldo vencido hace más de 90 días"}
          tipo="linea"
          color="riesgo"
          series={serieRiesgo}
          nota={
            criticas90.length > 0
              ? { texto: `${criticas90.length} factura${criticas90.length === 1 ? "" : "s"} por reclamar`, href: "/admin/cobros?ver=90", tono: "peligro" }
              : nSinVenc > 0
                ? { texto: "Sin fecha: evaluación por emisión", href: "/admin/cobros?ver=sin_vencimiento" }
                : { texto: "Sin riesgo conocido > 90 días" }
          }
        />
        <TarjetaKpiDinamica
          etiqueta="Campañas activas"
          significado="Activas al cierre del período"
          tipo="linea"
          color="campanas"
          series={serieCampanas}
          nota={{
            texto: `${totalPuntos} puntos · ${totalIncidencias} incidencia${totalIncidencias === 1 ? "" : "s"} actuales`,
            href: "/admin/campanas?estado=en_curso",
            tono: totalIncidencias > 0 ? "peligro" : "default",
          }}
        />
      </div>

      <TarjetaMargenMes
        mes={`${MESES[Number(hoy.slice(5, 7)) - 1]} ${hoy.slice(0, 4)}`}
        real={agregarMargen(
          margenMes
            .filter((l) => esMargenReal(l.tipo ?? "", l.estado ?? ""))
            .map((l) => ({ base: Number(l.base_neta ?? 0), coste: l.coste_total == null ? null : Number(l.coste_total) })),
        )}
        previsto={agregarMargen(
          margenMes
            .filter((l) => esMargenPrevisto(l.tipo ?? "", l.estado ?? ""))
            .map((l) => ({ base: Number(l.base_neta ?? 0), coste: l.coste_total == null ? null : Number(l.coste_total) })),
        )}
      />

      <div className="flex flex-col gap-esp5 xl:flex-row">
        {/* Cobros y vencimientos */}
        <Tarjeta como="section" aria-labelledby="titulo-cobros" className="min-w-0 flex-1">
          <CabeceraTarjeta
            id="titulo-cobros"
            titulo="Cobros y vencimientos"
            estado={nSinVenc > 0 ? <Insignia tono="aviso">Datos parciales</Insignia> : undefined}
          />
          <div className="grid grid-cols-1 gap-esp4 sm:grid-cols-3 sm:gap-x-0 sm:gap-y-esp2 sm:divide-x sm:divide-borde-default">
            <Hecho etiqueta="Saldo pendiente" valor={euros(totalPendiente)} alcance={`${conSaldo.length} documento${conSaldo.length === 1 ? "" : "s"} con saldo`} />
            <Hecho
              etiqueta="Sin fecha de vencimiento"
              valor={euros(sumaSaldo(sinVencimiento))}
              tono={nSinVenc > 0 ? "aviso" : undefined}
              alcance={nSinVenc > 0 ? `${nSinVenc} factura${nSinVenc === 1 ? "" : "s"} por completar` : "Todas tienen vencimiento"}
            />
            <Hecho
              etiqueta="Vencido 90+ días"
              valor={euros(sumaCriticas90)}
              tono={criticas90.length > 0 ? "critico" : undefined}
              alcance={criticas90.length > 0 ? `${criticas90.length} factura${criticas90.length === 1 ? "" : "s"} por reclamar` : "Sin riesgo > 90 días"}
            />
          </div>
          {nSinVenc > 0 && (
            <div className="flex gap-esp3 rounded-lg bg-fondo-sutil px-esp4 py-esp3">
              <Icono nombre="alerta" size={20} className="text-icono-default" />
              <p className="text-meta font-medium text-texto-primario">
                Hay facturas sin fecha de vencimiento: se les aplica un vencimiento de 30 días desde la emisión.
              </p>
            </div>
          )}
          {criticas90.length > 0 && (
            <div className="-mx-esp3 flex flex-col">
              {criticas90.slice(0, 3).map((d) => (
                <FilaDocumento
                  key={d.id}
                  href={`/admin/documentos/${d.id}`}
                  cliente={d.cliente_razon_social}
                  numero={d.numero_completo ?? `Doc #${d.id}`}
                  tipo={ETIQUETA_TIPO[d.tipo ?? ""] ?? ""}
                  importe={euros(d.saldoNeto)}
                  estado="vencida"
                  textoEstado={
                    d.fecha_vencimiento
                      ? `Vencida hace ${d.aging.diasVencido} días`
                      : `Emitida hace ${d.aging.diasVencido} días`
                  }
                />
              ))}
            </div>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-esp3">
            <p className="min-w-0 flex-1 text-etiqueta text-texto-secundario">
              Antigüedad, facturas y clientes con saldo en Cobros.
            </p>
            <Link href="/admin/cobros" className={clasesBoton("secundario")}>
              Ver cobros
            </Link>
          </div>
        </Tarjeta>

        {/* Tareas pendientes */}
        <Tarjeta
          como="section"
          id="tareas-pendientes"
          aria-labelledby="titulo-tareas"
          className="w-full scroll-mt-esp6 xl:w-[448px] xl:shrink-0"
        >
          <CabeceraTarjeta id="titulo-tareas" titulo="Tareas pendientes" />
          {tareas.length > 0 ? (
            <div className="flex flex-col divide-y divide-borde-default">
              {tareas.map((t) => (
                <FilaTarea key={t.titulo} titulo={t.titulo} detalle={t.detalle} href={t.href} />
              ))}
            </div>
          ) : (
            <EstadoVacio icono="check" titulo="Todo al día" descripcion="No hay datos por completar ni cobros en riesgo." />
          )}
        </Tarjeta>
      </div>

      <div className="flex flex-col gap-esp5 xl:flex-row">
        <PanelDocumentosRecientes documentos={documentosRecientes} />
        <PanelCampanas campanas={campanasResumen} />
      </div>
    </div>
  );
}

/** Un dato del panel «Cobros y vencimientos»: etiqueta 13/20, cifra 20/28, alcance 12/18. */
function Hecho({
  etiqueta,
  valor,
  alcance,
  tono,
}: {
  etiqueta: string;
  valor: string;
  alcance: string;
  tono?: "aviso" | "critico";
}) {
  return (
    <div className="grid grid-cols-1 gap-esp2 sm:row-span-3 sm:grid-rows-subgrid sm:gap-y-esp2 sm:px-esp6 sm:first:pl-0 sm:last:pr-0">
      <p className="self-start text-meta font-medium text-texto-secundario">{etiqueta}</p>
      <p
        className={cn(
          "tabular-nums self-baseline whitespace-nowrap text-importe",
          tono === "aviso" ? "text-texto-aviso" : tono === "critico" ? "text-texto-critico" : "text-texto-primario",
        )}
      >
        {valor}
      </p>
      <p className="self-start text-etiqueta text-texto-secundario">{alcance}</p>
    </div>
  );
}
