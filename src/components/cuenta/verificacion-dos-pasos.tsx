"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { confirmar } from "@/components/ui/dialogos";
import { createClient } from "@/lib/supabase/client";

// Verificación en dos pasos con app de autenticación (TOTP de Supabase Auth: Google Authenticator,
// Microsoft Authenticator, 1Password…). Una vez activada, el middleware pide el código de 6 cifras
// después de la contraseña en cada inicio de sesión (nivel AAL2).

type Factor = { id: string; friendly_name?: string | null; status: string; created_at: string };
type Alta = { factorId: string; qr: string; secreto: string };

export function VerificacionDosPasos() {
  const router = useRouter();
  const [factores, setFactores] = useState<Factor[] | null>(null);
  const [alta, setAlta] = useState<Alta | null>(null);
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data, error: e } = await createClient().auth.mfa.listFactors();
    if (e) {
      setError("No se ha podido consultar la verificación en dos pasos.");
      setFactores([]);
      return;
    }
    setFactores((data?.totp ?? []) as Factor[]);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const activo = factores?.find((f) => f.status === "verified");

  async function empezar() {
    setError(null);
    setMensaje(null);
    setCargando(true);
    const supabase = createClient();
    // Restos de un alta que no se terminó: se limpian para empezar de cero.
    for (const f of factores ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error: e } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Creativa ${new Date().toLocaleDateString("es-ES")}`,
    });
    setCargando(false);
    if (e || !data) {
      setError("No se ha podido iniciar la activación. Inténtalo de nuevo.");
      return;
    }
    setAlta({ factorId: data.id, qr: data.totp.qr_code, secreto: data.totp.secret });
  }

  async function confirmarAlta(e: React.FormEvent) {
    e.preventDefault();
    if (!alta) return;
    setError(null);
    setCargando(true);
    const { error: err } = await createClient().auth.mfa.challengeAndVerify({ factorId: alta.factorId, code: codigo.trim() });
    setCargando(false);
    if (err) {
      setError("El código no es correcto o ha caducado. Escribe el que aparece ahora en la app.");
      return;
    }
    setAlta(null);
    setCodigo("");
    setMensaje("Verificación en dos pasos activada. A partir de ahora te pediremos el código al entrar.");
    await cargar();
    router.refresh();
  }

  async function cancelarAlta() {
    if (alta) await createClient().auth.mfa.unenroll({ factorId: alta.factorId });
    setAlta(null);
    setCodigo("");
    setError(null);
  }

  async function desactivar() {
    if (!activo) return;
    const ok = await confirmar(
      "¿Desactivar la verificación en dos pasos? Tu cuenta de administración quedará protegida solo con la contraseña.",
      { aceptar: "Desactivar", peligro: true },
    );
    if (!ok) return;
    setError(null);
    setCargando(true);
    const { error: err } = await createClient().auth.mfa.unenroll({ factorId: activo.id });
    setCargando(false);
    if (err) {
      setError("No se ha podido desactivar. Vuelve a entrar con tu código y prueba de nuevo.");
      return;
    }
    setMensaje("Verificación en dos pasos desactivada.");
    await cargar();
    router.refresh();
  }

  if (factores === null) return <p className="text-cuerpo text-texto-secundario">Comprobando…</p>;

  return (
    <div className="flex flex-col gap-esp4">
      <div className="flex flex-wrap items-center gap-esp3">
        <Insignia tono={activo ? "exito" : "aviso"}>{activo ? "Activada" : "Desactivada"}</Insignia>
        <p className="min-w-0 flex-1 text-cuerpo text-texto-secundario">
          {activo
            ? `Desde el ${new Date(activo.created_at).toLocaleDateString("es-ES")}. Al entrar se pide la contraseña y un código de 6 cifras.`
            : "Recomendada para administración: además de la contraseña, se pide un código de la app de autenticación del móvil."}
        </p>
        {!alta &&
          (activo ? (
            <Boton variante="secundario" cargando={cargando} onClick={desactivar}>
              Desactivar
            </Boton>
          ) : (
            <Boton cargando={cargando} onClick={empezar}>
              Activar
            </Boton>
          ))}
      </div>

      {alta && (
        <form onSubmit={confirmarAlta} className="flex flex-col gap-esp4 rounded-lg bg-fondo-sutil p-esp4 md:flex-row md:items-start md:gap-esp6">
          {/* El QR lo genera Supabase como imagen SVG en data URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={alta.qr} alt="Código QR para la app de autenticación" className="h-44 w-44 shrink-0 self-center rounded-lg bg-fondo-superficie p-esp2" />
          <div className="flex min-w-0 flex-1 flex-col gap-esp3">
            <ol className="flex list-decimal flex-col gap-esp1 pl-esp5 text-cuerpo text-texto-primario">
              <li>Abre tu app de autenticación (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
              <li>Escanea el código QR. Si no puedes, escribe esta clave:</li>
            </ol>
            <code className="break-all rounded-md bg-fondo-superficie px-esp3 py-esp2 font-mono text-meta text-texto-primario">
              {alta.secreto}
            </code>
            <Campo
              etiqueta="Código de 6 cifras que muestra la app"
              valor={codigo}
              onCambio={(v) => setCodigo(v.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoCompletar="one-time-code"
              maxLength={6}
              autoFocus
              requerido
            />
            <div className="flex flex-wrap gap-esp2">
              <Boton type="submit" cargando={cargando} disabled={codigo.length !== 6}>
                Confirmar y activar
              </Boton>
              <Boton type="button" variante="fantasma" onClick={cancelarAlta}>
                Cancelar
              </Boton>
            </div>
          </div>
        </form>
      )}

      {mensaje && (
        <p role="status" className="animate-estado-entrar text-etiqueta text-texto-exito">
          {mensaje}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-fondo-peligro-sutil px-esp4 py-esp3 text-meta font-medium text-texto-peligro">
          {error}
        </p>
      )}
    </div>
  );
}
