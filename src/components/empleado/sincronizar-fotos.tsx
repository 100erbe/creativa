"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { avisar } from "@/components/ui/dialogos";
import { contarPendientes, EVENTO_COLA } from "@/lib/cola-fotos";
import { sincronizarColaFotos } from "@/lib/sincronizar-cola-fotos";

/**
 * Envía las fotos que se hicieron sin cobertura. Se intenta al abrir la app, al volver la conexión
 * y cada minuto mientras queden. Muestra un aviso mientras haya fotos sin enviar.
 */
export function SincronizarFotos() {
  const router = useRouter();
  const [pendientes, setPendientes] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const ocupado = useRef(false);

  const vaciar = useCallback(async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    setEnviando(true);
    try {
      const { enviadas, pendientes: restantes, descartada } = await sincronizarColaFotos();
      setPendientes(restantes);
      if (enviadas > 0) router.refresh();
      if (descartada) {
        void avisar(`Una foto guardada sin conexión no se pudo enviar y se ha descartado: ${descartada}`);
      }
    } finally {
      ocupado.current = false;
      setEnviando(false);
    }
  }, [router]);

  useEffect(() => {
    const actualizar = () => void contarPendientes().then(setPendientes);
    actualizar();
    void vaciar();
    const alVolverLaRed = () => void vaciar();
    const alEncolar = () => {
      actualizar();
    };
    window.addEventListener("online", alVolverLaRed);
    window.addEventListener(EVENTO_COLA, alEncolar);
    const reintento = setInterval(() => void vaciar(), 60_000);
    return () => {
      window.removeEventListener("online", alVolverLaRed);
      window.removeEventListener(EVENTO_COLA, alEncolar);
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
          ? "Enviando fotos guardadas…"
          : `${pendientes} foto${pendientes === 1 ? "" : "s"} guardada${pendientes === 1 ? "" : "s"} en el móvil, pendiente${pendientes === 1 ? "" : "s"} de enviar. Se enviarán solas cuando haya cobertura.`}
      </span>
      {!enviando && (
        <button onClick={() => void vaciar()} className="shrink-0 font-semibold text-texto-marca">
          Reintentar
        </button>
      )}
    </div>
  );
}
