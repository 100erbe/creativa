import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { AlertaDescartable } from "@/components/ui/alerta-descartable";
import { TarjetaKpiDinamica, type SerieKpi } from "@/components/ui/tarjeta-kpi-dinamica";
import { Tarjeta, CabeceraTarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { FilaTarea } from "@/components/ui/fila-tarea";
import { FilaDocumento } from "@/components/ui/fila-documento";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { clasesBoton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { euros, fechaLarga } from "@/lib/formato";
import { saludo } from "@/lib/saludo";
import { clasificarAgingCobro, ETIQUETA_TIPO } from "@/lib/documentos";
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
      .select("id, tipo, numero_completo, cliente_razon_social, fecha, fecha_vencimiento, total, pendiente, estado_cobro"),
    supabase.from("cobros").select("documento_id, fecha, importe"),
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
  ]);
  lanzarSiError(...resultados);
  const [
    { data: estadoCobro },
    { data: cobros },
    { data: campanas },
    { data: progreso },
    { data: recientes },
    { count: porRevisar },
    { count: borradoresAntiguos },
  ] = resultados;

  // ── Cobros (mismo criterio que antes y que /admin/cobros) ─────────────────────────────
  const filasCobro = (estadoCobro ?? []).filter((d) => d.id != null && d.fecha != null);
  const pendientesAbiertos = filasCobro.filter((d) => ["pendiente", "parcial", "vencida"].includes(d.estado_cobro ?? ""));
  const totalPendiente = pendientesAbiertos.reduce((s, d) => s + Number(d.pendiente ?? 0), 0);
  const conSaldo = pendientesAbiertos
    .filter((d) => Number(d.pendiente ?? 0) > 0.01)
    .map((d) => ({
      ...d,
      id: d.id as number,
      pendienteNum: Number(d.pendiente ?? 0),
      aging: clasificarAgingCobro(d.estado_cobro, d.fecha_vencimiento, ahora),
    }));
  const suma = (l: typeof conSaldo) => l.reduce((s, d) => s + d.pendienteNum, 0);
  const criticas90 = conSaldo
    .filter((d) => d.aging.tramo === "critica_90")
    .sort((a, b) => b.aging.diasVencido - a.aging.diasVencido);
  const vencidas = conSaldo.filter((d) => d.aging.tramo !== "al_dia");
  // Sin fecha de vencimiento una factura nunca cuenta como vencida: los KPI a cero no significan «al día».
  const sinVencimiento = conSaldo.filter((d) => d.tipo === "factura" && !d.fecha_vencimiento);
  const nSinVenc = sinVencimiento.length;
  const nPorRevisar = porRevisar ?? 0;
  const nBorradores = borradoresAntiguos ?? 0;

  // ── Series de las tarjetas KPI ─────────────────────────────────────────────────────────
  const docs = filasCobro.map((d) => ({
    id: d.id as number,
    fecha: d.fecha as string,
    fechaVencimiento: d.fecha_vencimiento,
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
  const sumaCriticas90 = suma(criticas90);

  // Control: la serie histórica se reconstruye con documentos + cobros; hoy debe dar lo mismo que la vista.
  const reconstruidoHoy = calc.pendiente(hoy);
  if (Math.abs(reconstruidoHoy - totalPendiente) > 0.01) {
    console.warn(
      `[panel] El saldo reconstruido (${reconstruidoHoy.toFixed(2)}) no coincide con v_estado_cobro (${totalPendiente.toFixed(2)}).`,
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
      detalle: `${nSinVenc} factura${nSinVenc === 1 ? "" : "s"} · ${euros(suma(sinVencimiento))}`,
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
        subtitulo={
          <>
            Resumen de hoy · <span>{fechaLarga(hoy)}</span>
          </>
        }
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
            nSinVenc > 0
              ? { texto: `${nSinVenc} factura${nSinVenc === 1 ? "" : "s"} sin vencimiento`, href: "/admin/cobros?ver=sin_vencimiento" }
              : vencidas.length > 0
                ? { texto: `${vencidas.length} vencida${vencidas.length === 1 ? "" : "s"}`, href: "/admin/cobros?ver=vencidas", tono: "peligro" }
                : { texto: "Ver cobros", href: "/admin/cobros", tono: "marca" }
          }
        />
        <TarjetaKpiDinamica
          etiqueta="Vencido · más de 90 días"
          significado={nSinVenc > 0 ? "Importe conocido · evaluación parcial" : "Saldo vencido hace más de 90 días"}
          tipo="linea"
          color="riesgo"
          series={serieRiesgo}
          nota={
            nSinVenc > 0
              ? { texto: "Sin fecha: riesgo no evaluable", href: "/admin/cobros?ver=sin_vencimiento", tono: "peligro" }
              : criticas90.length > 0
                ? { texto: `${criticas90.length} factura${criticas90.length === 1 ? "" : "s"} por reclamar`, href: "/admin/cobros?ver=90", tono: "peligro" }
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

      <div className="flex flex-col gap-esp5 xl:flex-row">
        {/* Cobros y vencimientos */}
        <Tarjeta como="section" aria-labelledby="titulo-cobros" className="min-w-0 flex-1">
          <CabeceraTarjeta
            id="titulo-cobros"
            titulo="Cobros y vencimientos"
            estado={nSinVenc > 0 ? <Insignia tono="aviso">Datos parciales</Insignia> : undefined}
          />
          <div className="grid grid-cols-1 gap-esp4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-borde-default">
            <Hecho etiqueta="Saldo pendiente" valor={euros(totalPendiente)} alcance={`${conSaldo.length} factura${conSaldo.length === 1 ? "" : "s"} con saldo`} />
            <Hecho
              etiqueta="Sin fecha de vencimiento"
              valor={euros(suma(sinVencimiento))}
              tono={nSinVenc > 0 ? "aviso" : undefined}
              alcance={nSinVenc > 0 ? `${nSinVenc} factura${nSinVenc === 1 ? "" : "s"} por completar` : "Todas tienen vencimiento"}
            />
            <Hecho
              etiqueta="Vencido 90+ días conocido"
              valor={euros(sumaCriticas90)}
              tono={criticas90.length > 0 ? "critico" : undefined}
              alcance={nSinVenc > 0 ? "No confirma ausencia de riesgo" : `${criticas90.length} factura${criticas90.length === 1 ? "" : "s"}`}
            />
          </div>
          {nSinVenc > 0 && (
            <div className="flex gap-esp3 rounded-lg bg-fondo-sutil px-esp4 py-esp3">
              <Icono nombre="alerta" size={20} className="text-icono-default" />
              <p className="text-meta font-medium text-texto-primario">
                La antigüedad del saldo todavía no es fiable. Completa los vencimientos y valida los datos antes de
                interpretar el riesgo.
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
                  importe={euros(d.pendienteNum)}
                  estado="vencida"
                  textoEstado={`Vencida hace ${d.aging.diasVencido} días`}
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
    <div className="flex flex-col gap-esp2 sm:px-esp6 sm:first:pl-0 sm:last:pr-0">
      <p className="text-meta font-medium text-texto-secundario">{etiqueta}</p>
      <p
        className={cn(
          "tabular-nums text-importe",
          tono === "aviso" ? "text-texto-aviso" : tono === "critico" ? "text-texto-critico" : "text-texto-primario",
        )}
      >
        {valor}
      </p>
      <p className="text-etiqueta text-texto-secundario">{alcance}</p>
    </div>
  );
}
