import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { Icono } from "@/components/ui/iconos";
import { Equipo } from "./controles";

export const dynamic = "force-dynamic";

export default async function PaginaEquipo() {
  const supabase = await createClient();
  const yo = await obtenerUsuarioActual();
  const resultado = await supabase
    .from("usuarios")
    .select("id, nombre, apellidos, email, telefono, rol, activo")
    .order("activo", { ascending: false })
    .order("nombre");
  lanzarSiError(resultado);

  return (
    <div className="flex max-w-3xl flex-col gap-esp5">
      <div className="flex flex-col gap-esp2">
        <Link
          href="/admin/ajustes"
          className="flex w-fit items-center gap-esp1 text-sm text-texto-secundario hover:text-texto-primario"
        >
          <Icono nombre="atras" size={16} />
          Ajustes
        </Link>
        <h1 className="text-2xl font-semibold text-texto-primario">Equipo</h1>
        <p className="text-sm text-texto-secundario">
          Las personas con rol <strong>Empleado</strong> solo ven la app del móvil (agenda, mapa y fotos); las{" "}
          <strong>Administradoras</strong> ven todo este panel.
        </p>
      </div>
      <Equipo personas={resultado.data ?? []} yoId={yo?.id ?? ""} />
    </div>
  );
}
