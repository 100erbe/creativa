import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Boton } from "@/components/ui/boton";

/**
 * Paso intermedio del enlace de recuperación: el enlace solo se canjea al pulsar «Continuar»
 * (POST a /auth/confirmar). Los antivirus y vistas previas del correo abren los enlaces con GET
 * y, sin este paso, gastarían el enlace antes que la persona.
 */
export default async function PaginaContinuarRecuperacion({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; token_hash?: string; type?: string; sb_flow_id?: string }>;
}) {
  const { code, token_hash: tokenHash, type, sb_flow_id: flujo } = await searchParams;
  const valido = Boolean(code || (tokenHash && type === "recovery"));

  return (
    <main className="flex min-h-dvh items-center justify-center bg-fondo-lienzo px-esp4">
      <div className="flex w-full max-w-sm flex-col gap-esp6">
        <div className="flex flex-col items-center gap-esp3">
          <Logo alto={48} />
          <h1 className="text-titulo-panel text-texto-primario">Elegir una contraseña nueva</h1>
          <p className="text-center text-sm text-texto-secundario">
            {valido
              ? "Pulsa «Continuar» para confirmar que eres tú y elegir tu nueva contraseña."
              : "El enlace no es válido o está incompleto. Pide uno nuevo."}
          </p>
        </div>
        {valido ? (
          <form method="post" action="/auth/confirmar" className="flex flex-col">
            {code && <input type="hidden" name="code" value={code} />}
            {tokenHash && <input type="hidden" name="token_hash" value={tokenHash} />}
            {type && <input type="hidden" name="type" value={type} />}
            {flujo && <input type="hidden" name="sb_flow_id" value={flujo} />}
            <Boton type="submit">Continuar</Boton>
          </form>
        ) : (
          <Link href="/entrar/recuperar" className="text-center text-sm font-medium text-texto-marca">
            Pedir un enlace nuevo
          </Link>
        )}
        <Link href="/entrar" className="text-center text-sm font-medium text-texto-marca">
          Volver a entrar
        </Link>
      </div>
    </main>
  );
}
