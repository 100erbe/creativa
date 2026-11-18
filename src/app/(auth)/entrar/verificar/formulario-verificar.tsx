"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { createClient } from "@/lib/supabase/client";

export function FormularioVerificar({ volver }: { volver: string }) {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const supabase = createClient();
    const { data: factores } = await supabase.auth.mfa.listFactors();
    const factor = factores?.totp.find((f) => f.status === "verified");
    if (!factor) {
      setError("No hay ninguna app de autenticación configurada en esta cuenta.");
      setCargando(false);
      return;
    }
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: codigo.trim() });
    if (err) {
      setError("El código no es correcto o ha caducado. Escribe el que aparece ahora en la app.");
      setCodigo("");
      setCargando(false);
      return;
    }
    router.push(volver);
    router.refresh();
  }

  async function salir() {
    setCargando(true);
    await createClient().auth.signOut();
    router.push("/entrar");
    router.refresh();
  }

  return (
    <form onSubmit={verificar} className="flex flex-col gap-esp4">
      {error && (
        <p role="alert" className="rounded-lg bg-fondo-peligro-sutil px-esp4 py-esp3 text-meta font-medium text-texto-peligro">
          {error}
        </p>
      )}
      <Campo
        etiqueta="Código de verificación"
        valor={codigo}
        onCambio={(v) => setCodigo(v.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoCompletar="one-time-code"
        maxLength={6}
        placeholder="123456"
        autoFocus
        requerido
      />
      <Boton type="submit" cargando={cargando} disabled={codigo.length !== 6} className="w-full">
        Verificar y entrar
      </Boton>
      <Boton type="button" variante="fantasma" onClick={salir} className="w-full">
        Entrar con otra cuenta
      </Boton>
      <p className="text-center text-etiqueta text-texto-secundario">
        ¿Has perdido el móvil con la app? Pide a la administración del sistema que desactive la verificación de tu
        cuenta.
      </p>
    </form>
  );
}
