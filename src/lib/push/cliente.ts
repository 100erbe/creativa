"use client";

import { desenvolver } from "@/lib/accion";
import { eliminarSuscripcion, guardarSuscripcion } from "./acciones";

// Lado del navegador de las notificaciones push: registrar el service worker, pedir permiso y
// suscribir el dispositivo. Todo se llama desde un componente cliente.

const CLAVE_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type EstadoAvisos =
  | "cargando"
  /** El navegador no sabe de push (o la página no es HTTPS). */
  | "no-soportado"
  /** iPhone/iPad en Safari: solo funciona con la app añadida a la pantalla de inicio. */
  | "ios-sin-instalar"
  /** Falta configurar las claves en el servidor. */
  | "sin-configurar"
  /** La persona rechazó el permiso: solo puede cambiarlo en los ajustes del móvil. */
  | "bloqueado"
  | "inactivo"
  | "activo";

export function esIos() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function esAppInstalada() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function admitePush() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** La clave pública viene en base64 "url-safe"; la API del navegador la quiere en bytes. */
function aBytes(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const bin = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Registra el service worker (idempotente). Devuelve null si el navegador no lo admite. */
export async function registrarServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

async function suscripcionActual(): Promise<PushSubscription | null> {
  const registro = await registrarServiceWorker();
  if (!registro) return null;
  await navigator.serviceWorker.ready;
  return registro.pushManager.getSubscription();
}

export async function estadoAvisos(): Promise<EstadoAvisos> {
  if (esIos() && !esAppInstalada()) return "ios-sin-instalar";
  if (!admitePush()) return "no-soportado";
  if (!CLAVE_PUBLICA) return "sin-configurar";
  if (Notification.permission === "denied") return "bloqueado";
  if (Notification.permission !== "granted") return "inactivo";
  return (await suscripcionActual()) ? "activo" : "inactivo";
}

function datosDe(s: PushSubscription) {
  const json = s.toJSON();
  return {
    endpoint: s.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
    userAgent: navigator.userAgent,
  };
}

/**
 * Pide permiso, suscribe este dispositivo y lo registra en el servidor.
 * Debe llamarse desde un toque del usuario: iOS y Chrome rechazan el permiso si no.
 */
export async function activarAvisos(): Promise<void> {
  if (!admitePush()) throw new Error("Este navegador no admite avisos.");
  if (!CLAVE_PUBLICA) throw new Error("Los avisos todavía no están configurados en el servidor.");

  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") throw new Error("No has dado permiso para los avisos.");

  const registro = await registrarServiceWorker();
  if (!registro) throw new Error("No se pudo preparar el servicio de avisos.");
  await navigator.serviceWorker.ready;

  const suscripcion =
    (await registro.pushManager.getSubscription()) ??
    (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(CLAVE_PUBLICA) }));
  await desenvolver(guardarSuscripcion(datosDe(suscripcion)));
}

/** Deja de recibir avisos en este dispositivo. */
export async function desactivarAvisos(): Promise<void> {
  const suscripcion = await suscripcionActual();
  if (!suscripcion) return;
  const endpoint = suscripcion.endpoint;
  await suscripcion.unsubscribe();
  await desenvolver(eliminarSuscripcion(endpoint));
}

/**
 * Al abrir la app: si los avisos ya estaban activos, se vuelve a registrar la suscripción por si el
 * navegador la renovó, o por si el móvil lo usó otra persona antes.
 */
export async function sincronizarSuscripcion(): Promise<void> {
  try {
    if (!admitePush() || !CLAVE_PUBLICA || Notification.permission !== "granted") return;
    const suscripcion = await suscripcionActual();
    if (suscripcion) await desenvolver(guardarSuscripcion(datosDe(suscripcion)));
  } catch {
    /* sin red o sin sesión: se reintenta la próxima vez */
  }
}

/** Al cerrar sesión: este móvil deja de recibir los avisos de la persona que sale. */
export async function liberarDispositivo(): Promise<void> {
  try {
    if (!admitePush()) return;
    await desactivarAvisos();
  } catch {
    /* no bloquear el cierre de sesión por esto */
  }
}
