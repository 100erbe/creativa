"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DEBOUNCE_REALTIME_MS = 400;
const DEBOUNCE_FOCO_MS = 150;
const COOLDOWN_MS = 1200;

/**
 * Sincronizador en vivo (Nivel A + Nivel B):
 * - Nivel A: refresca el Server Component actual al volver a la pestaña/app, recuperar red o recibir un push del SW.
 * - Nivel B: abre un único canal WebSocket de Supabase Realtime filtrado por RLS para este usuario y refresca
 *   automáticamente cuando cambian notificaciones, avisos, campañas, puntos, asignaciones, fotos o gastos.
 */
export function SincronizadorVivo({
  usuarioId,
  esAdmin,
}: {
  usuarioId: string;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimoRefrescoRef = useRef(0);
  const pendienteAlVolverRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    function programarRefresco(delayMs: number) {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        pendienteAlVolverRef.current = true;
        return;
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;

      const ahora = Date.now();
      const restanteCooldown = Math.max(0, COOLDOWN_MS - (ahora - ultimoRefrescoRef.current));
      const espera = Math.max(delayMs, restanteCooldown);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (document.visibilityState !== "visible") {
          pendienteAlVolverRef.current = true;
          return;
        }
        ultimoRefrescoRef.current = Date.now();
        pendienteAlVolverRef.current = false;
        router.refresh();
      }, espera);
    }

    function alCambio(tabla: string) {
      if (tabla === "notificaciones") {
        window.dispatchEvent(new CustomEvent("creativa:notificacion"));
      }
      programarRefresco(DEBOUNCE_REALTIME_MS);
    }

    const canal = supabase.channel(`vivo:${usuarioId}`);

    canal
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificaciones", filter: `usuario_id=eq.${usuarioId}` },
        () => alCambio("notificaciones"),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "avisos_destinatarios", filter: `usuario_id=eq.${usuarioId}` },
        () => alCambio("avisos_destinatarios"),
      );

    if (esAdmin) {
      for (const tabla of [
        "campanas",
        "puntos_campana",
        "asignaciones_punto",
        "fotos_punto",
        "gastos",
        "documentos",
        "cobros",
      ] as const) {
        canal.on("postgres_changes", { event: "*", schema: "public", table: tabla }, () => alCambio(tabla));
      }
    } else {
      canal
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "asignaciones_punto", filter: `usuario_id=eq.${usuarioId}` },
          () => alCambio("asignaciones_punto"),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "gastos", filter: `usuario_id=eq.${usuarioId}` },
          () => alCambio("gastos"),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "fotos_punto", filter: `usuario_id=eq.${usuarioId}` },
          () => alCambio("fotos_punto"),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "puntos_campana" },
          () => alCambio("puntos_campana"),
        );
    }

    canal.subscribe();

    // Nivel A: volver a la pestaña / PWA, foco, reconexión o push del Service Worker
    const alVolverVisibilidad = () => {
      if (document.visibilityState === "visible") {
        pendienteAlVolverRef.current = false;
        programarRefresco(DEBOUNCE_FOCO_MS);
      }
    };
    const alFoco = () => programarRefresco(DEBOUNCE_FOCO_MS);
    const alOnline = () => programarRefresco(DEBOUNCE_FOCO_MS);
    const alMensajeSw = (e: MessageEvent) => {
      if (e.data?.tipo === "aviso-nuevo") {
        window.dispatchEvent(new CustomEvent("creativa:notificacion"));
        programarRefresco(DEBOUNCE_FOCO_MS);
      }
    };

    document.addEventListener("visibilitychange", alVolverVisibilidad);
    window.addEventListener("focus", alFoco);
    window.addEventListener("online", alOnline);
    navigator.serviceWorker?.addEventListener("message", alMensajeSw);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", alVolverVisibilidad);
      window.removeEventListener("focus", alFoco);
      window.removeEventListener("online", alOnline);
      navigator.serviceWorker?.removeEventListener("message", alMensajeSw);
      void supabase.removeChannel(canal);
    };
  }, [usuarioId, esAdmin, router]);

  return null;
}
