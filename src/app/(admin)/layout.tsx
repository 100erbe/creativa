import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { BarraLateral } from "@/components/admin/barra-lateral";
import { PaletaComandos } from "@/components/admin/paleta-comandos";
import { IniciarAvisos } from "@/components/avisos/panel-avisos";
import { PopupAviso } from "@/components/avisos/popup-aviso";
import { SincronizadorVivo } from "@/components/shared/sincronizador-vivo";
import { contarNoLeidos } from "@/lib/push/bandeja";
import { resumirCobrosPendientes } from "@/lib/cobros-pendientes";
import { urlAvatar } from "@/lib/avatar";

export default async function LayoutAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await obtenerUsuarioActual();

  // El middleware ya protege /admin, pero comprobamos de nuevo aquí por si
  // esta ruta se renderiza en un contexto distinto (p. ej. tests).
  if (!usuario || usuario.rol !== "admin") redirect("/entrar");

  const supabase = await createClient();

  const [noLeidos, resAbiertos, resMetaDocs, avatar] = await Promise.all([
    contarNoLeidos(),
    supabase
      .from("v_estado_cobro")
      .select("id, tipo, fecha, fecha_vencimiento, pendiente, estado_cobro")
      .in("estado_cobro", ["pendiente", "parcial", "vencida"])
      .limit(5000),
    supabase
      .from("documentos")
      .select("id, estado, documento_origen_id")
      .in("tipo", ["factura", "rectificativa"])
      .neq("estado", "borrador")
      .limit(5000),
    urlAvatar(usuario.avatarUrl),
  ]);

  const vencidas90 =
    resAbiertos.error || resMetaDocs.error
      ? 0
      : resumirCobrosPendientes(resAbiertos.data ?? [], resMetaDocs.data ?? []).criticas90.length;
  const iniciales = `${usuario.nombre[0] ?? ""}${usuario.apellidos?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col bg-fondo-lienzo md:flex-row print:block print:bg-fondo-superficie">
      <a
        href="#contenido-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:left-esp4 focus:top-esp4 focus:z-[300] focus:rounded-md focus:bg-fondo-marca focus:px-esp4 focus:py-esp2 focus:text-sm focus:font-medium focus:text-texto-sobre-marca focus:shadow-lg"
      >
        Saltar al contenido principal
      </a>
      <BarraLateral
        nombre={`${usuario.nombre} ${usuario.apellidos ?? ""}`.trim()}
        rolEtiqueta="Administrador"
        iniciales={iniciales}
        avatarUrl={avatar}
        noLeidos={noLeidos}
        vencidas90={vencidas90}
      />
      <PaletaComandos />
      <IniciarAvisos />
      <PopupAviso />
      <SincronizadorVivo usuarioId={usuario.id} esAdmin />
      <main
        id="contenido-principal"
        tabIndex={-1}
        className="min-w-0 flex-1 px-esp4 py-esp5 pb-24 outline-none md:px-esp8 md:py-esp6 md:pb-esp6 print:p-0"
      >
        {children}
      </main>
    </div>
  );
}
