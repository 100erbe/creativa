"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";

export function FormularioEntrar({
  cuentaInactiva,
  sesionAbierta = false,
  volver,
}: {
  cuentaInactiva: boolean;
  /** Hay una sesión iniciada pero sin acceso: se ofrece cerrarla en vez del formulario. */
  sesionAbierta?: boolean;
  volver?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);

    const { error: errorAuth } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (errorAuth) {
      setError("Correo o contraseña incorrectos.");
      setCargando(false);
      return;
    }

    // /entrar reparte según el rol; `volver` ya llega validado desde el servidor.
    router.push(volver || "/entrar");
    router.refresh();
  }

  async function cerrarSesion() {
    setCargando(true);
    await supabase.auth.signOut();
    router.push("/entrar");
    router.refresh();
  }

  if (sesionAbierta) {
    return (
      <div className="flex flex-col gap-esp4">
        <p className="rounded-md border border-borde-peligro-sutil bg-fondo-peligro-sutil px-esp3 py-esp2 text-sm text-texto-peligro">
          Esta cuenta no tiene acceso a Creativa (está desactivada o no tiene perfil). Contacta con tu
          administrador o entra con otra cuenta.
        </p>
        <Boton variante="secundario" cargando={cargando} onClick={cerrarSesion} className="w-full">
          Cerrar sesión
        </Boton>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-esp4">
      {cuentaInactiva && (
        <p className="rounded-md border border-borde-peligro-sutil bg-fondo-peligro-sutil px-esp3 py-esp2 text-sm text-texto-peligro">
          Esta cuenta está desactivada. Contacta con tu administrador.
        </p>
      )}
      {error && (
        <p className="rounded-md border border-borde-peligro-sutil bg-fondo-peligro-sutil px-esp3 py-esp2 text-sm text-texto-peligro">
          {error}
        </p>
      )}
      <Campo
        etiqueta="Correo electrónico"
        tipo="email"
        valor={email}
        onCambio={setEmail}
        autoFocus
        requerido
      />
      <Campo
        etiqueta="Contraseña"
        tipo="password"
        valor={password}
        onCambio={setPassword}
        requerido
      />
      <Boton type="submit" cargando={cargando} className="mt-esp2 w-full">
        Entrar
      </Boton>
      <Link href="/entrar/recuperar" className="text-center text-sm font-medium text-texto-marca">
        He olvidado mi contraseña
      </Link>
    </form>
  );
}
