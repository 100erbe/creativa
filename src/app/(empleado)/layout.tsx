import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { CabeceraEmpleado } from "@/components/empleado/cabecera-empleado";
import { contarNoLeidos } from "@/lib/push/bandeja";
import { avisosUrgentesPendientes } from "@/lib/avisos/pendientes";
import { SincronizarFotos } from "@/components/empleado/sincronizar-fotos";
import { BannerAvisos, IniciarAvisos } from "@/components/avisos/panel-avisos";
import { urlAvatar } from "@/lib/avatar";

function hoyEnEspana() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
}

export default async function LayoutEmpleado({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "empleado") redirect("/entrar");

  const supabase = await createClient();
  const hoy = hoyEnEspana();
  const iniciales = `${usuario.nombre[0] ?? ""}${usuario.apellidos?.[0] ?? ""}`.toUpperCase();

  const [noLeidos, urgentes, resAtrasados, resRechazados, avatar] = await Promise.all([
    contarNoLeidos(),
    avisosUrgentesPendientes(),
    supabase
      .from("v_agenda_empleado")
      .select("asignacion_id", { count: "exact", head: true })
      .eq("usuario_id", usuario.id)
      .in("estado_asignacion", ["pendiente", "en_curso"])
      .lt("fecha_programada", hoy),
    supabase
      .from("gastos")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", usuario.id)
      .eq("estado", "rechazado"),
    urlAvatar(usuario.avatarUrl),
  ]);

  const atrasadosCount = resAtrasados.error ? 0 : (resAtrasados.count ?? 0);
  const gastosRechazadosCount = resRechazados.error ? 0 : (resRechazados.count ?? 0);

  return (
    <div className="flex min-h-dvh flex-col bg-fondo-lienzo">
      <a
        href="#contenido-empleado"
        className="sr-only focus:not-sr-only focus:fixed focus:left-esp4 focus:top-esp4 focus:z-[300] focus:rounded-md focus:bg-fondo-marca focus:px-esp4 focus:py-esp2 focus:text-sm focus:font-medium focus:text-texto-sobre-marca focus:shadow-lg"
      >
        Saltar al contenido principal
      </a>
      <CabeceraEmpleado
        nombre={`${usuario.nombre} ${usuario.apellidos ?? ""}`.trim()}
        rolEtiqueta="Empleado"
        iniciales={iniciales}
        avatarUrl={avatar}
        noLeidos={noLeidos}
        atrasadosCount={atrasadosCount}
        gastosRechazadosCount={gastosRechazadosCount}
      />
      <main id="contenido-empleado" tabIndex={-1} className="flex-1 overflow-y-auto pb-24 outline-none">
        <div className="mx-auto w-full max-w-3xl">
          <IniciarAvisos />
          {urgentes.length > 0 && (
            <Link
              href={`/app/avisos/${urgentes[0]!.id}`}
              className="mx-esp4 mt-esp3 flex items-center gap-esp3 rounded-md border border-borde-critico-sutil border-l-4 border-l-borde-critico bg-fondo-critico-sutil px-esp3 py-esp3 text-sm text-texto-primario"
            >
              <span className="min-w-0 flex-1">
                <strong className="font-semibold text-texto-critico">Aviso urgente sin confirmar</strong>
                <span className="block truncate">{urgentes[0]!.titulo}</span>
                {urgentes.length > 1 && <span className="text-xs text-texto-terciario">y {urgentes.length - 1} más</span>}
              </span>
              <span className="shrink-0 font-semibold text-texto-critico">Abrir →</span>
            </Link>
          )}
          <SincronizarFotos />
          <BannerAvisos />
          {children}
        </div>
      </main>
    </div>
  );
}
