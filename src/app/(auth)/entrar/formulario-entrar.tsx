"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";

export function FormularioEntrar({
  cuentaInactiva,
  volver,
}: {
  cuentaInactiva: boolean;
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

    router.push(volver ?? "/entrar");
    router.refresh();
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
    </form>
  );
}
