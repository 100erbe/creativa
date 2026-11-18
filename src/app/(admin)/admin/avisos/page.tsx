import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { clasesBoton } from "@/components/ui/boton";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { Icono } from "@/components/ui/iconos";
import { Insignia } from "@/components/ui/insignia";

export const dynamic = "force-dynamic";

const fechaHora = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

export default async function PaginaAvisos() {
  const supabase = await createClient();
  const resultado = await supabase
    .from("avisos")
    .select("id, titulo, urgente, creado_en, cerrado_en, avisos_destinatarios(confirmado_en, leido_en)")
    .order("creado_en", { ascending: false })
    .limit(50);
  lanzarSiError(resultado);
  const avisos = resultado.data ?? [];

  return (
    <div className="flex flex-col gap-esp6">
      <CabeceraPagina
        titulo="Avisos al equipo"
        subtitulo="Comunicaciones al equipo. Los urgentes se repiten hasta que cada persona confirma."
        acciones={
          <Link href="/admin/avisos/nuevo" className={clasesBoton("primario", "m", "shrink-0")} aria-label="Nuevo aviso">
            <Icono nombre="mas" size={16} />
            <span className="hidden sm:inline">Nuevo aviso</span>
          </Link>
        }
      />

      <div className="flex flex-col divide-y divide-borde-default rounded-xl border border-borde-default bg-fondo-superficie px-esp4 md:px-esp6">
        {avisos.map((a) => {
          const destinatarios = a.avisos_destinatarios ?? [];
          const total = destinatarios.length;
          const confirmados = destinatarios.filter((d) => d.confirmado_en).length;
          const leidos = destinatarios.filter((d) => d.leido_en).length;
          const completo = a.urgente ? confirmados === total : leidos === total;
          return (
            <Link key={a.id} href={`/admin/avisos/${a.id}`} className="flex items-center gap-esp3 py-esp3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-texto-primario">{a.titulo}</p>
                <p className="text-xs text-texto-terciario">
                  {fechaHora.format(new Date(a.creado_en))} · {total} destinatario{total === 1 ? "" : "s"}
                </p>
              </div>
              {a.urgente && <Insignia tono="peligro">Urgente</Insignia>}
              {a.cerrado_en ? (
                <Insignia tono="neutro">Cerrado</Insignia>
              ) : (
                <Insignia tono={completo ? "exito" : "aviso"}>
                  {a.urgente ? `${confirmados}/${total} confirmados` : `${leidos}/${total} leídos`}
                </Insignia>
              )}
            </Link>
          );
        })}
        {avisos.length === 0 && <p className="py-esp5 text-sm text-texto-terciario">Todavía no has enviado ningún aviso.</p>}
      </div>

      <p className="text-xs text-texto-terciario">
        ¿Quieres recibir tú los avisos del campo en tu móvil?{" "}
        <Link href="/admin/ajustes/avisos" className="font-medium text-texto-marca">
          Actívalos en este dispositivo
        </Link>
        .
      </p>
    </div>
  );
}
