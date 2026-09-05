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
    data: { url: data.url || "/staff" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
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
