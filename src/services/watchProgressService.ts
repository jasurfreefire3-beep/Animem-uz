import { Anime, AnimeWatchProgress, EpisodeProgress, toSlug } from '../types';

const STORAGE_KEY = 'animem_watch_progress_v2';
const LEGACY_HISTORY_KEY = 'anime_history';

export function getAllWatchProgress(): Record<string, AnimeWatchProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Check if we can migrate from legacy anime_history
      const legacyRaw = localStorage.getItem(LEGACY_HISTORY_KEY);
      if (legacyRaw) {
        try {
          const legacyItems = JSON.parse(legacyRaw);
          if (Array.isArray(legacyItems)) {
            const migrated: Record<string, AnimeWatchProgress> = {};
            for (const item of legacyItems) {
              const aid = String(item.animeId);
              migrated[aid] = {
                animeId: aid,
                animeTitle: item.animeTitle || '',
                animeSlug: item.animeSlug || '',
                poster: item.poster || '',
                lastEpisode: item.lastEpisode || 1,
                totalEpisodes: item.totalEpisodes || 12,
                episodes: {
                  [item.lastEpisode || 1]: {
                    episodeNumber: item.lastEpisode || 1,
                    watched: true,
                    lastWatchedAt: item.viewedAt || new Date().toISOString()
                  }
                },
                updatedAt: item.viewedAt || new Date().toISOString()
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
    console.error('Error reading watch progress:', e);
    return {};
  }
}

export function getAnimeWatchProgress(animeId: string | number): AnimeWatchProgress | null {
  const all = getAllWatchProgress();
  return all[String(animeId)] || null;
}

export function isEpisodeWatched(animeId: string | number, episodeNumber: number): boolean {
  const progress = getAnimeWatchProgress(animeId);
  if (!progress || !progress.episodes) return false;
  const ep = progress.episodes[episodeNumber];
  return !!(ep && ep.watched);
}

export function getWatchedEpisodesMap(animeId: string | number): Record<number, boolean> {
  const progress = getAnimeWatchProgress(animeId);
  if (!progress || !progress.episodes) return {};
  const res: Record<number, boolean> = {};
  for (const [epNum, data] of Object.entries(progress.episodes)) {
    if (data && data.watched) {
      res[Number(epNum)] = true;
    }
  }
  return res;
}

export function recordEpisodeWatch(
  anime: Anime | { id: string | number; title?: string; slug?: string; image_url?: string; banner_url?: string; qismlar_soni?: number },
  episodeNumber: number,
  options?: { timestamp?: number; duration?: number; progressPercent?: number; token?: string | null }
): AnimeWatchProgress {
  const all = getAllWatchProgress();
  const aid = String(anime.id);
  const now = new Date().toISOString();

  const current: AnimeWatchProgress = all[aid] || {
    animeId: aid,
    animeTitle: anime.title || '',
    animeSlug: (anime as any).slug || toSlug(anime.title || '') || aid,
    poster: anime.image_url || anime.banner_url || '',
    lastEpisode: episodeNumber,
    totalEpisodes: anime.qismlar_soni || 12,
    episodes: {},
    updatedAt: now
  };

  // Update poster and title if missing or updated
  if (anime.title) current.animeTitle = anime.title;
  if (anime.image_url || anime.banner_url) current.poster = anime.image_url || anime.banner_url || '';
  if (anime.qismlar_soni) current.totalEpisodes = anime.qismlar_soni;
  current.animeSlug = (anime as any).slug || toSlug(anime.title || '') || aid;
  current.lastEpisode = episodeNumber;
  current.updatedAt = now;

  // Mark this episode as watched
  current.episodes[episodeNumber] = {
    episodeNumber,
    watched: true,
    timestamp: options?.timestamp || 0,
    duration: options?.duration || 1440,
    progressPercent: options?.progressPercent || 100,
    lastWatchedAt: now
  };

  all[aid] = current;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    // Also keep legacy history updated for backward compatibility
    const legacyHistory = Object.values(all)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map(item => ({
        animeId: item.animeId,
        animeTitle: item.animeTitle,
        animeSlug: item.animeSlug,
        poster: item.poster,
        viewedAt: item.updatedAt,
        lastEpisode: item.lastEpisode
      }))
      .slice(0, 30);
    localStorage.setItem(LEGACY_HISTORY_KEY, JSON.stringify(legacyHistory));
  } catch (e) {
    console.error('Error saving watch progress:', e);
  }

  // Dispatch custom event for real-time reactivity
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('animem_watch_progress_updated', {
      detail: { animeId: aid, episodeNumber, progress: current }
    }));
  }

  // Auto-sync with backend if token is available
  if (options?.token) {
    const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
    fetch(`${API_BASE}/api/user/watch-progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.token}`
      },
      body: JSON.stringify({
        anime_id: anime.id,
        episode_number: episodeNumber,
        minutes_watched: 24
      })
    }).catch(() => {});
  }

  return current;
}

export function clearAnimeWatchProgress(animeId: string | number): void {
  const all = getAllWatchProgress();
  const aid = String(animeId);
  if (all[aid]) {
    delete all[aid];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('animem_watch_progress_updated', { detail: { animeId: aid } }));
    }
  }
}

export function getContinueWatchingList(): AnimeWatchProgress[] {
  const all = getAllWatchProgress();
  return Object.values(all).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
