import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { Icono } from "@/components/ui/iconos";
import { Insignia } from "@/components/ui/insignia";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { AccionesAviso, BotonReenviar } from "./controles";

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
  const [aviso, destinatarios, dispositivos] = await Promise.all([
    supabase.from("avisos").select("id, titulo, cuerpo, urgente, creado_en, cerrado_en").eq("id", avisoId).maybeSingle(),
    supabase
      .from("avisos_destinatarios")
      .select("usuario_id, envios, ultimo_envio_en, leido_en, confirmado_en, escalado_en, usuarios(nombre, apellidos, telefono)")
      .eq("aviso_id", avisoId),
    supabase.from("suscripciones_push").select("usuario_id"),
  ]);
  lanzarSiError(aviso, destinatarios, dispositivos);
  if (!aviso.data) notFound();

  const a = aviso.data;
  const cuenta: Record<string, number> = {};
  for (const d of dispositivos.data ?? []) cuenta[d.usuario_id] = (cuenta[d.usuario_id] ?? 0) + 1;

  const filas = (destinatarios.data ?? [])
    .map((d) => {
      const u = Array.isArray(d.usuarios) ? d.usuarios[0] : d.usuarios;
      return { ...d, nombre: `${u?.nombre ?? "Persona"} ${u?.apellidos ?? ""}`.trim(), telefono: u?.telefono ?? null };
    })
    .sort((x, y) => Number(!!x.confirmado_en) - Number(!!y.confirmado_en) || x.nombre.localeCompare(y.nombre));
  const pendientes = filas.filter((f) => !f.confirmado_en);

  return (
    <div className="flex max-w-3xl flex-col gap-esp5">
      <CabeceraPagina
        antes={
          <Link
            href="/admin/avisos"
            className="flex w-fit items-center gap-esp1 text-sm text-texto-secundario hover:text-texto-primario"
          >
            <Icono nombre="atras" size={16} />
            Avisos
          </Link>
        }
        titulo={a.titulo}
        subtitulo={`Enviado el ${fechaHora.format(new Date(a.creado_en))}`}
        acciones={
          <>
            {a.urgente && <Insignia tono="peligro">Urgente</Insignia>}
            {a.cerrado_en && <Insignia tono="neutro">Cerrado</Insignia>}
          </>
        }
      />

      <p className="whitespace-pre-line rounded-xl border border-borde-default bg-fondo-superficie px-esp5 py-esp4 text-sm text-texto-primario">
        {a.cuerpo}
      </p>

      <div className="flex flex-wrap items-center gap-esp2">
        {a.urgente && !a.cerrado_en && pendientes.length > 0 && <BotonReenviar avisoId={a.id} cantidad={pendientes.length} />}
        {!a.cerrado_en && <AccionesAviso avisoId={a.id} />}
      </div>

      <div className="flex flex-col divide-y divide-borde-default rounded-xl border border-borde-default bg-fondo-superficie px-esp5">
        {filas.map((f) => {
          const sinDispositivo = !cuenta[f.usuario_id];
          return (
            <div key={f.usuario_id} className="flex flex-wrap items-center gap-x-esp3 gap-y-1 py-esp3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-texto-primario">{f.nombre}</p>
                <p className="text-xs text-texto-terciario">
                  {f.envios} envío{f.envios === 1 ? "" : "s"}
                  {f.ultimo_envio_en ? ` · último ${fechaHora.format(new Date(f.ultimo_envio_en))}` : ""}
                  {sinDispositivo ? " · sin avisos activados en el móvil" : ""}
                </p>
              </div>
              {f.confirmado_en ? (
                <Insignia tono="exito">Confirmado {fechaHora.format(new Date(f.confirmado_en))}</Insignia>
              ) : f.leido_en ? (
                <Insignia tono="aviso">Visto, sin confirmar</Insignia>
              ) : (
                <Insignia tono={f.escalado_en || sinDispositivo ? "peligro" : "neutro"}>Sin abrir</Insignia>
              )}
              {!f.confirmado_en && f.telefono && (
                <a href={`tel:${f.telefono.replace(/\s+/g, "")}`} className="text-xs font-medium text-texto-marca">
                  Llamar
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
