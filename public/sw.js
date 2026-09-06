// This file runs in the background, even when the app is closed.
// It is what lets the phone show real notifications (like Instagram/YouTube).

// Runs once when the service worker is first installed on a device.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Runs once the service worker takes control of the page.
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Fires when a push notification arrives from the server (even if the app is closed).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Chiya", body: event.data ? event.data.text() : "New update" };
  }

  const title = data.title || "Chiya";
  const options = {
    body: data.body || "You have a new update.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200, 100, 200],
    // A unique tag per alert so several alerts stack instead of replacing each other.
    tag: `chiya-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || "/staff" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Phones sometimes reset a device's notification registration. When that happens we
// register again straight away and tell the server, so alerts never silently stop.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const oldEndpoint = event.oldSubscription?.endpoint;
      try {
        const res = await fetch("/api/public/push-device");
        const { publicKey } = await res.json();
        if (!publicKey) return;

        const padding = "=".repeat((4 - (publicKey.length % 4)) % 4);
        const base64 = (publicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
        const raw = atob(base64);
        const applicationServerKey = Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));

        const subscription =
          event.newSubscription ||
          (await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          }));

        const json = subscription.toJSON();
        if (!oldEndpoint) return;
        await fetch("/api/public/push-device", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oldEndpoint,
            endpoint: json.endpoint,
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
          }),
        });
      } catch (e) {
        // Nothing else we can do in the background; the app re-checks next time it opens.
      }
    })(),
  );
});

// Fires when the user taps the notification — brings them into the app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/staff";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
