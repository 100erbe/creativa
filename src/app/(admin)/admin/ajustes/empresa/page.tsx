import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { Icono } from "@/components/ui/iconos";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { FormularioEmpresa } from "./formulario-empresa";

export const dynamic = "force-dynamic";

export default async function PaginaEmpresa() {
  const supabase = await createClient();
  const resultado = await supabase.from("empresa").select("*").eq("id", 1).maybeSingle();
  lanzarSiError(resultado);
  const e = resultado.data;

  return (
    <div className="flex max-w-3xl flex-col gap-esp5">
      <CabeceraPagina
        antes={
          <Link
            href="/admin/ajustes"
            className="hidden w-fit items-center gap-esp1 text-sm text-texto-secundario hover:text-texto-primario md:flex"
          >
            <Icono nombre="atras" size={16} />
            Ajustes
          </Link>
        }
        titulo="Datos de la empresa"
        subtitulo={
          <>
            Salen en la cabecera de todos los documentos al imprimirlos, también en los ya emitidos.
          </>
        }
      />
      {e ? (
        <FormularioEmpresa
          inicial={{
            nombre_comercial: e.nombre_comercial,
            razon_social: e.razon_social,
            nif: e.nif,
            direccion: e.direccion,
            codigo_postal: e.codigo_postal ?? "",
            municipio: e.municipio ?? "",
            provincia: e.provincia ?? "",
            telefono: e.telefono ?? "",
            movil: e.movil ?? "",
            email: e.email ?? "",
            lema: e.lema ?? "",
            validez_presupuesto_dias: e.validez_presupuesto_dias,
          }}
        />
      ) : (
        <p className="text-sm text-texto-peligro">No hay ningún registro de empresa en la base de datos.</p>
      )}
    </div>
  );
}
