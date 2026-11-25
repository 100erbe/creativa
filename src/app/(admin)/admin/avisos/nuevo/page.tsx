import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { FormularioAviso } from "./formulario-aviso";
import { EnlaceVolver } from "@/components/shared/detail-layout";

export const dynamic = "force-dynamic";

export default async function PaginaNuevoAviso() {
  const supabase = await createClient();
  const [personas, dispositivos] = await Promise.all([
    supabase.from("usuarios").select("id, nombre, apellidos, rol").eq("activo", true).order("nombre"),
    supabase.from("suscripciones_push").select("usuario_id"),
  ]);
  lanzarSiError(personas, dispositivos);

  const cuenta: Record<string, number> = {};
  for (const d of dispositivos.data ?? []) cuenta[d.usuario_id] = (cuenta[d.usuario_id] ?? 0) + 1;

  return (
    <div className="flex max-w-2xl flex-col gap-esp5">
      <CabeceraPagina
        antes={
          <EnlaceVolver href="/admin/avisos" etiqueta="Avisos" />
        }
        titulo="Nuevo aviso"
      />
      <FormularioAviso
        personas={(personas.data ?? []).map((p) => ({
          id: p.id,
          nombre: `${p.nombre} ${p.apellidos ?? ""}`.trim(),
          rol: p.rol,
          dispositivos: cuenta[p.id] ?? 0,
        }))}
      />
    </div>
  );
}
