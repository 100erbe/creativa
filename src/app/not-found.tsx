import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function NoEncontrado() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-esp5 bg-fondo-lienzo px-esp4 text-center">
      <Logo alto={44} />
      <div className="flex flex-col gap-esp2">
        <h1 className="text-xl font-semibold text-texto-primario">No hemos encontrado esta página</h1>
        <p className="max-w-sm text-sm text-texto-secundario">
          El enlace puede haber caducado o la dirección no es correcta. Si te lo envió Creativa, pídenos uno nuevo.
        </p>
      </div>
      <Link href="/entrar" className="text-sm font-medium text-texto-marca">
        Ir al inicio
      </Link>
    </main>
  );
}
