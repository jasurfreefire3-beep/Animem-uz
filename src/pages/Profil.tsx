import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Anime, toSlug } from '../types';
import { 
  Shield, Clock, Heart, MessageSquare, Edit3, Save, Camera, 
  Loader2, Globe, Send, Instagram, Youtube, Tv, Share2, 
  Check, X, Sparkles, Film, Star, ArrowRight, Lock, Eye, Trash2,
  RotateCcw, LogIn, Play, Upload, AlertCircle, Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TelegramIcon, InstagramIcon, TikTokIcon, YouTubeIcon, 
  DiscordIcon, FacebookIcon, VKIcon 
} from '../components/SocialIcons';
import LoadingScreen from '../components/LoadingScreen';

// Default banner if none provided
const DEFAULT_BANNER = "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&auto=format&fit=crop&q=80";

function getOnlineStatusInfo(lastSeen?: string) {
  if (!lastSeen) return { isOnline: false, text: "Oflayn" };
  const seenDate = new Date(lastSeen).getTime();
  if (isNaN(seenDate)) return { isOnline: false, text: "Oflayn" };

  const now = Date.now();
  const diffMs = now - seenDate;
  
  if (diffMs < 180000) {
    return { isOnline: true, text: "Hozir tarmoqda (Online)" };
  }

  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) {
    return { isOnline: false, text: `${diffMins} daqiqa oldin tarmoqda edi` };
  }

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return { isOnline: false, text: `${diffHours} soat oldin tarmoqda edi` };
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return { isOnline: false, text: `${diffDays} kun oldin tarmoqda edi` };
  }

  return { isOnline: false, text: "Uzoq vaqt oldin tarmoqda edi" };
}

