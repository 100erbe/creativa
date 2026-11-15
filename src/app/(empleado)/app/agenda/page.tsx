import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { Icono } from "@/components/ui/iconos";
import { fechaCorta, fechaLarga } from "@/lib/formato";
import { saludo } from "@/lib/saludo";
import { ETIQUETA_SOPORTE, etiquetaEstado } from "@/lib/etiquetas";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Fila = {
  asignacion_id: number | null;
  punto_id: number | null;
  punto: string | null;
  tipo_soporte: string | null;
  campana: string | null;
  estado_punto: string | null;
  estado_asignacion: string | null;
  rol_asignacion: string | null;
  fecha_programada: string | null;
  direccion: string | null;
};

/** La fecha de "hoy" en España, en formato AAAA-MM-DD (el servidor puede estar en otra zona horaria). */
function hoyEnEspana() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
}

export default async function PaginaAgenda() {
  const supabase = await createClient();
  const usuario = await obtenerUsuarioActual();
  const hoy = hoyEnEspana();

  const [pendientesRes, hechasRes] = await Promise.all([
    supabase
      .from("v_agenda_empleado")
      .select("*")
      .eq("usuario_id", usuario?.id ?? "")
      .in("estado_asignacion", ["pendiente", "en_curso"])
      .order("fecha_programada", { ascending: true, nullsFirst: false }),
    supabase
      .from("v_agenda_empleado")
      .select("*")
      .eq("usuario_id", usuario?.id ?? "")
      .eq("estado_asignacion", "completada")
      .order("fecha_programada", { ascending: false, nullsFirst: false })
      .limit(10),
  ]);
  lanzarSiError(pendientesRes, hechasRes);

  const pendientes = (pendientesRes.data ?? []) as Fila[];
  const hechas = (hechasRes.data ?? []) as Fila[];

  const atrasadas = pendientes.filter((p) => p.fecha_programada && p.fecha_programada < hoy);
  const deHoy = pendientes.filter((p) => p.fecha_programada === hoy);
  const proximas = pendientes.filter((p) => p.fecha_programada && p.fecha_programada > hoy);
  const sinFecha = pendientes.filter((p) => !p.fecha_programada);

  const grupos = [
    { titulo: "Atrasados", filas: atrasadas, aviso: true },
    { titulo: "Hoy", filas: deHoy },
    { titulo: "Próximos días", filas: proximas },
    { titulo: "Sin fecha", filas: sinFecha },
  ].filter((g) => g.filas.length > 0);

  return (
    <div className="flex flex-col gap-esp5 px-esp4 pt-esp5">
      <div>
        <p className="text-sm text-texto-secundario capitalize">{fechaLarga(new Date())}</p>
        <h1 className="text-xl font-semibold text-texto-primario">{saludo()}, {usuario?.nombre}</h1>
      </div>

      <div className="flex gap-esp3">
        <div className="flex-1 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp3">
          <p className="text-xs text-texto-terciario">Para hoy</p>
          <p className="text-xl font-semibold text-texto-primario">{deHoy.length}</p>
        </div>
        <div className="flex-1 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp3">
          <p className="text-xs text-texto-terciario">Por hacer</p>
          <p className="text-xl font-semibold text-texto-primario">{pendientes.length}</p>
        </div>
        {atrasadas.length > 0 && (
          <div className="flex-1 rounded-lg border border-borde-peligro-sutil bg-fondo-peligro-sutil px-esp4 py-esp3">
            <p className="text-xs text-texto-peligro">Atrasados</p>
            <p className="text-xl font-semibold text-texto-peligro">{atrasadas.length}</p>
          </div>
        )}
      </div>

      {grupos.map((g) => (
        <section key={g.titulo} className="flex flex-col gap-esp3">
          <h2 className={g.aviso ? "text-sm font-medium text-texto-peligro" : "text-sm font-medium text-texto-secundario"}>
            {g.titulo} · {g.filas.length}
          </h2>
          {g.filas.map((p) => (
            <TarjetaPunto key={p.asignacion_id} p={p} />
          ))}
        </section>
      ))}

      {pendientes.length === 0 && (
        <p className="rounded-lg border border-dashed border-borde-default px-esp4 py-esp6 text-center text-sm text-texto-terciario">
          No tienes puntos pendientes.
        </p>
      )}

      {hechas.length > 0 && (
        <section className="flex flex-col gap-esp3">
          <h2 className="text-sm font-medium text-texto-secundario">Hechos recientemente</h2>
          {hechas.map((p) => (
            <TarjetaPunto key={p.asignacion_id} p={p} apagada />
          ))}
        </section>
      )}
    </div>
  );
}

function TarjetaPunto({ p, apagada }: { p: Fila; apagada?: boolean }) {
  const retirada = p.rol_asignacion === "retirador";
  return (
    <Link
      href={`/app/punto/${p.punto_id}`}
      className={
        "flex items-center gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp3" +
        (apagada ? " opacity-70" : "")
      }
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-fondo-marca-sutil">
        <Icono nombre="ubicacion" size={20} className="text-icono-marca" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-texto-primario">{p.punto}</p>
        <p className="truncate text-xs text-texto-terciario">
          {retirada ? "Retirar · " : ""}
          {ETIQUETA_SOPORTE[p.tipo_soporte ?? ""] ?? p.tipo_soporte} · {p.campana}
          {p.fecha_programada ? ` · ${fechaCorta(p.fecha_programada)}` : ""}
        </p>
        {p.direccion && <p className="truncate text-xs text-texto-terciario">{p.direccion}</p>}
      </div>
      <Insignia tono={TONO_POR_ESTADO[p.estado_punto ?? ""] ?? "neutro"}>{etiquetaEstado(p.estado_punto)}</Insignia>
    </Link>
  );
}
