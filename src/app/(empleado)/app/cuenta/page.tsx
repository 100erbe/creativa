import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { SeccionesCuenta } from "@/components/cuenta/secciones-cuenta";

export const dynamic = "force-dynamic";

/** Mi cuenta (app del empleado): datos personales, foto, contraseña y sesiones. */
export default async function PaginaMiCuentaEmpleado() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/entrar?volver=/app/cuenta");

  return (
    <div className="flex flex-col gap-esp5 px-esp4 pt-esp5">
      <div>
        <h1 className="text-2xl font-bold text-texto-primario">Mi cuenta</h1>
        <p className="text-cuerpo text-texto-secundario">Tus datos, tu foto y el acceso a la app.</p>
      </div>
      <SeccionesCuenta usuario={usuario} enlaceAvisos="/app/ajustes" />
    </div>
  );
}
