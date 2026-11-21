"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { Insignia } from "@/components/ui/insignia";
import { contarPendientes, EVENTO_COLA } from "@/lib/cola-fotos";
import { sincronizarColaFotos } from "@/lib/sincronizar-cola-fotos";

/**
 * Estado de la cola de fotos guardadas sin conexión en este dispositivo (IndexedDB),
 * con comprobación de red y envío manual.
 */
export function PanelFotosOffline() {
  const router = useRouter();
  const [pendientes, setPendientes] = useState<number | null>(null);
  const [enLinea, setEnLinea] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  const refrescar = useCallback(async () => {
    setPendientes(await contarPendientes());
  }, []);

  useEffect(() => {
    setEnLinea(typeof navigator === "undefined" ? true : navigator.onLine);
    void refrescar();

    const alOnline = () => setEnLinea(true);
    const alOffline = () => setEnLinea(false);
    const alCambiarCola = () => void refrescar();

    window.addEventListener("online", alOnline);
    window.addEventListener("offline", alOffline);
    window.addEventListener(EVENTO_COLA, alCambiarCola);
    return () => {
      window.removeEventListener("online", alOnline);
      window.removeEventListener("offline", alOffline);
      window.removeEventListener(EVENTO_COLA, alCambiarCola);
    };
  }, [refrescar]);

  async function sincronizarAhora() {
    setEnviando(true);
    setMensaje(null);
    try {
      const { enviadas, pendientes: restantes, descartada } = await sincronizarColaFotos();
      setPendientes(restantes);
      if (enviadas > 0) router.refresh();

      if (descartada) {
        setMensaje({
          tono: "error",
          texto: `Una foto no se pudo subir y se descartó tras varios intentos: ${descartada}`,
        });
      } else if (enviadas > 0 && restantes === 0) {
        setMensaje({
          tono: "ok",
          texto:
            enviadas === 1
              ? "Se envió la foto pendiente. Todo está al día."
              : `Se enviaron ${enviadas} fotos pendientes. Todo está al día.`,
        });
      } else if (restantes > 0) {
        setMensaje({
          tono: "error",
          texto:
            enviadas > 0
              ? `Se enviaron ${enviadas}, pero todavía quedan ${restantes} sin subir. Comprueba la cobertura.`
              : "No se pudieron enviar ahora. Se reintentará automáticamente al recuperar cobertura.",
        });
      } else {
        setMensaje({ tono: "ok", texto: "No hay fotos pendientes en este dispositivo." });
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section
      aria-labelledby="titulo-fotos-offline"
      className="flex flex-col gap-esp4 rounded-xl border border-borde-default bg-fondo-superficie px-esp5 py-esp5"
    >
      <div className="flex items-center gap-esp3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fondo-marca-sutil">
          <Icono nombre="camara" size={20} className="text-icono-marca" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="titulo-fotos-offline" className="text-titulo-panel text-texto-primario">
            Fotos sin conexión
          </h2>
          <p className="text-xs text-texto-terciario">
            {pendientes === null
              ? "Comprobando cola del dispositivo…"
              : pendientes === 0
                ? "Todo enviado"
                : `${pendientes} foto${pendientes === 1 ? "" : "s"} pendiente${pendientes === 1 ? "" : "s"} de enviar`}
          </p>
        </div>
        <Insignia tono={enLinea ? "exito" : "aviso"}>
          {enLinea ? "Con conexión" : "Sin conexión"}
        </Insignia>
      </div>

      <p className="text-sm text-texto-secundario">
        Si haces fotos en una zona sin cobertura, se guardan en este dispositivo y se suben solas cuando vuelve la red.
      </p>

      {pendientes !== null && pendientes > 0 && (
        <div className="flex flex-wrap items-center gap-esp2">
          <Boton
            variante="secundario"
            className="min-h-11"
            cargando={enviando}
            disabled={!enLinea}
            onClick={() => void sincronizarAhora()}
          >
            Sincronizar ahora
          </Boton>
          {!enLinea && (
            <span className="text-xs text-texto-secundario">Necesitas conexión para enviarlas.</span>
          )}
        </div>
      )}

      {mensaje && (
        <p
          role="status"
          className={
            mensaje.tono === "ok"
              ? "animate-estado-entrar text-sm text-texto-exito"
              : "animate-estado-entrar text-sm text-texto-peligro"
          }
        >
          {mensaje.texto}
        </p>
      )}
    </section>
  );
}
