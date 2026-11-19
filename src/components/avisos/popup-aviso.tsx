"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import { desenvolver } from "@/lib/accion";
import { consultarUltimoAviso, marcarLeida } from "@/lib/push/acciones";
import type { NotificacionBandeja } from "@/components/avisos/bandeja";

/** Cuánto se queda visible (con texto que leer, 8 s es el mínimo cómodo) y cada cuánto se comprueba si hay avisos. */
const DURACION_MS = 8000;
const SONDEO_MS = 30_000;
const SALIDA_MS = 200;
const CLAVE_ULTIMO = "creativa.popup.ultimo";

/**
 * Popup de escritorio para el último aviso recibido (abajo a la derecha). Complementa al contador y a la
 * bandeja de la campana: no los sustituye. Llega al instante cuando el service worker avisa de un push y,
 * como respaldo, comprobando cada 30 s mientras la pestaña está visible.
 *
 * Buenas prácticas: no roba el foco, se anuncia con `role="status"`, se pausa con el ratón o el teclado encima,
 * se puede cerrar, muestra solo el último aviso (no se apilan) y respeta "reducir movimiento".
 */
export function PopupAviso() {
  const router = useRouter();
  const [aviso, setAviso] = useState<NotificacionBandeja | null>(null);
  const [visible, setVisible] = useState(false); // controla la transición de entrada/salida
  const [pausado, setPausado] = useState(false);
  const ultimoVisto = useRef<number | null>(null); // null = aún no se ha mirado cuál era el último al entrar
  const consultando = useRef(false);

  const cerrar = useCallback(() => {
    setVisible(false);
    setTimeout(() => setAviso(null), SALIDA_MS);
  }, []);

  const comprobar = useCallback(async () => {
    if (consultando.current) return;
    consultando.current = true;
    try {
      const { ultimo } = await desenvolver(consultarUltimoAviso());
      if (ultimoVisto.current === null) {
        // Primera lectura al abrir la app: se parte del último aviso ya mostrado en este navegador, así que
        // un aviso sin leer que llegó mientras no estabas también se enseña (una sola vez).
        let guardado = 0;
        try {
          guardado = Number(localStorage.getItem(CLAVE_ULTIMO) ?? 0) || 0;
        } catch {
          /* sin almacenamiento: se parte de cero */
        }
        ultimoVisto.current = guardado;
      }
      if (ultimo && ultimo.id > ultimoVisto.current) {
        ultimoVisto.current = ultimo.id;
        try {
          localStorage.setItem(CLAVE_ULTIMO, String(ultimo.id));
        } catch {
          /* ignorar */
        }
        if (!ultimo.leida) {
          setAviso(ultimo);
          setPausado(false);
          requestAnimationFrame(() => setVisible(true));
        }
        router.refresh(); // actualiza el contador de la barra
      }
    } catch {
      /* sin red o sesión caducada: se reintenta en el siguiente ciclo */
    } finally {
      consultando.current = false;
    }
  }, [router]);

  // Línea base al entrar, sondeo, eventos Realtime y avisos del service worker.
  useEffect(() => {
    void comprobar();
    const cadaCuanto = setInterval(() => document.visibilityState === "visible" && void comprobar(), SONDEO_MS);
    const alVolver = () => document.visibilityState === "visible" && void comprobar();
    const alMensaje = (e: MessageEvent) => e.data?.tipo === "aviso-nuevo" && void comprobar();
    const alRealtime = () => void comprobar();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("creativa:notificacion", alRealtime);
    navigator.serviceWorker?.addEventListener("message", alMensaje);
    return () => {
      clearInterval(cadaCuanto);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("creativa:notificacion", alRealtime);
      navigator.serviceWorker?.removeEventListener("message", alMensaje);
    };
  }, [comprobar]);

  // Se cierra solo; el reloj se reinicia (completo) cada vez que se retira el ratón.
  useEffect(() => {
    if (!aviso || pausado) return;
    const t = setTimeout(cerrar, DURACION_MS);
    return () => clearTimeout(t);
  }, [aviso, pausado, cerrar]);

  if (!aviso) return null;

  function abrir() {
    if (!aviso) return;
    void desenvolver(marcarLeida(aviso.id))
      .then(() => router.refresh())
      .catch(() => {});
    router.push(aviso.url ?? "/admin/avisos");
    cerrar();
  }

  // Portal en <body>: la cabecera y el mapa (Leaflet, z-index hasta 1000) no deben taparlo ni recortarlo.
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      className={
        "pointer-events-none fixed bottom-esp5 right-esp5 z-[3100] hidden w-[360px] md:block " +
        "transition-[opacity,transform] duration-media ease-salida motion-reduce:transition-none " +
        (visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0 motion-reduce:translate-y-0")
      }
    >
      <div className="pointer-events-auto relative flex items-start gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie p-esp4 pr-esp8 shadow-elevado">
        <button
          onClick={abrir}
          className="flex min-w-0 flex-1 items-start gap-esp3 rounded-md text-left outline-offset-4"
          aria-label={`Abrir aviso: ${aviso.titulo}`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fondo-marca-sutil">
            <Icono nombre="avisos" size={18} className="text-icono-marca" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-texto-primario">{aviso.titulo}</span>
            <span className="line-clamp-2 block text-sm text-texto-secundario">{aviso.cuerpo}</span>
            <span className="mt-1 block text-xs text-texto-terciario">{aviso.creada}</span>
          </span>
        </button>
        <button
          onClick={cerrar}
          aria-label="Cerrar aviso"
          className="absolute right-esp2 top-esp2 flex h-8 w-8 items-center justify-center rounded-md text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
        >
          <Icono nombre="cerrar" size={16} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
