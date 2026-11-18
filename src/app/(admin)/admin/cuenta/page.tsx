import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { SeccionesCuenta } from "@/components/cuenta/secciones-cuenta";

export const dynamic = "force-dynamic";

/** Mi cuenta (administración): datos personales, foto, acceso, sesiones y verificación en dos pasos. */
export default async function PaginaMiCuenta() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/entrar?volver=/admin/cuenta");

  return (
    <div className="flex max-w-4xl flex-col gap-esp5">
      <CabeceraPagina titulo="Mi cuenta" subtitulo="Tus datos personales y el acceso a la aplicación." />
      <SeccionesCuenta usuario={usuario} enlaceAvisos="/admin/ajustes/avisos" />
    </div>
  );
}
