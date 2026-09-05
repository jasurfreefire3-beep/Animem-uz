export interface User {
  id: string | number;
  name: string;
  role: 'user' | 'admin';
  email?: string;
  phone?: string;
  avatar_url?: string;
  banner_url?: string;
  bio?: string;
  telegram?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  discord?: string;
  facebook?: string;
  vk?: string;
  favorites?: any[];
  watch_time_minutes?: number;
  watch_history?: any[];
  comments_count?: number;
  created_at?: string;
  last_seen?: string;
}

export interface Anime {
  id: string;
  title: string;
  description: string;
  image_url: string;
  banner_url: string;
  rating: number;
  rating_count: number;
  holati: string;
  yil: number | null;
  studiyasi: string;
  qismlar_soni: number;
  janrlar: string;
  tags?: string;
  telegram_url?: string;
  video_url: string;
  tavsiya: boolean;
  is_banner?: boolean | number;
  is_adult?: boolean | number;
  korishlar?: number;
  created_at: string;
}

export interface Manga {
  id: string | number;
  title: string;
  description: string;
  cover_url: string;
  banner_url?: string;
  author?: string;
  artist?: string;
  janrlar: string;
  tags?: string;
  type?: string;
  holati: string;
  released_year?: number;
  rating?: number;
  korishlar?: number;
  chapters_count?: number;
  created_at?: string;
}

export interface MangaChapter {
  id: string | number;
  manga_id: string | number;
  chapter_number: number;
  title?: string;
  pages: string[];
  views?: number;
  created_at?: string;
}

export interface Notification {
  id: string;
  message: string;
  createdAt?: any;
  created_at?: string;
  isRead?: boolean;
}

export interface CommentReply {
  id: string | number;
  user_id: string | number;
  user_name: string;
  user_avatar?: string;
  content: string;
  created_at: string;
}

export interface Comment {
  id: string | number;
  anime_id?: string | number;
  manga_id?: string | number;
  drama_id?: string | number;
  user_id: string | number;
  user_name: string;
  user_avatar?: string;
  avatar_url?: string;
  content: string;
  likes?: number;
  dislikes?: number;
  liked_users?: (string | number)[];
  disliked_users?: (string | number)[];
  replies?: CommentReply[];
  created_at: string;
}

export interface DramaEpisode {
  id: string | number;
  drama_id: string | number;
  qism: number;
  title?: string;
  video_url: string;
  created_at?: string;
}

export interface Drama {
  id: string | number;
  title: string;
  description?: string;
  poster_url: string;
  banner_url?: string;
  janrlar: string; // Masalan: "Romantika, Komediya, Melodrama"
  yil: number | string;
  video_url?: string;
  telegram_url?: string;
  likes?: number;
  liked_users?: (string | number)[];
  korishlar?: number;
  episodes?: DramaEpisode[];
  episodes_count?: number;
  created_at?: string;
}

export interface Message {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  avatar_url?: string;
  content: string;
  reply_to_id?: string | null;
  reply_to_name?: string | null;
  reply_to_content?: string | null;
  created_at: string;
}

export type UserListStatus = 'watching' | 'plan_to_watch' | 'completed' | 'dropped' | 'favorite';

export interface UserListItem {
  animeId: string | number;
  status: UserListStatus;
  updatedAt: string;
  watchedEpisodes?: number;
  rating?: number;
  anime?: Partial<Anime>;
}

export interface EpisodeProgress {
  episodeNumber: number;
  watched: boolean;
  timestamp?: number;
  duration?: number;
  progressPercent?: number;
  lastWatchedAt: string;
}

export interface AnimeWatchProgress {
  animeId: string | number;
  animeTitle: string;
  animeSlug: string;
  poster: string;
  lastEpisode: number;
  totalEpisodes: number;
  episodes: Record<number, EpisodeProgress>;
  updatedAt: string;
}

export const GENRE_MAP: Record<string, string> = {
  'Action': 'Jangari',
  'Adventure': 'Sarguzasht',
  'Comedy': 'Komediya',
  'Drama': 'Drama',
  'Fantasy': 'Fantastika',
  'Horror': 'Dahshatli',
  'Romance': 'Romantika',
  'Sci-Fi': 'Ilmiy-fantastika',
  'Slice of Life': 'Kundalik hayot',
  'Supernatural': 'G\'ayritabiiy'
};

export function translateGenre(genre: string): string {
  const normalized = genre.trim();
  for (const [eng, uzb] of Object.entries(GENRE_MAP)) {
    if (eng.toLowerCase() === normalized.toLowerCase()) return uzb;
    if (uzb.toLowerCase() === normalized.toLowerCase()) return uzb;
  }
  return normalized;
}

export function getEnglishGenre(genre: string): string {
  const normalized = genre.trim();
  for (const [eng, uzb] of Object.entries(GENRE_MAP)) {
    if (uzb.toLowerCase() === normalized.toLowerCase()) return eng;
    if (eng.toLowerCase() === normalized.toLowerCase()) return eng;
  }
  return normalized;
}

export function toSlug(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/o['’`‘]/g, "o")
    .replace(/g['’`‘]/g, "g")
    .replace(/[^a-z0-9\u0400-\u04FF]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

export interface ReelComment {
  id: number | string;
  reel_id: number | string;
  user_id?: number | string;
  username: string;
  user_avatar?: string;
  content: string;
  created_at: string;
}

export interface Reel {
  id: number | string;
  user_id?: number | string;
  title: string;
  video_url: string;
  thumbnail_url?: string;
  anime_title?: string;
  anime_id?: number | string;
  author_name: string;
  author_avatar?: string;
  likes_count: number;
  views_count: number;
  shares_count: number;
  comments_count?: number;
  tags?: string;
  is_liked?: boolean;
  created_at: string;
}


