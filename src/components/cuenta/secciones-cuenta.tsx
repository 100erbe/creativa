import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { UsuarioActual } from "@/lib/supabase/usuario";
import { Tarjeta, CabeceraTarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Icono } from "@/components/ui/iconos";
import { clasesBoton } from "@/components/ui/boton";
import { urlAvatar } from "@/lib/avatar";
import { inicialesPersona } from "@/lib/perfil";
import { fechaMedia } from "@/lib/formato";
import { FotoPerfil } from "./foto-perfil";
import { FormularioPerfil } from "./formulario-perfil";
import { CerrarOtrasSesiones } from "./cerrar-otras-sesiones";
import { VerificacionDosPasos } from "./verificacion-dos-pasos";

/**
 * Contenido de «Mi cuenta», común a la administración (/admin/cuenta) y a la app del
 * empleado (/app/cuenta): datos personales y foto, acceso y seguridad, avisos del dispositivo.
 * La verificación en dos pasos solo se ofrece a las cuentas de administración.
 */
export async function SeccionesCuenta({
  usuario,
  enlaceAvisos,
}: {
  usuario: UsuarioActual;
  /** Página de configuración de avisos en este dispositivo. */
  enlaceAvisos?: string;
}) {
  const supabase = await createClient();
  const [{ data: fila }, { data: auth }, avatar] = await Promise.all([
    supabase.from("usuarios").select("telefono, creado_en").eq("id", usuario.id).single(),
    supabase.auth.getUser(),
    urlAvatar(usuario.avatarUrl),
  ]);
  const ultimoAcceso = auth.user?.last_sign_in_at;
  const nombreCompleto = `${usuario.nombre} ${usuario.apellidos ?? ""}`.trim();
  const esAdmin = usuario.rol === "admin";

  return (
    <>
      <Tarjeta como="section" aria-label="Datos personales">
        <FotoPerfil
          usuarioId={usuario.id}
          url={avatar}
          iniciales={inicialesPersona(usuario.nombre, usuario.apellidos)}
          nombre={nombreCompleto}
          detalle={
            <p className="flex flex-wrap items-center gap-esp2 text-meta font-medium text-texto-secundario">
              <Insignia tono="marca">{esAdmin ? "Administrador" : "Empleado"}</Insignia>
              {fila?.creado_en && <span>Desde {fechaMedia(fila.creado_en)}</span>}
            </p>
          }
        />
        <div className="h-px bg-borde-default" />
        <FormularioPerfil
          inicial={{ nombre: usuario.nombre, apellidos: usuario.apellidos ?? "", telefono: fila?.telefono ?? "" }}
        />
      </Tarjeta>

      <Tarjeta como="section" aria-labelledby="titulo-acceso">
        <CabeceraTarjeta id="titulo-acceso" titulo="Acceso y seguridad" descripcion="Con qué entras en la aplicación y desde dónde." />
        <dl className="flex flex-col divide-y divide-borde-default">
          <Fila etiqueta="Email de acceso">
            <p className="truncate text-cuerpo text-texto-primario">{usuario.email}</p>
            <p className="text-etiqueta text-texto-secundario">
              Solo lo cambia la administración del sistema: es también tu usuario para entrar.
            </p>
          </Fila>
          <Fila
            etiqueta="Contraseña"
            accion={
              <Link href="/cuenta/contrasena" className={clasesBoton("secundario")}>
                <Icono nombre="candado" size={16} />
                Cambiar contraseña
              </Link>
            }
          >
            <p className="text-cuerpo text-texto-primario">••••••••••</p>
          </Fila>
          <Fila etiqueta="Sesiones abiertas" accion={<CerrarOtrasSesiones />}>
            <p className="text-cuerpo text-texto-primario">
              {ultimoAcceso
                ? `Último acceso: ${new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(ultimoAcceso))}`
                : "Este dispositivo"}
            </p>
            <p className="text-etiqueta text-texto-secundario">
              Si has perdido un móvil o entraste en un ordenador ajeno, cierra allí la sesión desde aquí.
            </p>
          </Fila>
        </dl>
      </Tarjeta>

      {esAdmin && (
        <Tarjeta como="section" aria-labelledby="titulo-dos-pasos">
          <CabeceraTarjeta
            id="titulo-dos-pasos"
            titulo="Verificación en dos pasos"
            descripcion="Protege la cuenta de administración aunque alguien conozca tu contraseña."
          />
          <VerificacionDosPasos />
        </Tarjeta>
      )}

      {enlaceAvisos && (
        <Tarjeta como="section" aria-labelledby="titulo-dispositivo">
          <CabeceraTarjeta
            id="titulo-dispositivo"
            titulo="Avisos en este dispositivo"
            descripcion="Recibe en el móvil u ordenador los avisos del equipo y las incidencias."
            accion={
              <Link href={enlaceAvisos} className={clasesBoton("secundario")}>
                Configurar
              </Link>
            }
          />
        </Tarjeta>
      )}
    </>
  );
}

function Fila({ etiqueta, accion, children }: { etiqueta: string; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-esp2 py-esp4 sm:flex-row sm:items-center sm:gap-esp4">
      <dt className="shrink-0 text-meta font-medium text-texto-secundario sm:w-40">{etiqueta}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
      {accion && <dd className="shrink-0">{accion}</dd>}
    </div>
  );
}
