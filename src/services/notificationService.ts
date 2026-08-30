import { Anime, Notification as AdminNotif, toSlug } from '../types';

export const PWA_APP_ICON = 'https://api.animem.uz/api/images/1788100529230_au9wggu';

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  url?: string;
  tag?: string;
}

const STORAGE_KEYS = {
  PUSH_ENABLED: 'animem_push_enabled',
  PROMPT_DISMISSED_AT: 'animem_push_prompt_dismissed_at',
  LAST_ANIME_ID: 'animem_last_known_anime_id',
  LAST_NOTIF_ID: 'animem_last_known_notif_id',
  INITIALIZED: 'animem_notif_initialized',
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if the browser environment supports Notifications
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Get current browser notification permission
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Register the Service Worker for push notifications and sync subscription to backend
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    
    // Register Periodic Background Sync if available
    if ('periodicSync' in reg) {
      try {
        await (reg as any).periodicSync.register('check-new-animes', {
          minInterval: 60 * 60 * 1000, // 1 hour
        });
      } catch (e) {}
    }

    return reg;
  } catch (error) {
    console.warn('Service Worker registration notice:', error);
    return null;
  }
}

/**
 * Subscribe to Web Push on the server so push notifications arrive even when browser/site is closed
 */
export async function subscribeToWebPush(registration: ServiceWorkerRegistration): Promise<boolean> {
  try {
    const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
    
    // 1. Get VAPID public key from backend
    const keyRes = await fetch(`${API_BASE}/api/push/vapid-public-key`);
    if (!keyRes.ok) return false;
    const { publicKey } = await keyRes.json();
    if (!publicKey) return false;

    // 2. Subscribe via PushManager
    const convertedKey = urlBase64ToUint8Array(publicKey);
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });
    }

    // 3. Save subscription in MySQL backend
    let userId = null;
    try {
      const storedUser = localStorage.getItem('animem_user');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        userId = u.id || null;
      }
    } catch (e) {}

    await fetch(`${API_BASE}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, userId })
    });

    return true;
  } catch (e) {
    console.warn('Web push subscription notice:', e);
    return false;
  }
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) {
    console.warn('Notifications not supported in this browser.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      localStorage.setItem(STORAGE_KEYS.PUSH_ENABLED, 'true');
      const reg = await registerServiceWorker();
      if (reg) {
        await subscribeToWebPush(reg);
      }

      // Send initial welcome / verification notification with app icon
      await sendDeviceNotification({
        title: "Animem.uz | Bildirishnomalar yoqildi! 🎉",
        body: "Siz eng so'nggi yangi animelar va yangi qismlardan saytga kirmagan bo'lsangiz ham birinchilardan bo'lib xabardor bo'lasiz!",
        icon: PWA_APP_ICON,
        badge: PWA_APP_ICON,
        url: '/',
        tag: 'welcome-notification'
      });

      return true;
    } else {
      localStorage.setItem(STORAGE_KEYS.PUSH_ENABLED, 'false');
      return false;
    }
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return false;
  }
}

/**
 * Check if the notification prompt modal should be shown to the user
 */
export function shouldShowNotificationPrompt(): boolean {
  if (!isNotificationSupported()) return false;
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return false;

  const dismissedAt = localStorage.getItem(STORAGE_KEYS.PROMPT_DISMISSED_AT);
  if (dismissedAt) {
    const passedHours = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60);
    if (passedHours < 48) {
      return false;
    }
  }

  return true;
}

/**
 * Dismiss the notification prompt for 2 days
 */
export function dismissNotificationPrompt(): void {
  localStorage.setItem(STORAGE_KEYS.PROMPT_DISMISSED_AT, Date.now().toString());
}

/**
 * Send a native notification to the device (Google Chrome / Android / Desktop)
 */
export async function sendDeviceNotification(payload: NotificationPayload): Promise<boolean> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const title = payload.title || 'Animem.uz';
  const options: any = {
    body: payload.body,
    icon: payload.icon || PWA_APP_ICON,
    badge: payload.badge || PWA_APP_ICON,
    tag: payload.tag || `animem-${Date.now()}`,
    renotify: true,
    data: { url: payload.url || '/' },
  };

  if (payload.image) {
    options.image = payload.image;
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, options);
        return true;
      }
    }

    const notif = new Notification(title, options);
    notif.onclick = () => {
      window.focus();
      if (payload.url) {
        window.location.href = payload.url;
      }
      notif.close();
    };
    return true;
  } catch (err) {
    console.error('Failed to trigger device notification:', err);
    return false;
  }
}

/**
 * Inspect incoming anime list and admin notifications, and notify device if new items were released
 */
export function checkAndNotifyNewContent(animes: Anime[], adminNotifs: AdminNotif[]) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return;
  }

  const isInitialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);

  if (!isInitialized) {
    if (animes && animes.length > 0) {
      const maxAnimeId = Math.max(...animes.map(a => Number(a.id) || 0));
      localStorage.setItem(STORAGE_KEYS.LAST_ANIME_ID, maxAnimeId.toString());
    }
    if (adminNotifs && adminNotifs.length > 0) {
      const maxNotifId = Math.max(...adminNotifs.map(n => Number(n.id) || 0));
      localStorage.setItem(STORAGE_KEYS.LAST_NOTIF_ID, maxNotifId.toString());
    }
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    return;
  }

  const lastAnimeId = Number(localStorage.getItem(STORAGE_KEYS.LAST_ANIME_ID) || '0');
  const lastNotifId = Number(localStorage.getItem(STORAGE_KEYS.LAST_NOTIF_ID) || '0');

  // Check for new animes
  if (animes && animes.length > 0) {
    const newAnimes = animes.filter(a => Number(a.id) > lastAnimeId);
    if (newAnimes.length > 0) {
      const newest = newAnimes[0];
      const targetSlug = toSlug(newest.title);
      const isMultiEp = Number(newest.qismlar_soni) > 1;

      sendDeviceNotification({
        title: `Animem.uz | Yangi Anime! 🎬`,
        body: `"${newest.title}" katalogga qo'shildi (${isMultiEp ? `${newest.qismlar_soni} qism` : 'Film'}). O'zbek tilida tomosha qiling!`,
        icon: PWA_APP_ICON,
        badge: PWA_APP_ICON,
        image: newest.image_url || newest.banner_url || undefined,
        url: `/anime/${targetSlug}`,
        tag: `anime-${newest.id}`
      });

      const maxAnimeId = Math.max(...animes.map(a => Number(a.id) || 0));
      localStorage.setItem(STORAGE_KEYS.LAST_ANIME_ID, maxAnimeId.toString());
    }
  }

  // Check for new admin notifications
  if (adminNotifs && adminNotifs.length > 0) {
    const newNotifs = adminNotifs.filter(n => Number(n.id) > lastNotifId);
    if (newNotifs.length > 0) {
      const newestNotif = newNotifs[0];
      sendDeviceNotification({
        title: "Animem.uz | Muhim Yangilik 📢",
        body: newestNotif.message,
        icon: PWA_APP_ICON,
        badge: PWA_APP_ICON,
        image: (newestNotif as any).image || undefined,
        url: '/',
        tag: `notif-${newestNotif.id}`
      });

      const maxNotifId = Math.max(...adminNotifs.map(n => Number(n.id) || 0));
      localStorage.setItem(STORAGE_KEYS.LAST_NOTIF_ID, maxNotifId.toString());
    }
  }
}
