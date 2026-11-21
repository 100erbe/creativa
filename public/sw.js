/* Service worker de Creativa: solo se ocupa de las notificaciones push.
 *
 * No guarda páginas en caché (la app necesita datos siempre actuales), así que no cambia cómo carga
 * ni cómo se actualiza. Mantén este archivo pequeño y sin dependencias: se descarga en cada visita. */

self.addEventListener("install", () => {
  // La versión nueva se activa sin esperar a que se cierren las pestañas.
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(self.clients.claim());
});

/** Llega un aviso: se muestra siempre (Chrome exige que cada push produzca una notificación). */
self.addEventListener("push", (evento) => {
  let datos = {};
  try {
    datos = evento.data ? evento.data.json() : {};
  } catch (_) {
    datos = { cuerpo: evento.data ? evento.data.text() : "" };
  }

  const titulo = datos.titulo || "Creativa";
  const opciones = {
    body: datos.cuerpo || "",
    icon: "/icons/icon-192.png?v=2",
    badge: "/icons/icon-192.png?v=2",
    // Con la misma "tag" un aviso nuevo sustituye al anterior (p. ej. varios cambios en un mismo punto).
    tag: datos.tag || undefined,
    renotify: Boolean(datos.tag),
    // Los urgentes no desaparecen solos (Android/escritorio; iOS lo ignora).
    requireInteraction: Boolean(datos.urgente),
    vibrate: datos.urgente ? [250, 120, 250, 120, 250] : [120],
    data: { url: datos.url || "/" },
  };
  evento.waitUntil(
    (async () => {
      await self.registration.showNotification(titulo, opciones);
      // Si hay una ventana abierta, se le avisa para que enseñe el popup y actualice el contador al instante.
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      ventanas.forEach((ventana) => ventana.postMessage({ tipo: "aviso-nuevo" }));
    })(),
  );
});

/** Al tocar el aviso se abre (o se trae al frente) la app en la pantalla que corresponde. */
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = new URL((evento.notification.data && evento.notification.data.url) || "/", self.location.origin).href;

  evento.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const ventana of ventanas) {
        if (ventana.url.startsWith(self.location.origin) && "focus" in ventana) {
          await ventana.focus();
          if ("navigate" in ventana) await ventana.navigate(destino);
          return;
        }
      }
      await self.clients.openWindow(destino);
    })(),
  );
});

/** El navegador renovó la suscripción: se avisa a la app abierta para que la registre de nuevo. */
self.addEventListener("pushsubscriptionchange", (evento) => {
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      ventanas.forEach((ventana) => ventana.postMessage({ tipo: "resuscribir" }));
    }),
  );
});
