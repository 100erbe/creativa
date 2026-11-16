import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { Insignia } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { euros, fechaMedia } from "@/lib/formato";
import { ETIQUETA_ESTADO_GASTO, ETIQUETA_TIPO_GASTO, TONO_ESTADO_GASTO } from "@/lib/gastos";

export const dynamic = "force-dynamic";

export default async function PaginaMisGastos() {
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
  const gastos = res.data ?? [];

  return (
    <div className="flex flex-col gap-esp4">
      <div className="flex items-center gap-esp3">
        <h1 className="flex-1 text-xl font-semibold text-texto-primario">Mis gastos</h1>
        <Link href="/app/gastos/nuevo">
          <Boton>
            <Icono nombre="mas" size={16} />
            Nuevo gasto
          </Boton>
        </Link>
      </div>

      {gastos.length === 0 && <p className="text-sm text-texto-terciario">Todavía no has registrado ningún gasto.</p>}

      <div className="flex flex-col gap-esp3">
        {gastos.map((g) => {
          const editable = g.estado === "pendiente" || g.estado === "rechazado";
          const contenido = (
            <div className="flex flex-col gap-1 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp3">
              <div className="flex items-center gap-esp2">
                <span className="flex-1 text-sm font-medium text-texto-primario">{g.concepto}</span>
                <span className="text-sm font-semibold text-texto-primario">{euros(Number(g.total))}</span>
              </div>
              <div className="flex flex-wrap items-center gap-esp2 text-xs text-texto-terciario">
                <span>{fechaMedia(g.fecha)}</span>
                <span>· {ETIQUETA_TIPO_GASTO[g.tipo]}</span>
                {!g.ticket_path && <span className="text-texto-aviso">· ⚠ Falta ticket</span>}
                <Insignia tono={TONO_ESTADO_GASTO[g.estado]} className="ml-auto">
                  {ETIQUETA_ESTADO_GASTO[g.estado]}
                </Insignia>
              </div>
              {g.estado === "rechazado" && g.motivo_rechazo && (
                <p className="text-xs text-texto-peligro">Motivo: {g.motivo_rechazo} — toca para corregirlo.</p>
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
