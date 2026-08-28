import { Anime, UserListItem, UserListStatus } from '../types';

const STORAGE_KEY = 'animem_user_lists_v1';
const LEGACY_FAVORITES_KEY = 'anime_favorites';

export interface StatusConfig {
  id: UserListStatus;
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  description: string;
}

export const USER_LIST_STATUSES: StatusConfig[] = [
  {
    id: 'watching',
    label: "Ko'ryapman",
    shortLabel: 'Tomoshada',
    color: '#10b981', // emerald-500
    bgColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
    dotColor: '#10b981',
    description: "Hozirda tomosha qilinayotgan animelar"
  },
  {
    id: 'plan_to_watch',
    label: "Ko'rmoqchiman",
    shortLabel: 'Rejada',
    color: '#a855f7', // purple-500
    bgColor: 'rgba(168, 85, 247, 0.12)',
    borderColor: 'rgba(168, 85, 247, 0.35)',
    dotColor: '#a855f7',
    description: "Kelajakda ko'rish uchun rejalashtirilgan"
  },
  {
    id: 'completed',
    label: "Ko'rib bo'ldim",
    shortLabel: 'Tugatildi',
    color: '#0ea5e9', // sky-500
    bgColor: 'rgba(14, 165, 233, 0.12)',
    borderColor: 'rgba(14, 165, 233, 0.35)',
    dotColor: '#0ea5e9',
    description: "Oxirigacha to'liq ko'rib tugatilgan"
  },
  {
    id: 'dropped',
    label: "Tashlab ketdim",
    shortLabel: 'Tashlab ketildi',
    color: '#f59e0b', // amber-500
    bgColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    dotColor: '#f59e0b',
    description: "Yoqmagan yoki to'xtatilgan"
  },
  {
    id: 'favorite',
    label: "Sevimlilar",
    shortLabel: 'Sevimli',
    color: '#ff006a', // neon pink
    bgColor: 'rgba(255, 0, 106, 0.14)',
    borderColor: 'rgba(255, 0, 106, 0.4)',
    dotColor: '#ff006a',
    description: "Eng sevimli durdona animelar"
  }
];

export function getStatusConfig(status?: UserListStatus | string | null): StatusConfig | null {
  if (!status) return null;
  return USER_LIST_STATUSES.find(s => s.id === status) || null;
}

export function getAllUserLists(): Record<string, UserListItem> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Migrate legacy favorites if available
      const favsRaw = localStorage.getItem(LEGACY_FAVORITES_KEY);
      if (favsRaw) {
        try {
          const favIds = JSON.parse(favsRaw);
          if (Array.isArray(favIds)) {
            const migrated: Record<string, UserListItem> = {};
            const now = new Date().toISOString();
            for (const id of favIds) {
              migrated[String(id)] = {
                animeId: String(id),
                status: 'favorite',
                updatedAt: now
              };
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            return migrated;
          }
        } catch {}
      }
      return {};
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading user lists:', e);
    return {};
  }
}

export function getAnimeListStatus(animeId: string | number): UserListStatus | null {
  const all = getAllUserLists();
  const item = all[String(animeId)];
  return item ? item.status : null;
}

export function setUserListStatus(
  animeId: string | number,
  status: UserListStatus | null,
  anime?: Partial<Anime>,
  token?: string | null
): void {
  const all = getAllUserLists();
  const aid = String(animeId);
  const now = new Date().toISOString();

  if (status === null) {
    // Remove from list
    delete all[aid];
  } else {
    all[aid] = {
      animeId: aid,
      status,
      updatedAt: now,
      anime: anime ? {
        id: String(anime.id || aid),
        title: anime.title,
        image_url: anime.image_url,
        banner_url: anime.banner_url,
        rating: anime.rating,
        qismlar_soni: anime.qismlar_soni,
        janrlar: anime.janrlar
      } : undefined
    };
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

    // Also update legacy anime_favorites array
    const favorites = Object.values(all)
      .filter(item => item.status === 'favorite')
      .map(item => String(item.animeId));
    localStorage.setItem(LEGACY_FAVORITES_KEY, JSON.stringify(favorites));
  } catch (e) {
    console.error('Error saving user lists:', e);
  }

  // Dispatch custom event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('animem_user_list_updated', {
      detail: { animeId: aid, status, allLists: all }
    }));
  }

  // Sync to backend if token available
  if (token) {
    const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
    fetch(`${API_BASE}/api/user/my-list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        anime_id: aid,
        status,
        anime_data: anime
      })
    }).catch(() => {});
  }
}

export function getUserListCounts(): Record<UserListStatus | 'all', number> {
  const all = getAllUserLists();
  const counts: Record<UserListStatus | 'all', number> = {
    all: Object.keys(all).length,
    watching: 0,
    plan_to_watch: 0,
    completed: 0,
    dropped: 0,
    favorite: 0
  };

  for (const item of Object.values(all)) {
    if (item.status && counts[item.status] !== undefined) {
      counts[item.status]++;
    }
  }

  return counts;
}
