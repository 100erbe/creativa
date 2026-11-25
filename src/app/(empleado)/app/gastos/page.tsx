import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { Insignia } from "@/components/ui/insignia";
import { clasesBoton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { euros, fechaMedia } from "@/lib/formato";
import { ETIQUETA_ESTADO_GASTO, ETIQUETA_TIPO_GASTO, TONO_ESTADO_GASTO } from "@/lib/gastos";

export const dynamic = "force-dynamic";

export default async function PaginaMisGastos({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const params = await searchParams;
  const filtroEstado =
    params.estado === "rechazado" || params.estado === "pendiente" || params.estado === "aprobado"
      ? params.estado
      : "";

  const usuario = await obtenerUsuarioActual();
  const supabase = await createClient();
  const res = await supabase
    .from("gastos")
    .select("id, codigo, tipo, fecha, concepto, total, estado, motivo_rechazo, ticket_path")
    .eq("usuario_id", usuario?.id ?? "")
    .order("fecha", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);
  lanzarSiError(res);
  const todos = res.data ?? [];

  const pendientes = todos.filter((g) => g.estado === "pendiente");
  const aprobados = todos.filter((g) => g.estado === "aprobado" || g.estado === "reembolsado");
  const rechazados = todos.filter((g) => g.estado === "rechazado");

  const suma = (lista: typeof todos) => lista.reduce((s, g) => s + Number(g.total), 0);

  const visibles = todos.filter((g) => {
    if (filtroEstado === "rechazado") return g.estado === "rechazado";
    if (filtroEstado === "pendiente") return g.estado === "pendiente";
    if (filtroEstado === "aprobado") return g.estado === "aprobado" || g.estado === "reembolsado";
    return true;
  });

  return (
    <div className="flex flex-col gap-esp4 px-esp4 pt-esp5">
      <div className="flex items-center gap-esp3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-texto-primario">Mis gastos</h1>
          <p className="text-xs text-texto-secundario">Tickets y pequeños gastos de campo.</p>
        </div>
        <Link href="/app/gastos/nuevo" className={clasesBoton("primario", "m", "shrink-0")}>
          <Icono nombre="camara" size={16} />
          Escanear ticket
        </Link>
      </div>

      {/* Banner de alerta crítica para gastos rechazados que requieren corrección */}
      {rechazados.length > 0 && (
        <div
          role="region"
          aria-label="Gastos rechazados pendientes de corregir"
          className="flex flex-wrap items-center gap-esp3 rounded-lg border border-borde-critico-sutil border-l-4 border-l-borde-critico bg-fondo-critico-sutil px-esp3 py-esp3"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-texto-critico">
              {rechazados.length} gasto{rechazados.length === 1 ? "" : "s"} rechazado
              {rechazados.length === 1 ? "" : "s"} por revisar
            </p>
            <p className="tabular-nums text-xs text-texto-primario">
              Total por corregir: <strong className="text-texto-critico">{euros(suma(rechazados))}</strong>
            </p>
          </div>
          <Link href={filtroEstado === "rechazado" ? "/app/gastos" : "/app/gastos?estado=rechazado"} className={clasesBoton(filtroEstado === "rechazado" ? "secundario" : "critico", "s")}>
            {filtroEstado === "rechazado" ? "Ver todos" : "Corregir ahora"}
          </Link>
        </div>
      )}

      {/* Mini KPI bar */}
      <div className="grid grid-cols-3 gap-esp2">
        <Link
          href="/app/gastos?estado=pendiente"
          className="flex flex-col gap-0.5 rounded-xl border border-borde-default bg-fondo-superficie px-esp3 py-esp2.5"
        >
          <span className="text-micro text-texto-terciario">Pendientes</span>
          <span className="tabular-nums text-sm font-semibold text-texto-primario">{euros(suma(pendientes))}</span>
        </Link>
        <Link
          href="/app/gastos?estado=aprobado"
          className="flex flex-col gap-0.5 rounded-xl border border-borde-default bg-fondo-superficie px-esp3 py-esp2.5"
        >
          <span className="text-micro text-texto-terciario">Aprobados</span>
          <span className="tabular-nums text-sm font-semibold text-texto-exito">{euros(suma(aprobados))}</span>
        </Link>
        <Link
          href="/app/gastos?estado=rechazado"
          className={
            rechazados.length > 0
              ? "flex flex-col gap-0.5 rounded-lg border border-borde-critico-sutil border-l-4 border-l-borde-critico bg-fondo-critico-sutil/60 px-esp3 py-esp2.5"
              : "flex flex-col gap-0.5 rounded-xl border border-borde-default bg-fondo-superficie px-esp3 py-esp2.5"
          }
        >
          <span className={`text-micro ${rechazados.length > 0 ? "text-texto-critico" : "text-texto-terciario"}`}>
            Por corregir
          </span>
          <span
            className={`tabular-nums text-sm font-semibold ${
              rechazados.length > 0 ? "text-texto-critico" : "text-texto-primario"
            }`}
          >
            {euros(suma(rechazados))}
          </span>
        </Link>
      </div>

      {/* Filtros rápidos */}
      <div className="flex flex-wrap gap-esp2" role="group" aria-label="Filtrar gastos por estado">
        {[
          { valor: "", etiqueta: `Todos (${todos.length})` },
          { valor: "rechazado", etiqueta: `Rechazados (${rechazados.length})` },
          { valor: "pendiente", etiqueta: `Pendientes (${pendientes.length})` },
          { valor: "aprobado", etiqueta: `Aprobados (${aprobados.length})` },
        ].map((f) => {
          const activo = filtroEstado === f.valor;
          return (
            <Link
              key={f.valor}
              href={f.valor ? `/app/gastos?estado=${f.valor}` : "/app/gastos"}
              aria-current={activo ? "true" : undefined}
              className={`tabular-nums inline-flex min-h-10 items-center rounded-md px-esp3 text-xs font-medium transition-colors ${
                activo
                  ? f.valor === "rechazado"
                    ? "bg-fondo-critico text-texto-inverso"
                    : "bg-fondo-marca text-texto-sobre-marca"
                  : "border border-borde-default bg-fondo-superficie text-texto-secundario hover:bg-fondo-sutil"
              }`}
            >
              {f.etiqueta}
            </Link>
          );
        })}
      </div>

      {visibles.length === 0 && (
        <p className="rounded-xl border border-dashed border-borde-default bg-fondo-superficie px-esp4 py-esp6 text-center text-sm text-texto-terciario">
          {filtroEstado ? "No hay gastos con este estado." : "Todavía no has registrado ningún gasto."}
        </p>
      )}

      <div className="flex flex-col gap-esp3">
        {visibles.map((g) => {
          const rechazado = g.estado === "rechazado";
          const editable = g.tipo === "menor" && (g.estado === "pendiente" || rechazado);
          const contenido = (
            <div
              className={`flex flex-col gap-1.5 rounded-lg border px-esp4 py-esp3 transition-colors ${
                rechazado
                  ? "border-borde-critico-sutil border-l-4 border-l-borde-critico bg-fondo-critico-sutil/40"
                  : "border-borde-default bg-fondo-superficie"
              }`}
            >
              <div className="flex items-center gap-esp2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-texto-primario">{g.concepto}</span>
                <span className="tabular-nums whitespace-nowrap text-sm font-semibold text-texto-primario">
                  {euros(Number(g.total))}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-esp2 text-xs text-texto-terciario">
                <span>{fechaMedia(g.fecha)}</span>
                <span>· {ETIQUETA_TIPO_GASTO[g.tipo]}</span>
                {!g.ticket_path && <span className="font-medium text-texto-aviso">· ⚠ Falta ticket</span>}
                <Insignia
                  tono={rechazado ? "critico" : TONO_ESTADO_GASTO[g.estado]}
                  solido={rechazado}
                  className="ml-auto"
                >
                  {ETIQUETA_ESTADO_GASTO[g.estado]}
                </Insignia>
              </div>
              {rechazado && (
                <div className="mt-1 rounded bg-fondo-critico-sutil px-esp2 py-esp1.5 text-xs text-texto-critico">
                  {g.motivo_rechazo && <p className="font-medium">Motivo: {g.motivo_rechazo}</p>}
                  <p className="font-semibold">Toca para corregir y reenviar →</p>
                </div>
              )}
            </div>
          );
          return editable ? (
            <Link key={g.id} href={`/app/gastos/${g.id}/editar`}>
              {contenido}
            </Link>
          ) : (
            <div key={g.id}>{contenido}</div>
          );
        })}
      </div>
    </div>
  );
}
