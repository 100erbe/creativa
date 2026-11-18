import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { BarraLateral } from "@/components/admin/barra-lateral";
import { PaletaComandos } from "@/components/admin/paleta-comandos";
import { IniciarAvisos } from "@/components/avisos/panel-avisos";
import { PopupAviso } from "@/components/avisos/popup-aviso";
import { contarNoLeidos } from "@/lib/push/bandeja";
import { sumarDias } from "@/lib/documentos";
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
  const hoyIso = new Date().toISOString().slice(0, 10);
  const limite90 = sumarDias(hoyIso, -90);

  const [noLeidos, resVencidas90, avatar] = await Promise.all([
    contarNoLeidos(),
    supabase
      .from("v_estado_cobro")
      .select("id", { count: "exact", head: true })
      .in("estado_cobro", ["pendiente", "parcial", "vencida"])
      .gt("pendiente", 0.01)
      .lte("fecha_vencimiento", limite90),
    urlAvatar(usuario.avatarUrl),
  ]);

  const vencidas90 = resVencidas90.error ? 0 : (resVencidas90.count ?? 0);
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
