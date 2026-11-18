import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { Icono } from "@/components/ui/iconos";
import { Insignia } from "@/components/ui/insignia";
import { ConfirmarLectura } from "./confirmar-lectura";

export const dynamic = "force-dynamic";

const fechaHora = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

export default async function PaginaAviso({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const avisoId = Number(id);
  if (!Number.isInteger(avisoId)) notFound();

  const supabase = await createClient();
  const usuario = await obtenerUsuarioActual();
  const [aviso, destino] = await Promise.all([
    supabase.from("avisos").select("id, titulo, cuerpo, urgente, creado_en, cerrado_en").eq("id", avisoId).maybeSingle(),
    supabase
      .from("avisos_destinatarios")
      .select("confirmado_en, leido_en")
      .eq("aviso_id", avisoId)
      .eq("usuario_id", usuario?.id ?? "")
      .maybeSingle(),
  ]);
  // La RLS solo deja ver los avisos propios: si no hay fila, el aviso no existe para esta persona.
  if (!aviso.data || !destino.data) notFound();

  const a = aviso.data;
  const confirmado = destino.data.confirmado_en;

  return (
    <div className="flex flex-col gap-esp5 px-esp4 pt-esp5">
      <Link href="/app/avisos" className="-ml-1 flex w-fit items-center gap-esp1 text-sm text-texto-secundario">
        <Icono nombre="atras" size={16} />
        Avisos
      </Link>

      <div className="flex flex-col gap-esp2">
        <div className="flex items-start gap-esp3">
          <h1 className="min-w-0 flex-1 text-2xl font-bold text-texto-primario">{a.titulo}</h1>
          {a.urgente && <Insignia tono="peligro">Urgente</Insignia>}
        </div>
        <p className="text-xs text-texto-terciario">{fechaHora.format(new Date(a.creado_en))}</p>
      </div>

      <p className="whitespace-pre-line rounded-xl border border-borde-default bg-fondo-superficie px-esp4 py-esp4 text-base text-texto-primario">
        {a.cuerpo}
      </p>

      <ConfirmarLectura
        avisoId={a.id}
        urgente={a.urgente}
        cerrado={a.cerrado_en != null}
        confirmadoEn={confirmado ? fechaHora.format(new Date(confirmado)) : null}
        yaLeido={destino.data.leido_en != null}
      />
    </div>
  );
}
