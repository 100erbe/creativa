"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { desenvolver } from "@/lib/accion";
import { enviarPrueba } from "@/lib/push/acciones";
import {
  activarAvisos,
  desactivarAvisos,
  estadoAvisos,
  registrarServiceWorker,
  sincronizarSuscripcion,
  type EstadoAvisos,
} from "@/lib/push/cliente";

/**
 * Se monta una vez en cada layout: registra el service worker y, si los avisos ya estaban activados,
 * vuelve a registrar la suscripción (el navegador puede renovarla sin avisar).
 */
export function IniciarAvisos() {
  useEffect(() => {
    void registrarServiceWorker().then(() => sincronizarSuscripcion());
    const alMensaje = (e: MessageEvent) => {
      if (e.data?.tipo === "resuscribir") void sincronizarSuscripcion();
    };
    navigator.serviceWorker?.addEventListener("message", alMensaje);
    return () => navigator.serviceWorker?.removeEventListener("message", alMensaje);
  }, []);
  return null;
}

function useEstadoAvisos() {
  const [estado, setEstado] = useState<EstadoAvisos>("cargando");
  const refrescar = useCallback(async () => setEstado(await estadoAvisos()), []);
  useEffect(() => {
    void refrescar();
  }, [refrescar]);
  return { estado, refrescar };
}

/** Pasos para instalar la app en el iPhone (los avisos solo funcionan instalada). */
function PasosIphone() {
  return (
    <ol className="list-decimal space-y-1 pl-esp5 text-sm text-texto-secundario">
      <li>
        Abre esta página en <strong>Safari</strong>.
      </li>
      <li>
        Toca el botón <strong>Compartir</strong> (el cuadrado con la flecha).
      </li>
      <li>
        Elige <strong>«Añadir a pantalla de inicio»</strong>.
      </li>
      <li>Abre Creativa desde el icono nuevo e inicia sesión. Entonces podrás activar los avisos.</li>
    </ol>
  );
}

/** Tarjeta completa: estado de los avisos en este dispositivo, activar, probar y desactivar. */
export function PanelAvisos() {
  const { estado, refrescar } = useEstadoAvisos();
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  async function ejecutar(fn: () => Promise<string | void>) {
    setTrabajando(true);
    setMensaje(null);
    try {
      const texto = await fn();
      if (texto) setMensaje({ tono: "ok", texto });
    } catch (e) {
      setMensaje({ tono: "error", texto: e instanceof Error ? e.message : "No se pudo completar la acción." });
    } finally {
      await refrescar();
      setTrabajando(false);
    }
  }

  const probar = () =>
    ejecutar(async () => {
      const r = await desenvolver(enviarPrueba());
      if (r.omitido) throw new Error(r.omitido);
      if (r.dispositivos === 0) throw new Error("Este dispositivo no está registrado todavía. Vuelve a activar los avisos.");
      if (r.enviadas === 0) throw new Error("El servicio de avisos no ha aceptado la prueba. Inténtalo de nuevo en un momento.");
      return "Prueba enviada. Debería llegarte en unos segundos; si tienes la app abierta, cierra o minimízala para verla.";
    });

  return (
    <div className="flex flex-col gap-esp4 rounded-xl border border-borde-default bg-fondo-superficie px-esp5 py-esp5">
      <div className="flex items-center gap-esp3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fondo-marca-sutil">
          <Icono nombre="avisos" size={20} className="text-icono-marca" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-titulo-panel text-texto-primario">Avisos en este dispositivo</h2>
          <p className="text-xs text-texto-terciario">
            {estado === "activo" ? "Activados" : estado === "cargando" ? "Comprobando…" : "Desactivados"}
          </p>
        </div>
      </div>

      {estado === "ios-sin-instalar" && (
        <>
          <p className="text-sm text-texto-primario">
            En el iPhone los avisos solo funcionan con Creativa instalada como app. Es un minuto:
          </p>
          <PasosIphone />
        </>
      )}

      {estado === "no-soportado" && (
        <p className="text-sm text-texto-secundario">
          Este navegador no admite avisos. Prueba con Chrome en Android, o con la app instalada en iPhone (iOS 16.4 o
          superior).
        </p>
      )}

      {estado === "sin-configurar" && (
        <p className="text-sm text-texto-peligro">
          Los avisos todavía no están configurados en el servidor. Avisa a quien administra la app.
        </p>
      )}

      {estado === "bloqueado" && (
        <p className="text-sm text-texto-secundario">
          Has bloqueado los avisos de Creativa. Para recibirlos, actívalos en los ajustes del móvil (Notificaciones →
          Creativa o Chrome) y vuelve aquí.
        </p>
      )}

      {estado === "inactivo" && (
        <>
          <p className="text-sm text-texto-secundario">
            Recibirás aquí el trabajo del día siguiente, los cambios de plan y los avisos urgentes, aunque tengas la app
            cerrada.
          </p>
          <Boton className="min-h-11 w-full sm:w-fit" cargando={trabajando} onClick={() => ejecutar(activarAvisos)}>
            Activar avisos
          </Boton>
        </>
      )}

      {estado === "activo" && (
        <div className="flex flex-wrap gap-esp2">
          <Boton variante="secundario" className="min-h-11" cargando={trabajando} onClick={probar}>
            Enviarme una prueba
          </Boton>
          <Boton
            variante="fantasma"
            className="min-h-11"
            disabled={trabajando}
            onClick={() => ejecutar(desactivarAvisos)}
          >
            Desactivar en este móvil
          </Boton>
        </div>
      )}

      {mensaje && (
        <p
          className={mensaje.tono === "ok" ? "animate-estado-entrar text-sm text-texto-exito" : "animate-estado-entrar text-sm text-texto-peligro"}
          role="status"
        >
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}

const CLAVE_POSPUESTO = "creativa.avisos.pospuesto";
const DOS_DIAS = 2 * 24 * 60 * 60 * 1000;

/** Aviso discreto en la app del empleado mientras no tenga los avisos activados. Se puede posponer. */
export function BannerAvisos() {
  const { estado } = useEstadoAvisos();
  const [oculto, setOculto] = useState(true);

  useEffect(() => {
    try {
      const hasta = Number(localStorage.getItem(CLAVE_POSPUESTO) ?? 0);
      setOculto(Date.now() < hasta);
    } catch {
      setOculto(false);
    }
  }, []);

  if (oculto || (estado !== "inactivo" && estado !== "ios-sin-instalar")) return null;

  function posponer() {
    try {
      localStorage.setItem(CLAVE_POSPUESTO, String(Date.now() + DOS_DIAS));
    } catch {
      /* sin almacenamiento: se oculta solo hasta recargar */
    }
    setOculto(true);
  }

  return (
    <div
      role="status"
      className="animate-estado-entrar mx-esp4 mt-esp3 flex items-center gap-esp3 rounded-md border border-borde-aviso bg-fondo-aviso-sutil px-esp3 py-esp2 text-xs text-texto-primario"
    >
      <Icono nombre="avisos" size={16} className="text-texto-aviso" />
      <span className="min-w-0 flex-1">
        Activa los avisos para recibir el trabajo de mañana y los cambios de plan.
      </span>
      <Link href="/app/avisos" className="shrink-0 font-semibold text-texto-marca">
        Activar
      </Link>
      <button onClick={posponer} aria-label="Recordármelo más tarde" className="shrink-0 text-texto-terciario">
        <Icono nombre="cerrar" size={16} />
      </button>
    </div>
  );
}
