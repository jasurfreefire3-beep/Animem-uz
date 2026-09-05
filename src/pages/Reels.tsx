import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  ChevronUp, 
  ChevronDown, 
  Plus, 
  Film, 
  Music2, 
  Sparkles,
  AlertCircle,
  X,
  Upload,
  Link as LinkIcon,
  Trash2
} from 'lucide-react';
import ReelsPlayer from '../components/ReelsPlayer';
import ReelsCommentsModal from '../components/ReelsCommentsModal';
import ReelsShareModal from '../components/ReelsShareModal';
import { Reel } from '../types';
import { useAuth } from '../context/AuthContext';

interface ReelsProps {
  currentUser?: any;
}

export default function Reels({ currentUser: propUser }: ReelsProps) {
  const { user: authUser } = useAuth();
  const currentUser = propUser || authUser;
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  
  // Modals state
  const [activeCommentsReel, setActiveCommentsReel] = useState<Reel | null>(null);
  const [activeShareReel, setActiveShareReel] = useState<Reel | null>(null);
  
  // Admin add reel modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newAnimeTitle, setNewAnimeTitle] = useState<string>('');
  const [newVideoUrl, setNewVideoUrl] = useState<string>('');
  const [newThumbnailUrl, setNewThumbnailUrl] = useState<string>('');
  const [newTags, setNewTags] = useState<string>('#anime #reels #animemuz');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [addError, setAddError] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef<boolean>(false);

  // Fetch reels from API
  const fetchReels = useCallback(() => {
    setLoading(true);
    const token = localStorage.getItem('token');
    fetch('/api/reels', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setReels(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Fetch reels failed:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchReels();
  }, [fetchReels]);

  // Scroll to index helper
  const scrollToIndex = useCallback((index: number) => {
    if (!containerRef.current) return;
    const target = containerRef.current.children[index] as HTMLElement;
    if (target) {
      isScrollingRef.current = true;
      target.scrollIntoView({ behavior: 'smooth' });
      setActiveIndex(index);
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 500);
    }
  }, []);

  const handleNext = () => {
    if (activeIndex < reels.length - 1) {
      scrollToIndex(activeIndex + 1);
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      scrollToIndex(activeIndex - 1);
    }
  };

  // Keyboard navigation (Up/Down or J/K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeCommentsReel || activeShareReel || showAddModal) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'm') {
        setIsMuted((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, reels.length, activeCommentsReel, activeShareReel, showAddModal]);

  // Track active slide using IntersectionObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isScrollingRef.current) {
            const index = Number(entry.target.getAttribute('data-index'));
            if (!isNaN(index) && index !== activeIndex) {
              setActiveIndex(index);
              // Report view count to server
              const reel = reels[index];
              if (reel?.id) {
                fetch(`/api/reels/${reel.id}/view`, { method: 'POST' }).catch(() => {});
              }
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.65,
      }
    );

    Array.from(container.children).forEach((child) => {
      observer.observe(child);
    });

    return () => {
      observer.disconnect();
    };
  }, [reels, activeIndex]);

  // Like / Unlike action
  const handleToggleLike = async (reelId: number | string) => {
    const token = localStorage.getItem('token');
    
    // Optimistic update
    setReels((prev) =>
      prev.map((r) => {
        if (String(r.id) === String(reelId)) {
          const currentlyLiked = Boolean(r.is_liked);
          return {
            ...r,
            is_liked: !currentlyLiked,
            likes_count: (r.likes_count || 0) + (currentlyLiked ? -1 : 1),
          };
        }
        return r;
      })
    );

    try {
      const res = await fetch(`/api/reels/${reelId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (data?.success) {
        setReels((prev) =>
          prev.map((r) =>
            String(r.id) === String(reelId)
              ? { ...r, is_liked: data.liked, likes_count: data.likes_count }
              : r
          )
        );
      }
    } catch (err) {
      console.error('Like request failed:', err);
    }
  };

  const handleDeleteReel = async (reelId: number | string) => {
    if (!window.confirm("Rostdan ham ushbu videoni o'chirmoqchimisiz?")) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/reels/${reelId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data?.success) {
        setReels((prev) => prev.filter((r) => String(r.id) !== String(reelId)));
        if (activeIndex >= reels.length - 1) {
          setActiveIndex(Math.max(0, reels.length - 2));
        }
      } else {
        alert(data?.error || "O'chirishda xatolik yuz berdi");
      }
    } catch (err: any) {
      alert(err?.message || "O'chirishda xatolik");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setAddError("Reel yuklash uchun avval tizimga kiring!");
      return;
    }

    const isAdmin = currentUser?.role === 'admin';
    const MAX_USER_SIZE = 15 * 1024 * 1024; // 15 MB
    if (!isAdmin && file.size > MAX_USER_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setAddError(`Oddiy foydalanuvchilar uchun maksimal video hajmi 15 MB. Siz tanlagan fayl hajmi: ${sizeMB} MB. Iltimos 15 MB dan kichik video tanlang!`);
      return;
    }

    setIsUploading(true);
    setAddError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/reels/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (data?.url) {
        setNewVideoUrl(data.url);
      } else {
        setAddError(data.error || "Video yuklashda xatolik");
      }
    } catch (err: any) {
      setAddError(err?.message || "Video yuklashda xatolik");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateReel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVideoUrl.trim()) {
      setAddError("Video manzili yoki fayli kiritilishi shart!");
      return;
    }

    const token = localStorage.getItem('token');
    setIsUploading(true);
    setAddError('');

    try {
      const res = await fetch('/api/reels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTitle || 'Anime Reel',
          anime_title: newAnimeTitle || 'Anime',
          video_url: newVideoUrl,
          thumbnail_url: newThumbnailUrl,
          tags: newTags,
        }),
      });

      const data = await res.json();
      if (data?.success && data?.reel) {
        setReels((prev) => [data.reel, ...prev]);
        setShowAddModal(false);
        setNewTitle('');
        setNewAnimeTitle('');
        setNewVideoUrl('');
        setNewThumbnailUrl('');
        setActiveIndex(0);
      } else {
        setAddError(data.error || "Reel yaratishda xatolik");
      }
    } catch (err: any) {
      setAddError(err?.message || "Reel yaratishda xatolik");
    } finally {
      setIsUploading(false);
    }
  };

  const formatCount = (count: number = 0) => {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-4">
        <div className="relative">
          <div className="w-14 h-14 border-4 border-pink-500/20 border-t-pink-500 rounded-full animate-spin" />
          <Film className="w-6 h-6 text-pink-500 absolute inset-0 m-auto" />
        </div>
        <p className="text-white/60 text-sm font-medium tracking-wide animate-pulse">
          Reels yuklanmoqda...
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[calc(100vh-65px)] md:h-[calc(100vh-70px)] bg-[#070709] overflow-hidden flex items-center justify-center">
      
      {/* Top Floating Header for Mobile & Desktop */}
      <div className="absolute top-3 left-0 right-0 z-40 px-4 flex items-center justify-between pointer-events-none">
        <div className="flex items-center space-x-2 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 pointer-events-auto shadow-lg">
          <Sparkles className="w-4 h-4 text-pink-400" />
          <span className="text-sm font-bold tracking-wider text-white">REELS</span>
        </div>

        {/* User / Admin Add Reel button */}
        <button
          onClick={() => {
            if (!currentUser) {
              alert("Reel qo'shish uchun avval profilingizga kiring!");
              return;
            }
            setShowAddModal(true);
          }}
          className="flex items-center space-x-1.5 bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg pointer-events-auto transition-all active:scale-95 border border-pink-400/30 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Reel qo'shish</span>
        </button>
      </div>

      {/* Desktop Up / Down Controls */}
      <div className="hidden lg:flex flex-col space-y-3 absolute right-8 top-1/2 -translate-y-1/2 z-30">
        <button
          onClick={handlePrev}
          disabled={activeIndex === 0}
          className="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 text-white transition-all backdrop-blur-md border border-white/10 shadow-xl active:scale-95"
          title="Oldingi reel (Yuqoriga strelka)"
        >
          <ChevronUp className="w-6 h-6" />
        </button>
        <button
          onClick={handleNext}
          disabled={activeIndex === reels.length - 1}
          className="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 text-white transition-all backdrop-blur-md border border-white/10 shadow-xl active:scale-95"
          title="Keyingi reel (Pastga strelka)"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
      </div>

      {/* Main Snap Container */}
      <div
        ref={containerRef}
        className="w-full h-full max-w-[430px] md:max-w-[420px] lg:max-w-[430px] mx-auto overflow-y-scroll snap-y snap-mandatory scrollbar-none flex flex-col relative"
        style={{ scrollBehavior: 'smooth' }}
      >
        {reels.map((reel, index) => {
          const isActive = index === activeIndex;

          return (
            <div
              key={reel.id}
              data-index={index}
              className="w-full h-full shrink-0 snap-start snap-always relative bg-black flex items-center justify-center overflow-hidden"
            >
              {/* PlayerJS / Fallback Video Element */}
              <ReelsPlayer
                id={reel.id}
                url={reel.video_url}
                poster={reel.thumbnail_url}
                title={reel.title}
                isActive={isActive}
                isMuted={isMuted}
                onToggleMute={() => setIsMuted((prev) => !prev)}
                onDoubleTapLike={() => handleToggleLike(reel.id)}
              />

              {/* Instagram-style Right Sidebar Actions */}
              <div className="absolute right-3.5 bottom-20 z-30 flex flex-col items-center space-y-4">
                {/* Author Avatar with Plus Badge */}
                <div className="relative mb-1">
                  <img
                    src={reel.author_avatar || 'https://files.catbox.moe/45hoi6.png'}
                    alt={reel.author_name}
                    className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-xl"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'https://files.catbox.moe/45hoi6.png';
                    }}
                  />
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-pink-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-md">
                    +
                  </div>
                </div>

                {/* Like Button */}
                <button
                  type="button"
                  onClick={() => handleToggleLike(reel.id)}
                  className="flex flex-col items-center space-y-1 text-white group active:scale-90 transition-transform"
                >
                  <div className={`p-3 rounded-full backdrop-blur-md transition-colors ${
                    reel.is_liked ? 'bg-pink-600/30 text-pink-500' : 'bg-black/40 hover:bg-black/60 text-white'
                  }`}>
                    <Heart
                      className={`w-7 h-7 transition-colors ${
                        reel.is_liked ? 'fill-pink-500 text-pink-500 animate-pulse' : 'text-white'
                      }`}
                    />
                  </div>
                  <span className="text-xs font-semibold drop-shadow-md">
                    {formatCount(reel.likes_count)}
                  </span>
                </button>

                {/* Comment Button */}
                <button
                  type="button"
                  onClick={() => setActiveCommentsReel(reel)}
                  className="flex flex-col items-center space-y-1 text-white group active:scale-90 transition-transform"
                >
                  <div className="p-3 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md transition-colors">
                    <MessageCircle className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-xs font-semibold drop-shadow-md">
                    {formatCount(reel.comments_count)}
                  </span>
                </button>

                {/* Share Button */}
                <button
                  type="button"
                  onClick={() => setActiveShareReel(reel)}
                  className="flex flex-col items-center space-y-1 text-white group active:scale-90 transition-transform"
                >
                  <div className="p-3 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md transition-colors">
                    <Share2 className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-xs font-semibold drop-shadow-md">
                    {formatCount(reel.shares_count)}
                  </span>
                </button>

                {/* Delete Button (Only for reel owner or admin) */}
                {(currentUser?.role === 'admin' || (currentUser?.id && Number(reel.user_id) === Number(currentUser.id))) && (
                  <button
                    type="button"
                    onClick={() => handleDeleteReel(reel.id)}
                    title="Reelni o'chirish"
                    className="flex flex-col items-center space-y-1 text-red-400 hover:text-red-300 group active:scale-90 transition-transform"
                  >
                    <div className="p-3 rounded-full bg-red-600/30 hover:bg-red-600/50 backdrop-blur-md border border-red-500/30 transition-colors">
                      <Trash2 className="w-6 h-6 text-red-300" />
                    </div>
                    <span className="text-[10px] font-semibold drop-shadow-md text-red-200">
                      O'chirish
                    </span>
                  </button>
                )}
              </div>

              {/* Bottom Metadata Overlay (Instagram Style) */}
              <div className="absolute left-0 right-16 bottom-4 z-30 p-4 pt-8 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none flex flex-col space-y-2">
                {/* Author Info & Tag */}
                <div className="flex items-center space-x-2 pointer-events-auto">
                  <span className="font-bold text-white text-sm drop-shadow-md hover:underline cursor-pointer">
                    @{reel.author_name || 'Animem.uz'}
                  </span>
                  {reel.anime_title && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-pink-500/30 text-pink-200 border border-pink-400/20 backdrop-blur-sm truncate max-w-[150px]">
                      {reel.anime_title}
                    </span>
                  )}
                </div>

                {/* Title and Hashtags */}
                <p className="text-white text-sm leading-snug drop-shadow-md line-clamp-2 select-text pointer-events-auto">
                  {reel.title}
                </p>

                {reel.tags && (
                  <div className="flex flex-wrap gap-1.5 text-xs text-pink-300/90 font-medium">
                    {reel.tags.split(' ').filter(Boolean).map((t, idx) => (
                      <span key={idx}>{t}</span>
                    ))}
                  </div>
                )}

                {/* Audio Ticker */}
                <div className="flex items-center space-x-2 text-white/80 text-xs font-medium pt-0.5 pointer-events-auto">
                  <Music2 className="w-3.5 h-3.5 animate-pulse text-pink-400 shrink-0" />
                  <span className="truncate">Asl audio - {reel.anime_title || 'Animem.uz'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comments Drawer Modal */}
      {activeCommentsReel && (
        <ReelsCommentsModal
          isOpen={Boolean(activeCommentsReel)}
          onClose={() => setActiveCommentsReel(null)}
          reelId={activeCommentsReel.id}
          commentsCount={activeCommentsReel.comments_count || 0}
          currentUser={currentUser}
          onCommentAdded={() => {
            setReels((prev) =>
              prev.map((r) =>
                String(r.id) === String(activeCommentsReel.id)
                  ? { ...r, comments_count: (r.comments_count || 0) + 1 }
                  : r
              )
            );
          }}
        />
      )}

      {/* Share Modal */}
      {activeShareReel && (
        <ReelsShareModal
          isOpen={Boolean(activeShareReel)}
          onClose={() => setActiveShareReel(null)}
          reel={activeShareReel}
          onShareSuccess={() => {
            setReels((prev) =>
              prev.map((r) =>
                String(r.id) === String(activeShareReel.id)
                  ? { ...r, shares_count: (r.shares_count || 0) + 1 }
                  : r
              )
            );
          }}
        />
      )}

      {/* Admin Add Reel Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#16161d] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center space-x-2">
                <Film className="w-5 h-5 text-pink-500" />
                <h3 className="font-bold text-white text-lg">Yangi Reel qo'shish</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addError && (
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreateReel} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1">
                  Reel sarlavhasi
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Solo Leveling - Jin-woo jangi! 🔥"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1">
                  Anime nomi
                </label>
                <input
                  type="text"
                  placeholder="Masalan: Solo Leveling"
                  value={newAnimeTitle}
                  onChange={(e) => setNewAnimeTitle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              {/* Video upload from device or URL */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-white/70">
                    Video fayli (Qurilmadan to'g'ridan-to'g'ri MySQL ga)
                  </label>
                  <span className="text-[10px] text-pink-400 font-medium">
                    {currentUser?.role === 'admin' ? "Admin: Hajm cheklovsiz" : "Maksimal: 15 MB"}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="flex-1 flex items-center justify-center space-x-2 px-3.5 py-2.5 rounded-xl border border-dashed border-pink-500/50 hover:border-pink-500 bg-pink-500/10 cursor-pointer transition-colors text-pink-300 text-xs font-medium">
                    <Upload className="w-4 h-4" />
                    <span>{isUploading ? "MySQL ga yuklanmoqda..." : "Videoni tanlang (MP4/WebM)"}</span>
                    <input
                      type="file"
                      accept="video/mp4,video/webm"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                    />
                  </label>
                </div>
                {newVideoUrl && (
                  <p className="text-[11px] text-emerald-400 mt-1 truncate">
                    ✓ Video saqlandi: {newVideoUrl}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1">
                  Yoki Video URL (Playerjs orqali o'ynatiladi)
                </label>
                <div className="flex items-center space-x-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <LinkIcon className="w-4 h-4 text-white/40 shrink-0" />
                  <input
                    type="text"
                    required
                    placeholder="https://... yoki /api/media/..."
                    value={newVideoUrl}
                    onChange={(e) => setNewVideoUrl(e.target.value)}
                    className="w-full bg-transparent text-sm text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1">
                  Muqova (Poster/Thumbnail) URL
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={newThumbnailUrl}
                  onChange={(e) => setNewThumbnailUrl(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1">
                  Teglar (Hashtags)
                </label>
                <input
                  type="text"
                  placeholder="#sololeveling #animeuz #reels"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="pt-2 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-sm transition-colors"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !newVideoUrl.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white font-semibold text-sm transition-all shadow-lg active:scale-95"
                >
                  {isUploading ? "Yuklanmoqda..." : "Saqlash"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
