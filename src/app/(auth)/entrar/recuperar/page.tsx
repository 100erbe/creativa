import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { FormularioRecuperar } from "./formulario-recuperar";

export default async function PaginaRecuperar({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-fondo-lienzo px-esp4">
      <div className="flex w-full max-w-sm flex-col gap-esp6">
        <div className="flex flex-col items-center gap-esp3">
          <Logo alto={48} />
          <h1 className="text-lg font-semibold text-texto-primario">¿Has olvidado tu contraseña?</h1>
          <p className="text-center text-sm text-texto-secundario">
            Escribe tu correo y te enviaremos un enlace para elegir una nueva.
          </p>
        </div>
        <FormularioRecuperar enlaceCaducado={error === "enlace"} />
        <Link href="/entrar" className="text-center text-sm font-medium text-texto-marca">
          Volver a entrar
        </Link>
      </div>
    </main>
  );
}
