"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { avisar } from "@/components/ui/dialogos";
import { desenvolver } from "@/lib/accion";
import {
  borrarPendiente,
  contarPendientes,
  esErrorDeRed,
  EVENTO_COLA,
  listarPendientes,
  marcarRechazo,
} from "@/lib/cola-fotos";
import { subirFotoPunto } from "@/app/(empleado)/app/punto/[id]/acciones";

const MAX_RECHAZOS = 3;

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
      let enviadas = 0;
      let descartada: string | null = null;
      for (const foto of await listarPendientes()) {
        const datos = new FormData();
        for (const [clave, valor] of Object.entries(foto.campos)) datos.set(clave, valor);
        datos.set("archivo", new File([foto.archivo], foto.nombre, { type: foto.archivo.type }));
        try {
          await desenvolver(subirFotoPunto(datos));
          if (foto.id != null) await borrarPendiente(foto.id);
          enviadas++;
        } catch (e) {
          // Sin cobertura o sesión caducada: no es culpa de la foto, se reintenta luego.
          if (esErrorDeRed(e) || (e instanceof Error && /sesi[oó]n/i.test(e.message))) break;
          if (foto.rechazos + 1 >= MAX_RECHAZOS) {
            if (foto.id != null) await borrarPendiente(foto.id);
            descartada = e instanceof Error ? e.message : "error desconocido";
          } else {
            await marcarRechazo(foto);
          }
        }
      }
      setPendientes(await contarPendientes());
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
