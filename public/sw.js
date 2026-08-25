// Animem.uz Service Worker for Device Push Notifications

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle Push event from server (Web Push API)
self.addEventListener('push', (event) => {
  let data = {
    title: 'Animem.uz | Yangi Bildirishnoma',
    body: "Animem.uz saytida yangi o'zbek tilidagi animelar va qismlar joylandi!",
    icon: '/icon-192.png',
    badge: '/icon-48.png',
    data: { url: '/' }
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-48.png',
    image: data.image || undefined,
    data: data.data || { url: '/' },
    vibrate: [200, 100, 200],
    tag: data.tag || 'animem-notification',
    renotify: true,
    actions: [
      { action: 'open', title: "Ko'rish 🎬" },
      { action: 'close', title: 'Yopish ✕' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle click on notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window tab with Animem.uz is already open, focus and navigate it
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
