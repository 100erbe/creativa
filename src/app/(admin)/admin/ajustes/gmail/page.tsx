import Link from "next/link";
import { headers } from "next/headers";
import { Icono } from "@/components/ui/iconos";
import { Insignia } from "@/components/ui/insignia";
import { fechaMedia } from "@/lib/formato";
import { cuentaConectada, gmailConfigurado, urlRetornoOAuth } from "@/lib/gmail";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { BotonDesconectar } from "./controles";

export const dynamic = "force-dynamic";

export default async function PaginaGmail({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const configurado = gmailConfigurado();
  const cuenta = await cuentaConectada();
  const cabeceras = await headers();
  const host = cabeceras.get("x-forwarded-host") ?? cabeceras.get("host") ?? "localhost:3000";
  const protocolo = cabeceras.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const retorno = urlRetornoOAuth(`${protocolo}://${host}`);

  return (
    <div className="flex max-w-3xl flex-col gap-esp6">
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
        titulo="Gmail"
        subtitulo={
          <>
            Con Gmail conectado, «Reclamar impagadas» deja en tu bandeja un borrador con el estado de cuenta y las
          facturas vencidas ya adjuntas. Tú lo revisas y lo envías desde Gmail.
          </>
        }
      />

      {ok && (
        <p role="status" className="rounded-md border border-borde-exito bg-fondo-exito-sutil px-esp3 py-esp2 text-sm text-texto-exito">
          Gmail conectado correctamente.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md border border-borde-peligro bg-fondo-peligro-sutil px-esp3 py-esp2 text-sm text-texto-peligro">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-esp4 rounded-xl border border-borde-default bg-fondo-superficie px-esp5 py-esp5">
        <div className="flex flex-wrap items-center gap-esp3">
          <div className="min-w-0 flex-1">
            <h2 className="text-titulo-panel text-texto-primario">Cuenta conectada</h2>
            {cuenta ? (
              <p className="text-sm text-texto-secundario">
                <strong className="text-texto-primario">{cuenta.email}</strong> · desde el {fechaMedia(cuenta.conectadaEn)}
              </p>
            ) : (
              <p className="text-sm text-texto-secundario">Ninguna.</p>
            )}
          </div>
          {cuenta ? <Insignia tono="exito">Conectada</Insignia> : <Insignia tono="neutro">Sin conectar</Insignia>}
        </div>

        {configurado ? (
          <div className="flex flex-wrap gap-esp2">
            {/* Enlace normal (no <Link>): es una ruta del servidor que redirige a Google. */}
            <a
              href="/api/gmail/conectar"
              className="inline-flex h-11 items-center justify-center gap-esp2 rounded-md bg-fondo-marca px-esp4 text-sm font-medium text-texto-sobre-marca hover:bg-fondo-marca-hover md:h-9"
            >
              <Icono nombre="enviar" size={16} />
              {cuenta ? "Conectar otra cuenta" : "Conectar con Gmail"}
            </a>
            {cuenta && <BotonDesconectar email={cuenta.email} />}
          </div>
        ) : (
          <p className="rounded-md border border-borde-aviso bg-fondo-aviso-sutil px-esp3 py-esp2 text-sm text-texto-primario">
            Falta configurar el servidor: hay que definir <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>{" "}
            y <code>TOKENS_SECRET</code> (ver los pasos de abajo).
          </p>
        )}
        <p className="text-xs text-texto-terciario">
          La app solo pide permiso para <strong>crear borradores</strong>: no lee tu correo ni envía nada por su cuenta.
        </p>
      </section>

      <details className="rounded-xl border border-borde-default bg-fondo-superficie px-esp5 py-esp4 text-sm text-texto-secundario">
        <summary className="cursor-pointer font-medium text-texto-primario">Configuración inicial (una sola vez)</summary>
        <ol className="mt-esp3 flex list-decimal flex-col gap-esp2 pl-esp5">
          <li>
            En <strong>console.cloud.google.com</strong> crea un proyecto y activa la <strong>Gmail API</strong>.
          </li>
          <li>
            En «Pantalla de consentimiento de OAuth» elige tipo <strong>Externo</strong> (o Interno si usáis Google
            Workspace), añade el permiso <code>gmail.compose</code> y <strong>publica</strong> la app (si se queda «en
            pruebas», Google retira el permiso a los 7 días).
          </li>
          <li>
            En «Credenciales» crea un <strong>ID de cliente de OAuth</strong> de tipo «Aplicación web» con este URI de
            redireccionamiento autorizado:
            <code className="mt-1 block break-all rounded bg-fondo-sutil px-2 py-1 text-xs">{retorno}</code>
            (añade también el de producción, p. ej. <code>https://tu-dominio/api/gmail/retorno</code>).
          </li>
          <li>
            Copia el ID y el secreto en las variables <code>GOOGLE_CLIENT_ID</code> y <code>GOOGLE_CLIENT_SECRET</code>, define <code>TOKENS_SECRET</code> (32+ caracteres aleatorios, cifra el permiso guardado){" "}
            (en <code>.env.local</code> y en Vercel) y vuelve a desplegar.
          </li>
          <li>
            Pulsa «Conectar con Gmail». Como la app no está verificada por Google, verás un aviso: pulsa «Configuración
            avanzada» → «Ir a …» para continuar.
          </li>
        </ol>
      </details>
    </div>
  );
}
