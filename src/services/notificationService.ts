import { Anime, Notification as AdminNotif, toSlug } from '../types';

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
 * Register the Service Worker for push notifications
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (error) {
    console.warn('Service Worker registration failed:', error);
    return null;
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
      await registerServiceWorker();

      // Send initial welcome / verification notification
      await sendDeviceNotification({
        title: "Animem.uz | Bildirishnomalar yoqildi! 🎉",
        body: "Siz eng so'nggi yangi animelar va yangi qismlardan birinchilardan bo'lib xabardor bo'lasiz!",
        icon: '/icon-192.png',
        badge: '/icon-48.png',
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
  
  // If already granted, don't show prompt
  if (Notification.permission === 'granted') return false;
  
  // If explicitly denied in browser settings, don't nag
  if (Notification.permission === 'denied') return false;

  // Check if user dismissed recently (e.g. within 2 days)
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
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-48.png',
    tag: payload.tag || `animem-${Date.now()}`,
    renotify: true,
    data: { url: payload.url || '/' },
  };

  if (payload.image) {
    // Only assign image if supported
    (options as any).image = payload.image;
  }

  try {
    // Try Service Worker registration first (standard for modern browsers & mobile Android)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, options);
        return true;
      }
    }

    // Fallback to standard window Notification
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
    // First time visitor, record the current highest IDs so we don't spam for all existing items
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
      // Pick newest anime to notify
      const newest = newAnimes[0];
      const targetSlug = toSlug(newest.title);
      const isMultiEp = Number(newest.qismlar_soni) > 1;

      sendDeviceNotification({
        title: `Animem.uz | Yangi Anime! 🎬`,
        body: `"${newest.title}" katalogga qo'shildi (${isMultiEp ? `${newest.qismlar_soni} qism` : 'Film'}). O'zbek tilida hoziroq tomosha qiling!`,
        icon: '/icon-192.png',
        badge: '/icon-48.png',
        image: newest.image_url || undefined,
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
        icon: '/icon-192.png',
        badge: '/icon-48.png',
        url: '/',
        tag: `notif-${newestNotif.id}`
      });

      const maxNotifId = Math.max(...adminNotifs.map(n => Number(n.id) || 0));
      localStorage.setItem(STORAGE_KEYS.LAST_NOTIF_ID, maxNotifId.toString());
    }
  }
}