export default function Profil() {
  const params = useParams();
  const targetId = params.id;
  const { user: currentUser, token, login } = useAuth();

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editBannerUrl, setEditBannerUrl] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editTelegram, setEditTelegram] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [editTiktok, setEditTiktok] = useState('');
  const [editYoutube, setEditYoutube] = useState('');
  const [editDiscord, setEditDiscord] = useState('');
  const [editFacebook, setEditFacebook] = useState('');
  const [editVk, setEditVk] = useState('');

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // User-Uploaded Reels State
  const [userReels, setUserReels] = useState<any[]>([]);
  const [loadingReels, setLoadingReels] = useState(false);
  const [showAddReelModal, setShowAddReelModal] = useState(false);
  const [reelTitle, setReelTitle] = useState('');
  const [reelAnimeTitle, setReelAnimeTitle] = useState('');
  const [reelVideoUrl, setReelVideoUrl] = useState('');
  const [selectedReelFileName, setSelectedReelFileName] = useState('');
  const [reelThumbnailUrl, setReelThumbnailUrl] = useState('');
  const [reelTags, setReelTags] = useState('');
  const [uploadingReel, setUploadingReel] = useState(false);
  const [reelUploadError, setReelUploadError] = useState('');
  const [activePreviewReel, setActivePreviewReel] = useState<any | null>(null);

  // Format watch time accurately into hours and minutes in Uzbek
  const formatWatchTime = (minutes?: number) => {
    const mins = Number(minutes) || 0;
    if (mins <= 0) return "0 daqiqa";
    const hours = Math.floor(mins / 60);
    const remainderMins = mins % 60;
    if (hours > 0 && remainderMins > 0) {
      return `${hours} soat ${remainderMins} daq`;
    } else if (hours > 0) {
      return `${hours} soat`;
    } else {
      return `${remainderMins} daqiqa`;
    }
  };

  // Load user profile
  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    const idToFetch = targetId || currentUser?.id;
    if (!idToFetch) {
      setLoading(false);
      return;
    }

    const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let retries = 3;
    let delay = 600;

    while (retries > 0) {
      try {
        const res = await fetch(`${API_BASE}/api/user/${idToFetch}`, { headers });
        const contentType = res.headers.get("content-type");
        
        if (!res.ok) {
          if (contentType && contentType.includes("application/json")) {
            const errData = await res.json();
            throw new Error(errData.error || "Foydalanuvchi topilmadi");
          }
          throw new Error(`Server xatosi (${res.status})`);
        }

        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Noto'g'ri server javobi");
        }

        const data = await res.json();

        const isUserOwner = Boolean(data.isOwner || (currentUser && String(currentUser.id) === String(data.user.id)));
        setIsOwner(isUserOwner);

        // Auto-sync owner's local favorites and watch history to server if needed
        if (isUserOwner && token) {
          const savedFavs = localStorage.getItem('anime_favorites');
          const savedHist = localStorage.getItem('anime_history');

          if (savedFavs && (!data.user.favorites || data.user.favorites.length === 0)) {
            try {
              const favIds = JSON.parse(savedFavs);
              if (Array.isArray(favIds) && favIds.length > 0) {
                fetch(`${API_BASE}/api/user/favorites`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({ favorites: favIds })
                }).catch(() => {});
              }
            } catch (e) {}
          }

          if (savedHist && (!data.user.watch_time_minutes || data.user.watch_time_minutes === 0)) {
            try {
              const histItems = JSON.parse(savedHist);
              if (Array.isArray(histItems) && histItems.length > 0) {
                const totalMins = histItems.reduce((acc: number, item: any) => acc + (Number(item.lastEpisode || 1) * 24), 0);
                fetch(`${API_BASE}/api/user/watch-progress`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({ total_minutes: totalMins })
                }).catch(() => {});
                data.user.watch_time_minutes = totalMins;
              }
            } catch (e) {}
          }
        }

        setProfileUser(data.user);
        
        // Populate edit state values
        setEditName(data.user.name || '');
        setEditBio(data.user.bio || '');
        setEditBannerUrl(data.user.banner_url || '');
        setEditAvatarUrl(data.user.avatar_url || '');
        setEditTelegram(data.user.telegram || '');
        setEditInstagram(data.user.instagram || '');
        setEditTiktok(data.user.tiktok || '');
        setEditYoutube(data.user.youtube || '');
        setEditDiscord(data.user.discord || '');
        setEditFacebook(data.user.facebook || '');
        setEditVk(data.user.vk || '');
        setLoading(false);

        // Fetch user uploaded reels from MySQL
        fetchUserReels(data.user.id);
        return; // Success
      } catch (err: any) {
        retries--;
        console.warn(`Profil yuklashda urinish muvaffaqiyatsiz bo'ldi. Qolgan urinishlar: ${retries}`, err);
        if (retries === 0) {
          const rawMsg = err.message || '';
          if (rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')) {
            setError("Server bilan aloqa o'rnatib bo'lmadi. Iltimos, qayta urinib ko'ring.");
          } else {
            setError(rawMsg || "Profilni yuklashda xatolik yuz berdi");
          }
          setLoading(false);
        } else {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.5;
        }
      }
    }
  };

  const fetchUserReels = async (userId: string | number) => {
    setLoadingReels(true);
    try {
      const res = await fetch(`/api/user/${userId}/reels`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setUserReels(data);
      }
    } catch (e) {
      console.warn("User reels fetch error:", e);
    } finally {
      setLoadingReels(false);
    }
  };

  const handleUploadReelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!token) {
      setReelUploadError("Video yuklash uchun avval tizimga kiring!");
      return;
    }

    const isAdmin = currentUser?.role === 'admin';
    const MAX_USER_SIZE = 15 * 1024 * 1024; // 15 MB
    if (!isAdmin && file.size > MAX_USER_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setReelUploadError(`Oddiy foydalanuvchilar uchun maksimal video hajmi 15 MB. Siz tanlagan fayl hajmi: ${sizeMB} MB. Iltimos 15 MB dan kichik video tanlang!`);
      return;
    }

    setUploadingReel(true);
    setReelUploadError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/reels/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      let data: any = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(res.status === 413 ? "Video hajmi juda katta!" : (text.slice(0, 80) || "Serverda xatolik yuz berdi"));
      }

      if (res.ok && data?.url) {
        setReelVideoUrl(data.url);
        const sizeFormatted = (file.size / (1024 * 1024)).toFixed(1);
        setSelectedReelFileName(`${file.name} (${sizeFormatted} MB)`);
      } else {
        setReelUploadError(data?.error || "Video yuklashda xatolik yuz berdi");
      }
    } catch (err: any) {
      setReelUploadError(err?.message || "Video yuklashda xatolik yuz berdi");
    } finally {
      setUploadingReel(false);
    }
  };

  const handleCreateUserReel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reelVideoUrl.trim()) {
      setReelUploadError("Iltimos, avval video faylini tanlang!");
      return;
    }

    if (!token) {
      setReelUploadError("Avval tizimga kiring!");
      return;
    }

    setUploadingReel(true);
    setReelUploadError('');

    try {
      const res = await fetch('/api/reels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: reelTitle || "Anime Reel",
          anime_title: reelAnimeTitle || "Anime",
          video_url: reelVideoUrl,
          thumbnail_url: reelThumbnailUrl,
          tags: reelTags
        })
      });

      let data: any = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        throw new Error("Serverda kutilmagan xatolik yuz berdi");
      }

      if (data?.success && data?.reel) {
        setUserReels(prev => [data.reel, ...prev]);
        setShowAddReelModal(false);
        setReelTitle('');
        setReelAnimeTitle('');
        setReelVideoUrl('');
        setSelectedReelFileName('');
        setReelThumbnailUrl('');
        setReelTags('');
      } else {
        setReelUploadError(data.error || "Reel yaratishda xatolik");
      }
    } catch (err: any) {
      setReelUploadError(err?.message || "Reel yaratishda xatolik");
    } finally {
      setUploadingReel(false);
    }
  };

  const handleDeleteUserReel = async (reelId: number | string) => {
    if (!window.confirm("Haqiqatdan ham ushbu videoni o'chirmoqchimisiz?")) return;
    try {
      const res = await fetch(`/api/reels/${reelId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data?.success) {
        setUserReels(prev => prev.filter(r => String(r.id) !== String(reelId)));
      } else {
        alert(data.error || "O'chirishda xatolik yuz berdi");
      }
    } catch (err: any) {
      alert(err?.message || "O'chirishda xatolik");
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [targetId, currentUser, token]);

  // Client-side image compression
  const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setUploadingAvatar(true);
    try {
      const resizedBase64 = await resizeImage(file, 250, 250);
      setEditAvatarUrl(resizedBase64);

      const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
      const res = await fetch(`${API_BASE}/api/user/avatar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ avatar_url: resizedBase64 })
      });

      const data = await res.json();
      if (res.ok) {
        setProfileUser(prev => prev ? { ...prev, avatar_url: resizedBase64 } : null);
        if (currentUser && data.user) {
          login(token, { ...currentUser, avatar_url: resizedBase64 });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setUploadingBanner(true);
    try {
      const resizedBase64 = await resizeImage(file, 1000, 400);
      setEditBannerUrl(resizedBase64);

      const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
      await fetch(`${API_BASE}/api/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName || profileUser?.name,
          banner_url: resizedBase64
        })
      });

      setProfileUser(prev => prev ? { ...prev, banner_url: resizedBase64 } : null);
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !token) return;

    setSaving(true);
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
      const payload = {
        name: editName.trim(),
        bio: editBio,
        banner_url: editBannerUrl,
        avatar_url: editAvatarUrl,
        telegram: editTelegram,
        instagram: editInstagram,
        tiktok: editTiktok,
        youtube: editYoutube,
        discord: editDiscord,
        facebook: editFacebook,
        vk: editVk
      };

      const res = await fetch(`${API_BASE}/api/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Profilni saqlashda xatolik");
      }

      setProfileUser(prev => prev ? {
        ...prev,
        ...payload
      } : null);

      if (currentUser && data.user) {
        login(data.token || token, { ...currentUser, name: editName.trim(), avatar_url: editAvatarUrl || currentUser.avatar_url });
      }

      setIsEditing(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Saqlashda xatolik");
    } finally {
      setSaving(false);
    }
  };

  // Format social link for external redirect
  const formatSocialUrl = (platform: string, handleOrUrl: string) => {
    if (!handleOrUrl) return '#';
    const trimmed = handleOrUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    const cleanHandle = trimmed.replace(/^@/, '');
    switch (platform) {
      case 'telegram': return `https://t.me/${cleanHandle}`;
      case 'instagram': return `https://instagram.com/${cleanHandle}`;
      case 'tiktok': return `https://tiktok.com/@${cleanHandle}`;
      case 'youtube': return `https://youtube.com/${cleanHandle.startsWith('c/') || cleanHandle.startsWith('@') ? cleanHandle : '@' + cleanHandle}`;
      case 'facebook': return `https://facebook.com/${cleanHandle}`;
      case 'discord': return `https://discord.com/users/${cleanHandle}`;
      case 'vk': return `https://vk.com/${cleanHandle}`;
      default: return trimmed;
    }
  };

  if (loading) {
    return <LoadingScreen size="lg" />;
  }

  // If user is not logged in and didn't specify another user's id
  if (!targetId && !currentUser) {
    return (
      <div className="max-w-md mx-auto py-16 px-6 text-center space-y-5 bg-[#111] border border-[#222] rounded-2xl shadow-xl my-8">
        <div className="w-16 h-16 bg-[#ff006a]/10 border border-[#ff006a]/30 text-[#ff006a] rounded-full flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(255,0,106,0.2)]">
          <LogIn size={28} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white uppercase tracking-wide">Profilga kirish talab qilinadi</h2>
          <p className="text-white/50 text-xs leading-relaxed">
            Shaxsiy profilingiz, tomosha tarixingiz va saqlangan animelaringizni ko'rish uchun tizimga kiring.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link 
            to="/login" 
            className="bg-[#ff006a] hover:bg-[#ff006a]/90 text-white px-6 py-2.5 rounded-lg text-xs font-bold uppercase transition-all shadow-[0_0_15px_rgba(255,0,106,0.3)]"
          >
            Kirish
          </Link>
          <Link 
            to="/register" 
            className="bg-[#18181c] hover:bg-[#222] text-white/80 hover:text-white border border-[#333] px-6 py-2.5 rounded-lg text-xs font-bold uppercase transition-all"
          >
            Ro'yxatdan o'tish
          </Link>
        </div>
      </div>
    );
  }

  if (error || !profileUser) {
    return (
      <div className="max-w-md mx-auto py-16 px-6 text-center space-y-5 bg-[#111] border border-[#222] rounded-2xl shadow-xl my-8">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
          <Shield size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white uppercase">{error || "Foydalanuvchi topilmadi"}</h2>
          <p className="text-white/40 text-xs">
            Server bilan bog'lanishda muammo bo'lishi mumkin. Qaytadan urinib ko'ring.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <button
            onClick={() => fetchProfile()}
            className="inline-flex items-center gap-2 bg-[#ff006a] hover:bg-[#ff006a]/90 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase transition-all shadow-[0_0_15px_rgba(255,0,106,0.3)]"
          >
            <RotateCcw size={14} /> Qayta urinish
          </button>
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 bg-[#18181c] hover:bg-[#222] text-white/80 hover:text-white border border-[#333] px-5 py-2.5 rounded-lg text-xs font-bold uppercase transition-all"
          >
            Bosh sahifaga
          </Link>
        </div>
      </div>
    );
  }

  const socialLinks = [
    { key: 'telegram', label: 'Telegram', value: profileUser.telegram, icon: TelegramIcon, glow: 'hover:shadow-[0_0_20px_rgba(0,136,204,0.7)]' },
    { key: 'instagram', label: 'Instagram', value: profileUser.instagram, icon: InstagramIcon, glow: 'hover:shadow-[0_0_20px_rgba(225,48,108,0.7)]' },
    { key: 'youtube', label: 'YouTube', value: profileUser.youtube, icon: YouTubeIcon, glow: 'hover:shadow-[0_0_20px_rgba(255,0,0,0.7)]' },
    { key: 'discord', label: 'Discord', value: profileUser.discord, icon: DiscordIcon, glow: 'hover:shadow-[0_0_20px_rgba(88,101,242,0.7)]' },
    { key: 'facebook', label: 'Facebook', value: profileUser.facebook, icon: FacebookIcon, glow: 'hover:shadow-[0_0_20px_rgba(24,119,242,0.7)]' },
    { key: 'tiktok', label: 'TikTok', value: profileUser.tiktok, icon: TikTokIcon, glow: 'hover:shadow-[0_0_20px_rgba(37,244,238,0.7)]' },
    { key: 'vk', label: 'VKontakte', value: profileUser.vk, icon: VKIcon, glow: 'hover:shadow-[0_0_20px_rgba(0,119,255,0.7)]' },
  ].filter(s => Boolean(s.value));

  const favoritesList: Anime[] = Array.isArray(profileUser.favorites) ? profileUser.favorites : [];

  const handleRemoveFavorite = async (e: React.MouseEvent, animeId: string | number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) return;

    const updated = favoritesList.filter(a => String(a.id) !== String(animeId));
    setProfileUser(prev => prev ? { ...prev, favorites: updated } : null);

    // update localStorage
    const savedFavs = localStorage.getItem('anime_favorites');
    if (savedFavs) {
      try {
        const favIds = JSON.parse(savedFavs).filter((id: any) => String(id) !== String(animeId));
        localStorage.setItem('anime_favorites', JSON.stringify(favIds));
      } catch (e) {}
    }

    const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
    fetch(`${API_BASE}/api/user/favorites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ favorites: updated.map(a => a.id) })
    }).catch(() => {});
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      
      {/* BANNER & AVATAR HEADER */}
      <div className="relative bg-[#111] border border-[#222] rounded-2xl overflow-hidden shadow-2xl">
        
        {/* Banner Container */}
        <div className="relative w-full h-48 sm:h-64 md:h-72 bg-[#1a1a1c] overflow-hidden">
          <img loading="lazy" decoding="async" 
            src={profileUser.banner_url || DEFAULT_BANNER} 
            alt="User Banner" 
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-[#111]/40 to-transparent" />

          {/* Banner Upload Button (For Owner) */}
          {isOwner && (
            <label className="absolute top-4 right-4 bg-black/70 hover:bg-black/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-white/20 cursor-pointer backdrop-blur-md transition-all flex items-center gap-1.5 z-10 shadow-lg">
              <Camera size={14} className="text-[#ff006a]" />
              <span>{uploadingBanner ? "Yuklanmoqda..." : "Muqovani almashtirish"}</span>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleBannerUpload}
                disabled={uploadingBanner}
              />
            </label>
          )}
        </div>

        {/* Profile Content Overlay */}
        <div className="px-6 pb-6 pt-0 relative flex flex-col md:flex-row items-center md:items-end justify-between gap-6 -mt-16 sm:-mt-20">
          
          {/* Avatar & Basic Info */}
          <div className="flex flex-col md:flex-row items-center md:items-end gap-5 text-center md:text-left">
            
            {/* Avatar Circle */}
            <div className="relative shrink-0 group">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-[#111] bg-[#1c1c1e] overflow-hidden flex items-center justify-center text-4xl sm:text-5xl font-black text-[#ff006a] uppercase shadow-[0_0_30px_rgba(255,0,106,0.3)] relative">
                {profileUser.avatar_url ? (
                  <img loading="lazy" decoding="async" src={profileUser.avatar_url} alt={profileUser.name} className="w-full h-full object-cover" />
                ) : (
                  profileUser.name.charAt(0)
                )}

                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                    <Loader2 size={28} className="text-[#ff006a] animate-spin" />
                  </div>
                )}
              </div>

              {/* Avatar Upload Button */}
              {isOwner && (
                <label className="absolute bottom-1 right-1 bg-[#ff006a] hover:bg-[#d40058] text-white p-2 rounded-full border-2 border-[#111] cursor-pointer shadow-lg transition-transform hover:scale-110 flex items-center justify-center">
                  <Camera size={14} />
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                  />
                </label>
              )}
            </div>

            {/* Name, Role & Bio summary */}
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wide text-white drop-shadow">
                  {profileUser.name}
                </h1>

                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-sm ${
                  profileUser.role === 'admin' 
                    ? 'bg-red-500/20 border-red-500/40 text-red-400' 
                    : 'bg-[#ff006a]/20 border-[#ff006a]/40 text-[#ff006a]'
                }`}>
                  {profileUser.role === 'admin' ? '⚡ ADMIN' : '✨ PREMIUM'}
                </span>

                {/* ONLINE / OFFLINE STATUS BADGE */}
                {(() => {
                  const status = getOnlineStatusInfo(profileUser.last_seen);
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold border ${
                      status.isOnline 
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.2)]' 
                        : 'bg-white/5 border-white/10 text-white/50'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${status.isOnline ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]' : 'bg-white/30'}`} />
                      <span>{status.text}</span>
                    </span>
                  );
                })()}

                {/* Round Social Buttons Quick Row in Header */}
                {socialLinks.length > 0 && (
                  <div className="flex items-center gap-2 ml-1">
                    {socialLinks.map((social) => {
                      const IconComponent = social.icon;
                      const href = formatSocialUrl(social.key, social.value!);
                      return (
                        <a
                          key={social.key}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`${social.label}: ${social.value}`}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all transform hover:scale-110 ${social.glow} border border-white/10 bg-black/40`}
                        >
                          <IconComponent className="w-8 h-8" size={32} />
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              {profileUser.bio ? (
                <p className="text-white/80 text-xs sm:text-sm max-w-xl line-clamp-2 italic font-sans">
                  "{profileUser.bio}"
                </p>
              ) : (
                <p className="text-white/40 text-xs font-mono">
                  {isOwner ? "Bio yozilmagan. Profilni tahrirlash orqali bio qo'shing!" : "Foydalanuvchi bio yozmagan."}
                </p>
              )}
            </div>

          </div>

          {/* Edit & Add Reel Action Buttons */}
          {isOwner && (
            <div className="shrink-0 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowAddReelModal(true)}
                className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs px-4 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(236,72,153,0.35)] flex items-center gap-2 uppercase tracking-wider cursor-pointer active:scale-95 border border-pink-400/30"
              >
                <Film size={14} /> Reel Qo'shish
              </button>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="bg-[#ff006a] hover:bg-[#d40058] text-white font-bold text-xs px-4 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(255,0,106,0.25)] flex items-center gap-2 uppercase tracking-wider cursor-pointer"
              >
                <Edit3 size={14} /> Tahrirlash
              </button>
            </div>
          )}

        </div>
      </div>

      {/* EDIT MODAL / INLINE EDITOR (Owner Only) */}
      <AnimatePresence>
        {isEditing && isOwner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#111] border border-[#ff006a]/30 rounded-2xl p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-[#222] pb-3">
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={18} className="text-[#ff006a]" /> Profil Ma'lumotlarini Tahrirlash
              </h3>
              <button onClick={() => setIsEditing(false)} className="text-white/50 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              
              {/* Name & Bio */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-white/70 uppercase mb-1">Ism va Familiya</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full bg-[#000] border border-[#222] rounded-lg px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#ff006a]"
                    placeholder="Ismingizni kiriting"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/70 uppercase mb-1">Bio (O'zingiz haqingizda status)</label>
                  <input
                    type="text"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full bg-[#000] border border-[#222] rounded-lg px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#ff006a]"
                    placeholder="Masalan: Anime ixlosmandi va manga ishqibozi..."
                  />
                </div>
              </div>

              {/* Banner & Avatar URLs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-white/70 uppercase mb-1">Banner Rasm Havolasi (URL)</label>
                  <input
                    type="url"
                    value={editBannerUrl}
                    onChange={(e) => setEditBannerUrl(e.target.value)}
                    className="w-full bg-[#000] border border-[#222] rounded-lg px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#ff006a]"
                    placeholder="https://.../banner.jpg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/70 uppercase mb-1">Avatar Rasm Havolasi (URL)</label>
                  <input
                    type="url"
                    value={editAvatarUrl}
                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                    className="w-full bg-[#000] border border-[#222] rounded-lg px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#ff006a]"
                    placeholder="https://.../avatar.jpg"
                  />
                </div>
              </div>

              {/* Social Media Links Inputs */}
              <div className="border-t border-[#222] pt-4">
                <h4 className="text-xs font-bold text-[#ff006a] uppercase tracking-wider mb-3">
                  Ijtimoiy Tarmoq Sahifalari (Telegram, Instagram, YouTube, Discord, Facebook, TikTok, VK)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-white/50 mb-1">Telegram (username yoki havola)</label>
                    <input
                      type="text"
                      value={editTelegram}
                      onChange={(e) => setEditTelegram(e.target.value)}
                      placeholder="@username yoki t.me/username"
                      className="w-full bg-[#000] border border-[#222] rounded-lg px-3 py-2 text-white text-xs focus:border-[#0088cc]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-white/50 mb-1">Instagram (username)</label>
                    <input
                      type="text"
                      value={editInstagram}
                      onChange={(e) => setEditInstagram(e.target.value)}
                      placeholder="@username"
                      className="w-full bg-[#000] border border-[#222] rounded-lg px-3 py-2 text-white text-xs focus:border-[#e1306c]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-white/50 mb-1">YouTube (Kanal havolasi)</label>
                    <input
                      type="text"
                      value={editYoutube}
                      onChange={(e) => setEditYoutube(e.target.value)}
                      placeholder="youtube.com/@channel"
                      className="w-full bg-[#000] border border-[#222] rounded-lg px-3 py-2 text-white text-xs focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-white/50 mb-1">Discord (Tag yoki invite)</label>
                    <input
                      type="text"
                      value={editDiscord}
                      onChange={(e) => setEditDiscord(e.target.value)}
                      placeholder="username#0000 yoki invite"
                      className="w-full bg-[#000] border border-[#222] rounded-lg px-3 py-2 text-white text-xs focus:border-[#5865F2]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-white/50 mb-1">Facebook (Profil havolasi)</label>
                    <input
                      type="text"
                      value={editFacebook}
                      onChange={(e) => setEditFacebook(e.target.value)}
                      placeholder="facebook.com/username"
                      className="w-full bg-[#000] border border-[#222] rounded-lg px-3 py-2 text-white text-xs focus:border-[#1877F2]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-white/50 mb-1">TikTok (username)</label>
                    <input
                      type="text"
                      value={editTiktok}
                      onChange={(e) => setEditTiktok(e.target.value)}
                      placeholder="@username"
                      className="w-full bg-[#000] border border-[#222] rounded-lg px-3 py-2 text-white text-xs focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-white/50 mb-1">VK / VKontakte (username yoki id)</label>
                    <input
                      type="text"
                      value={editVk}
                      onChange={(e) => setEditVk(e.target.value)}
                      placeholder="vk.com/username yoki id"
                      className="w-full bg-[#000] border border-[#222] rounded-lg px-3 py-2 text-white text-xs focus:border-[#0077FF]"
                    />
                  </div>
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-[#222]">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-5 py-2.5 bg-[#222] hover:bg-[#333] text-white rounded-lg text-xs font-bold uppercase"
                >
                  Bekor qilish
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-[#ff006a] hover:bg-[#d40058] text-white rounded-lg text-xs font-bold uppercase flex items-center gap-2 shadow-lg"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Saqlash</span>
                </button>
              </div>

            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SOCIAL LINKS DISPLAY SECTION */}
      {socialLinks.length > 0 && (
        <div className="bg-[#111] border border-[#222] rounded-2xl p-5 shadow-lg">
          <h3 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Globe size={16} className="text-[#ff006a]" /> Ijtimoiy Tarmoq Sahifalari
          </h3>
          <div className="flex flex-wrap gap-3">
            {socialLinks.map((social) => {
              const IconComp = social.icon;
              const href = formatSocialUrl(social.key, social.value!);
              return (
                <a
                  key={social.key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`bg-[#18181c] border border-white/10 hover:border-[#ff006a]/50 p-2 pr-4 rounded-full text-xs font-bold flex items-center gap-3 transition-all transform hover:-translate-y-0.5 ${social.glow} group cursor-pointer`}
                >
                  <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center overflow-hidden">
                    <IconComp className="w-9 h-9" size={36} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] text-white/40 uppercase font-extrabold tracking-wider leading-none mb-0.5">{social.label}</span>
                    <span className="text-white text-xs font-medium font-mono truncate max-w-[140px] group-hover:text-[#ff006a] transition-colors">{social.value}</span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* STATS COUNTER BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#111] border border-[#222] p-5 rounded-2xl text-center space-y-1 hover:border-[#ff006a]/30 transition-colors">
          <Clock className="w-6 h-6 text-[#ff006a] mx-auto" />
          <h4 className="text-white/40 text-[10px] uppercase font-bold tracking-wider">Tomosha vaqti</h4>
          <p className="text-2xl font-black text-white">{formatWatchTime(profileUser.watch_time_minutes)}</p>
          <span className="text-[10px] text-white/30 font-mono block">Aniq tomosha davomiyligi</span>
        </div>

        <div className="bg-[#111] border border-[#222] p-5 rounded-2xl text-center space-y-1 hover:border-[#ff006a]/30 transition-colors">
          <Heart className="w-6 h-6 text-[#ff006a] mx-auto fill-current" />
          <h4 className="text-white/40 text-[10px] uppercase font-bold tracking-wider">Saqlangan animelar</h4>
          <p className="text-2xl font-black text-white">{favoritesList.length} ta</p>
          <span className="text-[10px] text-white/30 font-mono block">Sevimlilar ro'yxatida</span>
        </div>

        <div className="bg-[#111] border border-[#222] p-5 rounded-2xl text-center space-y-1 hover:border-[#ff006a]/30 transition-colors">
          <MessageSquare className="w-6 h-6 text-[#ff006a] mx-auto" />
          <h4 className="text-white/40 text-[10px] uppercase font-bold tracking-wider">Jami Izohlar</h4>
          <p className="text-2xl font-black text-white">{profileUser.comments_count || 0} ta</p>
          <span className="text-[10px] text-white/30 font-mono block">Qoldirilgan fikrlar</span>
        </div>
      </div>

      {/* SAVED / FAVORITE ANIMELAR DISPLAY GRID */}
      <div className="bg-[#111] border border-[#222] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#222] pb-4">
          <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Film size={18} className="text-[#ff006a]" /> Saqlangan Animelar ({favoritesList.length})
          </h3>

          {isOwner && (
            <Link to="/sevimlilar" className="text-xs text-[#ff006a] hover:underline font-bold flex items-center gap-1">
              Barchasini Boshqarish <ArrowRight size={13} />
            </Link>
          )}
        </div>

        {favoritesList.length === 0 ? (
          <div className="text-center py-12 text-white/30 space-y-3">
            <Film className="w-12 h-12 mx-auto text-white/20" />
            <p className="text-xs font-mono">Hozircha birorta ham anime saqlanmagan.</p>
            {isOwner && (
              <Link
                to="/animelar"
                className="inline-block bg-[#ff006a]/20 hover:bg-[#ff006a] text-[#ff006a] hover:text-white border border-[#ff006a]/30 px-4 py-2 rounded-lg text-xs font-bold transition-all"
              >
                Animelarni ko'rish va saqlash
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {favoritesList.map((anime) => (
              <div 
                key={anime.id} 
                className="bg-[#161618] border border-[#222] rounded-xl overflow-hidden group hover:border-[#ff006a]/50 transition-all flex flex-col relative"
              >
                {/* Anime Poster */}
                <Link to={`/anime/${toSlug(anime.title)}`} className="relative block p-[2px] rounded-xl bg-gradient-to-b from-white/20 via-white/5 to-[#ff006a]/25 group-hover:from-[#ff006a] group-hover:to-purple-600 transition-all duration-500">
                  <div className="aspect-[3/4] relative overflow-hidden rounded-[10px] bg-black">
                    <img loading="lazy" decoding="async" 
                      src={anime.image_url} 
                      alt={anime.title} 
                      className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-300"
                    />
                    <div className="absolute top-1.5 left-1.5 w-2 h-2 border-t-2 border-l-2 border-white/50 group-hover:border-[#ff006a] rounded-tl-sm pointer-events-none" />
                    <div className="absolute top-1.5 right-1.5 w-2 h-2 border-t-2 border-r-2 border-white/50 group-hover:border-[#ff006a] rounded-tr-sm pointer-events-none" />
                    <div className="absolute bottom-1.5 left-1.5 w-2 h-2 border-b-2 border-l-2 border-white/50 group-hover:border-[#ff006a] rounded-bl-sm pointer-events-none" />
                    <div className="absolute bottom-1.5 right-1.5 w-2 h-2 border-b-2 border-r-2 border-white/50 group-hover:border-[#ff006a] rounded-br-sm pointer-events-none" />
                    
                    {anime.rating && (
                      <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-md border border-yellow-500/30 text-yellow-400 font-bold text-[10px] flex items-center gap-1">
                        <Star size={10} className="fill-current" /> {Number(anime.rating).toFixed(1)}
                      </div>
                    )}

                    {/* Remove favorite quick button for owner */}
                    {isOwner && (
                      <button
                        onClick={(e) => handleRemoveFavorite(e, anime.id)}
                        title="Saqlanganlardan o'chirish"
                        className="absolute top-2 left-2 bg-black/80 hover:bg-red-500 text-white/70 hover:text-white p-1.5 rounded-md border border-white/10 backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 z-10"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </Link>

                {/* Anime Info */}
                <div className="p-3 flex flex-col flex-1 justify-between">
                  <Link to={`/anime/${toSlug(anime.title)}`} className="text-xs font-bold text-white group-hover:text-[#ff006a] transition-colors line-clamp-1 block">
                    {anime.title}
                  </Link>

                  <div className="mt-2 pt-2 border-t border-[#222] flex items-center justify-between text-[10px] text-white/40">
                    <span>{anime.qismlar_soni || 12}-qism</span>
                    <Link to={`/anime/${toSlug(anime.title)}`} className="text-[#ff006a] font-bold hover:underline">
                      Ko'rish
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* USER-UPLOADED REELS SECTION */}
      <div className="bg-[#111] border border-[#222] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#222] pb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Film size={18} className="text-pink-500" />
            <h3 className="text-base font-bold text-white uppercase tracking-wider">
              Yuklangan Reels Videolar ({userReels.length})
            </h3>
          </div>

          <div className="flex items-center gap-3">
            <Link 
              to="/reels" 
              className="text-xs text-pink-400 hover:text-pink-300 font-bold flex items-center gap-1 hover:underline"
            >
              Reels bo'limiga o'tish <ArrowRight size={13} />
            </Link>

            {isOwner && (
              <button
                onClick={() => setShowAddReelModal(true)}
                className="bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Upload size={13} /> Video yuklash
              </button>
            )}
          </div>
        </div>

        {loadingReels ? (
          <div className="text-center py-12 text-white/40 space-y-2">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-pink-500" />
            <p className="text-xs font-mono">Reelslar yuklanmoqda...</p>
          </div>
        ) : userReels.length === 0 ? (
          <div className="text-center py-12 text-white/30 space-y-3">
            <Film className="w-12 h-12 mx-auto text-white/20" />
            <p className="text-xs font-mono">
              {isOwner 
                ? "Siz hali birorta ham reel yuklamagansiz. Yuqoridagi 'Video yuklash' tugmasi orqali ilk videongizni qo'shing!" 
                : "Ushbu foydalanuvchi hali birorta ham reel yuklamagan."}
            </p>
            {isOwner && (
              <button
                onClick={() => setShowAddReelModal(true)}
                className="inline-block bg-pink-600/20 hover:bg-pink-600 text-pink-300 hover:text-white border border-pink-500/30 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                + Ilk Reel videoni yuklash (15 MB gacha)
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {userReels.map((reel) => (
              <div 
                key={reel.id} 
                className="bg-[#161618] border border-[#222] rounded-xl overflow-hidden group hover:border-pink-500/50 transition-all flex flex-col relative shadow-lg"
              >
                {/* Reel Video Card (Vertical 9:16 Aspect) */}
                <div 
                  onClick={() => setActivePreviewReel(reel)}
                  className="aspect-[9/16] relative overflow-hidden rounded-t-xl bg-black cursor-pointer"
                >
                  {reel.thumbnail_url ? (
                    <img 
                      loading="lazy" 
                      src={reel.thumbnail_url} 
                      alt={reel.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <video 
                      src={reel.video_url} 
                      className="w-full h-full object-cover pointer-events-none opacity-80" 
                      muted 
                      preload="metadata"
                    />
                  )}

                  {/* Play Overlay */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-pink-600/90 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                      <Play size={18} className="fill-current ml-0.5" />
                    </div>
                  </div>

                  {/* Likes and Views counter overlay */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] text-white font-medium drop-shadow-md pointer-events-none">
                    <span className="flex items-center gap-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
                      <Heart size={10} className="fill-pink-500 text-pink-500" /> {reel.likes_count || 0}
                    </span>
                    <span className="flex items-center gap-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
                      <Eye size={10} /> {reel.views_count || 0}
                    </span>
                  </div>

                  {/* Delete button for Owner or Admin */}
                  {(isOwner || currentUser?.role === 'admin') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteUserReel(reel.id);
                      }}
                      title="Reelni o'chirish"
                      className="absolute top-2 right-2 bg-black/80 hover:bg-red-600 text-white/80 hover:text-white p-1.5 rounded-lg border border-white/10 backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {/* Reel Info */}
                <div className="p-2.5 flex flex-col flex-1 justify-between bg-[#111]">
                  <p 
                    onClick={() => setActivePreviewReel(reel)}
                    className="text-xs font-semibold text-white group-hover:text-pink-400 transition-colors line-clamp-2 cursor-pointer"
                  >
                    {reel.title}
                  </p>
                  {reel.anime_title && (
                    <span className="text-[10px] text-white/40 mt-1 truncate block">
                      {reel.anime_title}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ADD REEL MODAL (Responsive Mobile/Desktop) */}
      <AnimatePresence>
        {showAddReelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#16161d] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center space-x-2">
                  <Film className="w-5 h-5 text-pink-500" />
                  <h3 className="font-bold text-white text-base sm:text-lg">Reelsga Video Joylash</h3>
                </div>
                <button
                  onClick={() => setShowAddReelModal(false)}
                  className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {reelUploadError && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{reelUploadError}</span>
                </div>
              )}

              <form onSubmit={handleCreateUserReel} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">
                    Reel Sarlavhasi *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Masalan: Naruto eng kuchli hujumi! 🔥"
                    value={reelTitle}
                    onChange={(e) => setReelTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">
                    Anime Nomi
                  </label>
                  <input
                    type="text"
                    placeholder="Masalan: Naruto Shippuden"
                    value={reelAnimeTitle}
                    onChange={(e) => setReelAnimeTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                {/* Device Video File Upload */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-white/70">
                      Video fayli *
                    </label>
                    <span className="text-[10px] text-pink-400 font-medium">
                      {currentUser?.role === 'admin' ? "Admin: Cheksiz hajm" : "Maksimal: 15 MB"}
                    </span>
                  </div>
                  <label className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-pink-500/40 hover:border-pink-500 bg-pink-500/5 cursor-pointer transition-colors text-pink-300 text-xs text-center space-y-1">
                    <Upload className="w-5 h-5 mx-auto text-pink-400" />
                    <span className="font-semibold">
                      {uploadingReel ? "Video yuklanmoqda..." : "Videoni tanlash (MP4/WebM)"}
                    </span>
                    <span className="text-[10px] text-white/40">
                      {currentUser?.role === 'admin' 
                        ? "Adminlar uchun cheklovsiz video hajmi" 
                        : "15 MB gacha bo'lgan video fayllar"}
                    </span>
                    <input
                      type="file"
                      accept="video/mp4,video/webm"
                      className="hidden"
                      onChange={handleUploadReelFile}
                      disabled={uploadingReel}
                    />
                  </label>

                  {reelVideoUrl && (
                    <div className="mt-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 select-none">
                      <Check size={16} className="shrink-0 text-emerald-400" />
                      <span className="truncate font-medium">
                        ✓ Video muvaffaqiyatli tanlandi va yuklandi {selectedReelFileName ? `(${selectedReelFileName})` : ''}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">
                    Muqova (Poster / Thumbnail) Rasm URL (Ixtiyoriy)
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={reelThumbnailUrl}
                    onChange={(e) => setReelThumbnailUrl(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">
                    Teglar (Hashtaglar)
                  </label>
                  <input
                    type="text"
                    placeholder="#anime #naruto #uzb"
                    value={reelTags}
                    onChange={(e) => setReelTags(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowAddReelModal(false)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingReel || !reelVideoUrl}
                    className="px-5 py-2 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg cursor-pointer"
                  >
                    {uploadingReel ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>Joylash</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REEL PREVIEW MODAL */}
      <AnimatePresence>
        {activePreviewReel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-black rounded-2xl overflow-hidden border border-white/20 shadow-2xl flex flex-col"
            >
              <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-auto">
                <span className="bg-black/60 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full border border-white/10">
                  {activePreviewReel.anime_title || 'Anime Reel'}
                </span>
                <button
                  onClick={() => setActivePreviewReel(null)}
                  className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Video Player */}
              <div 
                className="aspect-[9/16] w-full bg-black flex items-center justify-center relative select-none"
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <video
                  src={activePreviewReel.video_url.endsWith('.m3u8') 
                    ? activePreviewReel.video_url.replace('.m3u8', '/video.mp4') 
                    : activePreviewReel.video_url}
                  controls
                  controlsList="nodownload noplaybackrate nofullscreen"
                  disablePictureInPicture
                  autoPlay
                  playsInline
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Bottom Info Bar */}
              <div className="p-4 bg-[#141417] border-t border-white/10 flex items-center justify-between">
                <div className="min-w-0 flex-1 pr-2">
                  <h4 className="text-white text-sm font-bold truncate">{activePreviewReel.title}</h4>
                  <p className="text-white/50 text-[11px] truncate">Muallif: @{activePreviewReel.author_name || 'Animem.uz'}</p>
                </div>
                <Link
                  to="/reels"
                  className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-lg shrink-0"
                >
                  Reelsda ko'rish
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ACCOUNT DETAILS & PRIVACY CARD */}
      <div className="bg-[#111] border border-[#222] rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Shield size={16} className="text-[#ff006a]" /> Tizim va Maxfiylik Ma'lumotlari
        </h3>

        <div className="space-y-3 text-xs font-mono">
          {/* EMAIL PRIVACY: EMAIL IS ONLY SHOWN IF ISOWNER IS TRUE */}
          {isOwner ? (
            <div className="flex justify-between py-2 border-b border-[#222] items-center">
              <span className="text-white/40 uppercase flex items-center gap-1.5">
                <Eye size={13} className="text-[#ff006a]" /> Email (Faqat sizga ko'rinadi):
              </span>
              <span className="text-white font-bold bg-[#1a1a1c] px-3 py-1 rounded border border-[#333]">
                {profileUser.email || currentUser?.email || 'Foydalanuvchi emaili'}
              </span>
            </div>
          ) : (
            <div className="flex justify-between py-2 border-b border-[#222] items-center text-white/40">
              <span className="uppercase flex items-center gap-1.5">
                <Lock size={13} className="text-white/30" /> Email Manzili:
              </span>
              <span className="italic text-[11px] text-white/30">Maxfiy (Boshqalarga ko'rinmaydi)</span>
            </div>
          )}

          <div className="flex justify-between py-2 border-b border-[#222] items-center">
            <span className="text-white/40 uppercase">Hisob Roli:</span>
            <span className="text-[#ff006a] font-bold uppercase">
              {profileUser.role === 'admin' ? 'ADMINISTRATOR' : 'PREMIUM FOYDALANUVCHI'}
            </span>
          </div>

          <div className="flex justify-between py-2 items-center">
            <span className="text-white/40 uppercase">A'zo bo'lingan sana:</span>
            <span className="text-white/80">
              {profileUser.created_at ? new Date(profileUser.created_at).toLocaleDateString() : '15.01.2024'}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
