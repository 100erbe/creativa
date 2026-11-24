"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { avisar } from "@/components/ui/dialogos";
import { contarGastosPendientes, EVENTO_COLA_GASTOS, sincronizarColaGastos } from "@/lib/cola-gastos";

/**
 * Envía los gastos que se guardaron en el móvil sin conexión. Se intenta al abrir la app, al volver
 * la conexión y cada minuto mientras queden. Muestra un aviso mientras haya gastos sin enviar.
 */
export function SincronizarGastos() {
  const router = useRouter();
  const [pendientes, setPendientes] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const ocupado = useRef(false);

  const vaciar = useCallback(async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    setEnviando(true);
    try {
      const { enviados, pendientes: restantes, descartado } = await sincronizarColaGastos();
      setPendientes(restantes);
      if (enviados > 0) router.refresh();
      if (descartado) void avisar(`Un gasto guardado en el móvil no se pudo enviar: ${descartado}`);
    } finally {
      ocupado.current = false;
      setEnviando(false);
    }
  }, [router]);

  useEffect(() => {
    const actualizar = () => void contarGastosPendientes().then(setPendientes);
    actualizar();
    void vaciar();
    const alVolverLaRed = () => void vaciar();
    window.addEventListener("online", alVolverLaRed);
    window.addEventListener(EVENTO_COLA_GASTOS, actualizar);
    const reintento = setInterval(() => void vaciar(), 60_000);
    return () => {
      window.removeEventListener("online", alVolverLaRed);
      window.removeEventListener(EVENTO_COLA_GASTOS, actualizar);
      clearInterval(reintento);
    };
  }, [vaciar]);

  if (pendientes === 0) return null;

  return (
    <div
      role="status"
      className="mx-esp4 mt-esp3 flex items-center gap-esp3 rounded-md border border-borde-aviso bg-fondo-aviso-sutil px-esp3 py-esp2 text-xs text-texto-primario"
    >
      <Icono nombre="camara" size={16} className="text-texto-aviso" />
      <span className="min-w-0 flex-1">
        {enviando
          ? "Enviando gastos guardados…"
          : `${pendientes} gasto${pendientes === 1 ? "" : "s"} guardado${pendientes === 1 ? "" : "s"} en el móvil, pendiente${pendientes === 1 ? "" : "s"} de enviar. Se enviará${pendientes === 1 ? "" : "n"} solo${pendientes === 1 ? "" : "s"} cuando haya conexión.`}
      </span>
      {!enviando && (
        <button onClick={() => void vaciar()} className="shrink-0 font-semibold text-texto-marca">
          Reintentar
        </button>
      )}
    </div>
  );
}
