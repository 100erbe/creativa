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
  // Solo se abren pantallas de la propia app: una URL de otro dominio en el aviso se ignora.
  let destino = self.location.origin + "/";
  try {
    const url = new URL((evento.notification.data && evento.notification.data.url) || "/", self.location.origin);
    if (url.origin === self.location.origin) destino = url.href;
  } catch (_) {
    /* URL no válida: se abre el inicio */
  }

  evento.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const propia = ventanas.find((v) => v.url.startsWith(self.location.origin) && v.frameType !== "nested");
      if (propia) {
        try {
          await propia.focus();
          await propia.navigate(destino);
          return;
        } catch (_) {
          /* ventana no controlada (navigate falla): se abre una nueva */
        }
      }
      await self.clients.openWindow(destino);
    })(),
  );
});

/**
 * El navegador renovó la suscripción: se vuelve a suscribir aquí mismo con las mismas opciones
 * (si no hay ninguna ventana abierta, el aviso no se pierde) y se avisa a la app abierta para que
 * registre la nueva en el servidor; si no hay ninguna, lo hará la próxima vez que se abra.
 */
self.addEventListener("pushsubscriptionchange", (evento) => {
  evento.waitUntil(
    (async () => {
      try {
        const anterior = evento.oldSubscription;
        if (!evento.newSubscription && anterior && anterior.options) {
          await self.registration.pushManager.subscribe(anterior.options);
        }
      } catch (_) {
        /* el navegador no deja suscribirse sin la app abierta: la app lo hará al abrirse */
      }
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      ventanas.forEach((ventana) => ventana.postMessage({ tipo: "resuscribir" }));
    })(),
  );
});
