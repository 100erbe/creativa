import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { Icono } from "@/components/ui/iconos";
import { fechaLarga } from "@/lib/formato";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ETIQUETA_SOPORTE: Record<string, string> = {
  valla: "Valla",
  totem: "Tótem",
  lona: "Lona",
  cartel: "Cartel",
  mobiliario_urbano: "Mobiliario urbano",
  marquesina: "Marquesina",
  pantalla: "Pantalla",
  otro: "Soporte",
};

export default async function PaginaAgenda() {
  const supabase = await createClient();
  const usuario = await obtenerUsuarioActual();

  const { data: agenda } = await supabase
    .from("v_agenda_empleado")
    .select("*")
    .eq("usuario_id", usuario?.id)
    .in("estado_asignacion", ["pendiente", "en_curso"])
    .order("fecha_programada");

  const pendientes = agenda ?? [];

  return (
    <div className="flex flex-col gap-esp5 px-esp4 pt-esp5">
      <div>
        <p className="text-sm text-texto-secundario capitalize">{fechaLarga(new Date())}</p>
        <h1 className="text-xl font-semibold text-texto-primario">
          Hola, {usuario?.nombre}
        </h1>
      </div>

      <div className="flex gap-esp3">
        <div className="flex-1 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp3">
          <p className="text-xs text-texto-terciario">Puntos hoy</p>
          <p className="text-xl font-semibold text-texto-primario">{pendientes.length}</p>
        </div>
        <div className="flex-1 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp3">
          <p className="text-xs text-texto-terciario">En curso</p>
          <p className="text-xl font-semibold text-texto-primario">
            {pendientes.filter((p) => p.estado_asignacion === "en_curso").length}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-esp3">
        <h2 className="text-sm font-medium text-texto-secundario">Mis puntos asignados</h2>
        {pendientes.map((p) => (
          <Link
            key={p.asignacion_id}
            href={`/app/punto/${p.punto_id}`}
            className="flex items-center gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-fondo-marca-sutil">
              <Icono nombre="ubicacion" size={20} className="text-icono-marca" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-texto-primario">{p.punto}</p>
              <p className="truncate text-xs text-texto-terciario">
                {ETIQUETA_SOPORTE[p.tipo_soporte] ?? p.tipo_soporte} · {p.campana}
              </p>
            </div>
            <Insignia tono={TONO_POR_ESTADO[p.estado_punto] ?? "neutro"}>
              {p.estado_punto}
            </Insignia>
          </Link>
        ))}
        {pendientes.length === 0 && (
          <p className="rounded-lg border border-dashed border-borde-default px-esp4 py-esp6 text-center text-sm text-texto-terciario">
            No tienes puntos pendientes por hoy.
          </p>
        )}
      </div>
    </div>
  );
}
