import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Anime, toSlug, UserListStatus } from '../types';
import { 
  BookmarkCheck, 
  Tv, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Heart, 
  Trash2, 
  Play, 
  Star, 
  Search, 
  Filter, 
  Grid, 
  List, 
  ChevronRight,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { 
  getAllUserLists, 
  setUserListStatus, 
  USER_LIST_STATUSES, 
  getStatusConfig 
} from '../services/userListService';
import { getContinueWatchingList, getWatchedEpisodesMap } from '../services/watchProgressService';

export default function ShaxsiyRoyxat() {
  const { user, token } = useAuth();
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLists, setUserLists] = useState(getAllUserLists());
  const [activeTab, setActiveTab] = useState<UserListStatus | 'all' | 'continue'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [continueWatching, setContinueWatching] = useState(getContinueWatchingList());

  useEffect(() => {
    document.title = "Shaxsiy Ro'yxatim - Animem.uz";
    window.scrollTo(0, 0);
  }, []);

  // Fetch all animes to enrich user list items
  useEffect(() => {
    let isMounted = true;
    const fetchAllAnimes = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
        const res = await fetch(`${API_BASE}/api/animes`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setAnimes(data);
          }
        }
      } catch (err) {
        console.error("Error fetching animes for my-list:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAllAnimes();

    const handleListUpdate = () => {
      setUserLists(getAllUserLists());
      setContinueWatching(getContinueWatchingList());
    };

    window.addEventListener('animem_user_list_updated', handleListUpdate);
    window.addEventListener('animem_watch_progress_updated', handleListUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('animem_user_list_updated', handleListUpdate);
      window.removeEventListener('animem_watch_progress_updated', handleListUpdate);
    };
  }, []);

  const handleStatusChange = (animeId: string | number, newStatus: UserListStatus | null) => {
    const targetAnime = animes.find(a => String(a.id) === String(animeId));
    setUserListStatus(animeId, newStatus, targetAnime, token);
    setUserLists(getAllUserLists());
  };

  // Build combined items for the list
  const listItems = Object.entries(userLists).map(([aid, item]) => {
    const fullAnime = animes.find(a => String(a.id) === String(aid)) || item.anime;
    const watchedMap = getWatchedEpisodesMap(aid);
    const watchedCount = Object.keys(watchedMap).length;
    return {
      animeId: aid,
      status: item.status,
      updatedAt: item.updatedAt,
      watchedCount,
      anime: fullAnime
    };
  }).filter(item => item.anime);

  // Status counts
  const counts = {
    all: listItems.length,
    continue: continueWatching.length,
    watching: listItems.filter(i => i.status === 'watching').length,
    plan_to_watch: listItems.filter(i => i.status === 'plan_to_watch').length,
    completed: listItems.filter(i => i.status === 'completed').length,
    dropped: listItems.filter(i => i.status === 'dropped').length,
    favorite: listItems.filter(i => i.status === 'favorite').length,
  };

  // Filtered list
  const filteredItems = listItems.filter(item => {
    if (activeTab !== 'all' && activeTab !== 'continue' && item.status !== activeTab) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const title = (item.anime?.title || '').toLowerCase();
      const genres = (item.anime?.janrlar || '').toLowerCase();
      return title.includes(q) || genres.includes(q);
    }
    return true;
  });

  const tabButtons: Array<{ id: UserListStatus | 'all' | 'continue'; label: string; icon: any; count: number; color?: string }> = [
    { id: 'all', label: 'Barchasi', icon: Layers, count: counts.all },
    { id: 'continue', label: 'Davom ettirish', icon: Play, count: counts.continue, color: '#ff006a' },
    { id: 'watching', label: "Ko'ryapman", icon: Tv, count: counts.watching, color: '#10b981' },
    { id: 'plan_to_watch', label: "Ko'rmoqchiman", icon: Clock, count: counts.plan_to_watch, color: '#a855f7' },
    { id: 'completed', label: "Ko'rib bo'ldim", icon: CheckCircle2, count: counts.completed, color: '#0ea5e9' },
    { id: 'dropped', label: "Tashlab ketdim", icon: XCircle, count: counts.dropped, color: '#f59e0b' },
    { id: 'favorite', label: "Sevimlilar", icon: Heart, count: counts.favorite, color: '#ff006a' },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[55vh] gap-3">
        <div className="w-10 h-10 border-4 border-[#ff006a] border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(255,0,106,0.4)]" />
        <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">Ro'yxat yuklanmoqda...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-6 pb-16">
      {/* Header Banner */}
      <div className="relative bg-gradient-to-r from-[#16161f] via-[#101016] to-[#16161f] border border-[#272733] rounded-3xl p-6 md:p-8 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#ff006a]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-60 h-60 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff006a]/15 border border-[#ff006a]/30 text-[#ff006a] text-xs font-black uppercase tracking-wider mb-2">
              <BookmarkCheck size={14} /> Shaxsiy Kabinet
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tight">
              Mening Shaxsiy Ro'yxatim
            </h1>
            <p className="text-white/60 text-xs sm:text-sm mt-1 max-w-xl">
              Tomosha qilayotgan animelaringiz, rejalaringiz va ko'rib tugatilgan seriyalarni bitta qulay joyda boshqaring.
            </p>
          </div>

          {/* Search in user list */}
          <div className="relative w-full md:w-72">
            <input
              type="text"
              placeholder="Ro'yxatdan qidirish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0a0a0e]/90 border border-white/15 focus:border-[#ff006a] rounded-2xl px-4 py-2.5 pl-10 text-xs sm:text-sm text-white placeholder-white/40 outline-none transition-all"
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Status Category Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar mt-6 pt-4 border-t border-white/10 pb-1">
          {tabButtons.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-[#ff006a] text-white shadow-[0_0_20px_rgba(255,0,106,0.4)] scale-105'
                    : 'bg-[#181822] hover:bg-[#20202c] text-white/70 hover:text-white border border-white/5'
                }`}
              >
                <Icon size={14} style={{ color: isActive ? '#fff' : tab.color }} />
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isActive ? 'bg-black/30 text-white' : 'bg-white/10 text-white/60'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Continue Watching Section if 'continue' tab is selected */}
      {activeTab === 'continue' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2 uppercase tracking-wide">
              <Play className="w-4 h-4 text-[#ff006a] fill-current" /> Qolgan joyidan davom ettirish ({continueWatching.length})
            </h2>
          </div>

          {continueWatching.length === 0 ? (
            <div className="bg-[#111116] border border-[#222] rounded-2xl p-12 text-center flex flex-col items-center">
              <Play className="w-12 h-12 text-white/20 mb-3 stroke-1" />
              <h3 className="text-base font-bold text-white">Hozircha ko'rilayotgan animelar yo'q</h3>
              <p className="text-white/50 text-xs max-w-sm mt-1 mb-5">
                Istalgan animeni tomosha qilishni boshlang, uning qismlari va qolgan joyi bu yerda avtomatik saqlanib boradi.
              </p>
              <Link
                to="/animelar"
                className="px-6 py-2.5 bg-[#ff006a] hover:bg-[#e6005c] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-[#ff006a]/30"
              >
                Animelarni ko'rish
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {continueWatching.map(item => {
                const epWatchedCount = Object.keys(item.episodes || {}).length;
                const totalEp = item.totalEpisodes || 12;
                const percent = Math.min(100, Math.round((epWatchedCount / totalEp) * 100));

                return (
                  <div 
                    key={item.animeId}
                    className="group relative bg-[#121218] hover:bg-[#181822] border border-[#22222d] hover:border-[#ff006a]/40 rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 shadow-lg"
                  >
                    <div className="relative aspect-video rounded-xl overflow-hidden mb-3 bg-[#0a0a0e]">
                      <img 
                        src={item.poster} 
                        alt={item.animeTitle} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/placeholder.jpg'; }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      
                      {/* Play Overlay */}
                      <Link
                        to={`/anime/${item.animeSlug || item.animeId}`}
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-xs"
                      >
                        <span className="w-12 h-12 rounded-full bg-[#ff006a] text-white flex items-center justify-center shadow-[0_0_25px_#ff006a] transform scale-90 group-hover:scale-100 transition-transform">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </span>
                      </Link>

                      {/* Episode Badge */}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white">
                        {item.lastEpisode}-qism
                      </div>

                      {/* Progress Bar at image bottom */}
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                        <div 
                          className="h-full bg-gradient-to-r from-[#ff006a] to-purple-500 shadow-[0_0_8px_#ff006a]" 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs sm:text-sm font-extrabold text-white truncate group-hover:text-[#ff006a] transition-colors">
                        {item.animeTitle}
                      </h4>
                      <div className="flex items-center justify-between text-[11px] text-white/50 mt-1">
                        <span>Ko'rildi: {epWatchedCount}/{totalEp} ({percent}%)</span>
                        <span className="text-[#ff006a] font-bold">{item.lastEpisode}-qism</span>
                      </div>
                    </div>

                    <Link
                      to={`/anime/${item.animeSlug || item.animeId}`}
                      className="mt-3 w-full py-2 bg-[#ff006a]/15 hover:bg-[#ff006a] text-[#ff006a] hover:text-white border border-[#ff006a]/30 rounded-xl text-center text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                    >
                      <Play size={12} className="fill-current" /> Davom ettirish
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Main Anime List Content */
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <div className="bg-[#111116] border border-[#222] rounded-3xl p-12 text-center flex flex-col items-center">
              <BookmarkCheck className="w-12 h-12 text-white/20 mb-3 stroke-1" />
              <h3 className="text-base font-bold text-white">
                {searchQuery ? "Qidiruv bo'yicha hech narsa topilmadi" : "Ushbu toifada hozircha animelar yo'q"}
              </h3>
              <p className="text-white/50 text-xs max-w-sm mt-1 mb-5">
                {searchQuery 
                  ? "Boshqa so'z bilan qidirib ko'ring yoki filtrlarni tozalang." 
                  : "Anime sahifasiga o'tib, 'Ro'yxatga qo'shish' tugmasi orqali o'zingizga kerakli statusni tanlang."}
              </p>
              <Link
                to="/animelar"
                className="px-6 py-2.5 bg-[#ff006a] hover:bg-[#e6005c] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-[#ff006a]/30"
              >
                Animelarni kashf etish
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {filteredItems.map(item => {
                const anime = item.anime;
                if (!anime) return null;
                const statusCfg = getStatusConfig(item.status);
                const animeSlug = (anime as any).slug || toSlug(anime.title || '') || item.animeId;

                return (
                  <div
                    key={item.animeId}
                    className="group relative bg-[#13131a] hover:bg-[#181822] border border-[#22222d] hover:border-[#ff006a]/40 rounded-2xl p-2 sm:p-2.5 flex flex-col justify-between transition-all duration-300 shadow-md overflow-hidden"
                  >
                    {/* Top Poster Box */}
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-[#0a0a0e] mb-2">
                      <img
                        src={anime.image_url || anime.banner_url}
                        alt={anime.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/placeholder.jpg'; }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

                      {/* Status Badge */}
                      {statusCfg && (
                        <div 
                          className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider backdrop-blur-md border shadow-sm"
                          style={{ 
                            backgroundColor: statusCfg.bgColor, 
                            borderColor: statusCfg.borderColor, 
                            color: statusCfg.color 
                          }}
                        >
                          {statusCfg.label}
                        </div>
                      )}

                      {/* Rating Badge */}
                      {anime.rating && (
                        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-bold text-[#ff9900] flex items-center gap-0.5">
                          <Star size={10} className="fill-[#ff9900]" />
                          {Number(anime.rating).toFixed(1)}
                        </div>
                      )}

                      {/* Clickable Area to Details */}
                      <Link 
                        to={`/anime/${animeSlug}`}
                        className="absolute inset-0 z-10"
                      />
                    </div>

                    {/* Info */}
                    <div className="space-y-1">
                      <Link 
                        to={`/anime/${animeSlug}`}
                        className="block text-xs sm:text-sm font-extrabold text-white truncate group-hover:text-[#ff006a] transition-colors"
                        title={anime.title}
                      >
                        {anime.title}
                      </Link>

                      <div className="flex items-center justify-between text-[10px] text-white/50">
                        <span>{anime.qismlar_soni ? `${anime.qismlar_soni} qism` : 'Anime'}</span>
                        {item.watchedCount > 0 && (
                          <span className="text-[#10b981] font-bold">
                            {item.watchedCount} ta ko'rildi
                          </span>
                        )}
                      </div>

                      {/* Quick Status Selector Dropdown */}
                      <div className="pt-1.5">
                        <select
                          value={item.status}
                          onChange={(e) => handleStatusChange(item.animeId, e.target.value as UserListStatus)}
                          className="w-full bg-[#1c1c27] hover:bg-[#252533] border border-white/10 text-white text-[11px] font-semibold rounded-lg px-2 py-1 outline-none cursor-pointer transition-colors"
                        >
                          {USER_LIST_STATUSES.map(st => (
                            <option key={st.id} value={st.id}>
                              {st.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => handleStatusChange(item.animeId, null)}
                        className="w-full mt-1 text-[10px] text-white/30 hover:text-red-400 py-1 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        title="Ro'yxatdan o'chirish"
                      >
                        <Trash2 size={10} /> Ro'yxatdan o'chirish
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
