// Animem.uz Service Worker for Device Push Notifications & Offline PWA

const APP_ICON = 'https://api.animem.uz/api/images/1788100529230_au9wggu';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle Push event from server (Web Push API - runs even when site is closed)
self.addEventListener('push', (event) => {
  let data = {
    title: 'Animem.uz | Yangi Anime',
    body: "Animem.uz saytida yangi o'zbek tilidagi animelar va qismlar joylandi!",
    icon: APP_ICON,
    badge: APP_ICON,
    image: undefined,
    data: { url: '/' }
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
      if (parsed.data && parsed.data.url) {
        data.data = parsed.data;
      } else if (parsed.url) {
        data.data = { url: parsed.url };
      }
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || APP_ICON,
    badge: data.badge || APP_ICON,
    image: data.image || undefined,
    data: data.data || { url: '/' },
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || `animem-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: 'open', title: "Tomosha qilish 🎬" },
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

// Periodic background sync if supported
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-new-animes') {
    event.waitUntil(
      fetch('/api/notifications')
        .then(res => res.json())
        .then(notifs => {
          if (notifs && notifs.length > 0) {
            const latest = notifs[0];
            self.registration.showNotification("Animem.uz | Yangi Premyera", {
              body: latest.message,
              icon: APP_ICON,
              badge: APP_ICON,
              image: latest.image || undefined,
              data: { url: '/' }
            });
          }
        })
        .catch(() => {})
    );
  }
});
