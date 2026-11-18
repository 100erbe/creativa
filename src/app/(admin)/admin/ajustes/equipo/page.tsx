import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { Icono } from "@/components/ui/iconos";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { Equipo } from "./controles";

export const dynamic = "force-dynamic";

export default async function PaginaEquipo() {
  const supabase = await createClient();
  const yo = await obtenerUsuarioActual();
  const [resultado, dispositivosRes] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, nombre, apellidos, email, telefono, rol, activo")
      .order("activo", { ascending: false })
      .order("nombre"),
    supabase.from("suscripciones_push").select("usuario_id, ultimo_envio_ok, fallos_seguidos"),
  ]);
  lanzarSiError(resultado, dispositivosRes);

  // Cuántos dispositivos con avisos tiene cada persona y si el último envío llegó bien.
  const dispositivos: Record<string, { cantidad: number; fallos: number }> = {};
  for (const d of dispositivosRes.data ?? []) {
    const actual = dispositivos[d.usuario_id] ?? { cantidad: 0, fallos: 0 };
    dispositivos[d.usuario_id] = { cantidad: actual.cantidad + 1, fallos: Math.max(actual.fallos, d.fallos_seguidos) };
  }

  return (
    <div className="flex max-w-3xl flex-col gap-esp5">
      <CabeceraPagina
        antes={
          <Link
            href="/admin/ajustes"
            className="flex w-fit items-center gap-esp1 text-sm text-texto-secundario hover:text-texto-primario"
          >
            <Icono nombre="atras" size={16} />
            Ajustes
          </Link>
        }
        titulo="Equipo"
        subtitulo={
          <>
            Las personas con rol <strong>Empleado</strong> solo ven la app del móvil (agenda, mapa y fotos); las{" "}
          <strong>Administradoras</strong> ven todo este panel.
          </>
        }
      />
      <Equipo personas={resultado.data ?? []} yoId={yo?.id ?? ""} dispositivos={dispositivos} />
    </div>
  );
}
