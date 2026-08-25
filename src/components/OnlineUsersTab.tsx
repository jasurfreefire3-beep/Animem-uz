import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Tv, 
  Eye, 
  Clock, 
  Activity, 
  Smartphone, 
  Monitor, 
  RefreshCw, 
  Search, 
  ExternalLink,
  Shield,
  Sparkles,
  Radio
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';

export interface OnlineUserItem {
  sessionId: string;
  userId?: string | null;
  username: string;
  avatar?: string | null;
  role?: string;
  email?: string | null;
  currentPath: string;
  pageLabel: string;
  animeTitle?: string | null;
  animeSlug?: string | null;
  episodeNumber?: number | string | null;
  poster?: string | null;
  isWatching: boolean;
  userAgent?: string;
  lastSeen: number;
  joinedAt?: number;
}

export const OnlineUsersTab: React.FC = () => {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'watching' | 'registered' | 'guests'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());

  // Keep a local timer running to update relative times and clean stale users
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Firestore Listener
  useEffect(() => {
    setLoading(true);

    let unsubscribe = () => {};

    try {
      if (db) {
        const presenceColRef = collection(db, 'presence');
        const q = query(presenceColRef);

        unsubscribe = onSnapshot(q, (snapshot) => {
          const currentTime = Date.now();
          const ACTIVE_TIMEOUT_MS = 60 * 1000; // 1 minute active threshold

          const users: OnlineUserItem[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const lastSeenTime = data.lastSeen || (data.updatedAt?.toMillis ? data.updatedAt.toMillis() : currentTime);
            
            // Only include users who sent heartbeat within the last 60 seconds
            if (currentTime - lastSeenTime <= ACTIVE_TIMEOUT_MS) {
              users.push({
                sessionId: docSnap.id,
                userId: data.userId || null,
                username: data.username || 'Mehmon',
                avatar: data.avatar || null,
                role: data.role || 'guest',
                email: data.email || null,
                currentPath: data.currentPath || '/',
                pageLabel: data.pageLabel || 'Bosh sahifa',
                animeTitle: data.animeTitle || null,
                animeSlug: data.animeSlug || null,
                episodeNumber: data.episodeNumber || null,
                poster: data.poster || null,
                isWatching: Boolean(data.isWatching || data.animeTitle),
                userAgent: data.userAgent || '',
                lastSeen: lastSeenTime,
                joinedAt: data.joinedAt || lastSeenTime
              });
            }
          });

          // Sort most recently active first
          users.sort((a, b) => b.lastSeen - a.lastSeen);
          setOnlineUsers(users);
          setLastRefreshedAt(new Date());
          setLoading(false);
        }, (error) => {
          console.warn('Firestore onSnapshot presence warning:', error);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.warn('Error setting up presence listener:', err);
      setLoading(false);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  // Calculations
  const activeUsers = onlineUsers.filter(u => nowTimestamp - u.lastSeen <= 60000);
  const totalCount = activeUsers.length;
  const watchingCount = activeUsers.filter(u => u.isWatching || u.animeTitle).length;
  const registeredCount = activeUsers.filter(u => u.userId && u.role !== 'guest').length;
  const guestCount = Math.max(0, totalCount - registeredCount);

  // Filtered users
  const filteredUsers = activeUsers.filter(u => {
    if (filter === 'watching' && !(u.isWatching || u.animeTitle)) return false;
    if (filter === 'registered' && (!u.userId || u.role === 'guest')) return false;
    if (filter === 'guests' && (u.userId && u.role !== 'guest')) return false;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchName = u.username?.toLowerCase().includes(q);
      const matchAnime = u.animeTitle?.toLowerCase().includes(q);
      const matchPage = u.pageLabel?.toLowerCase().includes(q);
      const matchEmail = u.email?.toLowerCase().includes(q);
      return matchName || matchAnime || matchPage || matchEmail;
    }
    return true;
  });

  const getDeviceIcon = (ua: string = '') => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    return isMobile ? (
      <span title="Mobil qurilma">
        <Smartphone size={14} className="text-amber-400" />
      </span>
    ) : (
      <span title="Kompyuter / Desktop">
        <Monitor size={14} className="text-blue-400" />
      </span>
    );
  };

  const formatAgo = (timestamp: number) => {
    const sec = Math.max(0, Math.floor((nowTimestamp - timestamp) / 1000));
    if (sec < 6) return "Hozirgina";
    if (sec < 60) return `${sec} soniya oldin`;
    const min = Math.floor(sec / 60);
    return `${min} daqiqa oldin`;
  };

  return (
    <div className="space-y-6 animate-fade-in text-white select-none">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Online */}
        <div className="bg-[#111] border border-[#222] rounded-sm p-5 relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Radio size={70} className="text-emerald-400" />
          </div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Jonli Online</span>
          </div>
          <div className="text-3xl font-black text-white">{totalCount} ta</div>
          <p className="text-xs text-white/50 mt-1">Hozir saytda faol foydalanuvchilar</p>
        </div>

        {/* Watching Anime */}
        <div className="bg-[#111] border border-[#222] rounded-sm p-5 relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Tv size={70} className="text-[#ff006a]" />
          </div>
          <div className="flex items-center gap-2 text-[#ff006a] mb-2">
            <Tv size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Anime Ko'rayotganlar</span>
          </div>
          <div className="text-3xl font-black text-white">{watchingCount} ta</div>
          <p className="text-xs text-white/50 mt-1">Epizod tomosha qilayotganlar</p>
        </div>

        {/* Registered Users */}
        <div className="bg-[#111] border border-[#222] rounded-sm p-5 relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Shield size={70} className="text-purple-400" />
          </div>
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <Users size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Ro'yxatdan O'tgan</span>
          </div>
          <div className="text-3xl font-black text-white">{registeredCount} ta</div>
          <p className="text-xs text-white/50 mt-1">Shaxsiy akkaunti bilan kirganlar</p>
        </div>

        {/* Guests */}
        <div className="bg-[#111] border border-[#222] rounded-sm p-5 relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Eye size={70} className="text-blue-400" />
          </div>
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Eye size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Mehmonlar</span>
          </div>
          <div className="text-3xl font-black text-white">{guestCount} ta</div>
          <p className="text-xs text-white/50 mt-1">Anonim tashrif buyuruvchilar</p>
        </div>
      </div>

      {/* Control bar */}
      <div className="bg-[#111] border border-[#222] rounded-sm p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Foydalanuvchi yoki anime nomi bo'yicha qidirish..."
            className="w-full bg-[#181818] border border-[#222] focus:border-[#ff006a] rounded-sm pl-10 pr-4 py-2 text-sm text-white placeholder:text-white/30 outline-none transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-[#181818] border border-[#222] rounded-sm p-1 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-sm font-semibold transition-colors cursor-pointer ${
                filter === 'all' ? 'bg-[#ff006a] text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              Barchasi ({totalCount})
            </button>
            <button
              onClick={() => setFilter('watching')}
              className={`px-3 py-1.5 rounded-sm font-semibold transition-colors cursor-pointer ${
                filter === 'watching' ? 'bg-[#ff006a] text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              Ko'rayotganlar ({watchingCount})
            </button>
            <button
              onClick={() => setFilter('registered')}
              className={`px-3 py-1.5 rounded-sm font-semibold transition-colors cursor-pointer ${
                filter === 'registered' ? 'bg-[#ff006a] text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              A'zolar ({registeredCount})
            </button>
            <button
              onClick={() => setFilter('guests')}
              className={`px-3 py-1.5 rounded-sm font-semibold transition-colors cursor-pointer ${
                filter === 'guests' ? 'bg-[#ff006a] text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              Mehmonlar ({guestCount})
            </button>
          </div>

          <button
            onClick={() => setLastRefreshedAt(new Date())}
            className="p-2.5 bg-[#181818] hover:bg-white/10 border border-[#222] rounded-sm text-white/80 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title="Yangilash"
          >
            <RefreshCw size={14} className="text-[#ff006a]" />
            <span className="hidden sm:inline">Jonli</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#111] border border-[#222] rounded-sm overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#222] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-emerald-400" />
            <h3 className="font-bold text-sm text-white">
              Hozirgi Faol Foydalanuvchilar ({filteredUsers.length})
            </h3>
          </div>
          <span className="text-[11px] text-white/40 font-mono">
            Jonli sinxronlanmoqda: {lastRefreshedAt.toLocaleTimeString()}
          </span>
        </div>

        {loading && onlineUsers.length === 0 ? (
          <div className="p-12 text-center text-white/50 space-y-3">
            <div className="w-8 h-8 border-2 border-[#ff006a] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs">Foydalanuvchilar holati tekshirilmoqda...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-white/40 space-y-2">
            <Users size={32} className="mx-auto opacity-30" />
            <p className="text-sm font-semibold">Faol foydalanuvchilar mavjud</p>
            <p className="text-xs text-white/30">Hozirda tanlangan filtr bo'yicha ma'lumot topilmadi</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#222] bg-white/[0.02] text-[11px] uppercase tracking-wider text-white/40 font-bold">
                  <th className="py-3.5 px-4">Foydalanuvchi</th>
                  <th className="py-3.5 px-4">Hozirgi Holat & Tomosha</th>
                  <th className="py-3.5 px-4">Epizod</th>
                  <th className="py-3.5 px-4">Qurilma & Sahifa</th>
                  <th className="py-3.5 px-4 text-right">Oxirgi Faollik</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222] text-xs">
                {filteredUsers.map((u) => (
                  <tr key={u.sessionId} className="hover:bg-white/[0.02] transition-colors group">
                    {/* User Profile */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          {u.avatar ? (
                            <img 
                              src={u.avatar} 
                              alt={u.username} 
                              className="w-9 h-9 rounded-sm object-cover border border-[#333]"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-sm bg-gradient-to-br from-[#ff006a]/30 to-purple-600/30 border border-[#333] flex items-center justify-center font-bold text-white uppercase text-xs">
                              {u.username?.charAt(0) || 'M'}
                            </div>
                          )}
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#111]" />
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white group-hover:text-[#ff006a] transition-colors">
                              {u.username}
                            </span>
                            {u.role === 'admin' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/30">
                                ADMIN
                              </span>
                            )}
                            {u.role === 'moderator' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                MOD
                              </span>
                            )}
                            {(!u.userId || u.role === 'guest') && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white/10 text-white/50">
                                Mehmon
                              </span>
                            )}
                          </div>
                          {u.email && (
                            <span className="text-[10px] text-white/40 block truncate max-w-[150px]">
                              {u.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Current Watch / Activity */}
                    <td className="py-3.5 px-4">
                      {u.animeTitle ? (
                        <div className="flex items-center gap-2.5">
                          {u.poster && (
                            <img 
                              src={u.poster} 
                              alt="" 
                              className="w-7 h-10 object-cover rounded-sm border border-[#333] shrink-0" 
                            />
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <Tv size={12} className="text-[#ff006a] shrink-0 animate-pulse" />
                              {u.animeSlug ? (
                                <Link 
                                  to={`/anime/${u.animeSlug}`}
                                  target="_blank"
                                  className="font-bold text-white hover:text-[#ff006a] transition-colors flex items-center gap-1"
                                >
                                  <span>{u.animeTitle}</span>
                                  <ExternalLink size={10} className="opacity-40" />
                                </Link>
                              ) : (
                                <span className="font-bold text-white">{u.animeTitle}</span>
                              )}
                            </div>
                            <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                              <Sparkles size={11} /> Jonli tomosha qilyapti
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-white/60">
                          <Eye size={13} className="text-blue-400 shrink-0" />
                          <span>{u.pageLabel}</span>
                        </div>
                      )}
                    </td>

                    {/* Episode */}
                    <td className="py-3.5 px-4">
                      {u.episodeNumber ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-sm bg-[#ff006a]/10 border border-[#ff006a]/20 text-[#ff006a] font-bold text-xs font-mono">
                          {u.episodeNumber}-qism
                        </span>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>

                    {/* Device & Path */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-white/70">
                          {getDeviceIcon(u.userAgent)}
                          <span className="text-[11px] font-mono bg-black/40 px-1.5 py-0.5 rounded text-white/60 border border-white/5">
                            {u.currentPath}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Last Seen */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 text-white/50 text-[11px]">
                        <Clock size={11} />
                        <span>{formatAgo(u.lastSeen)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default OnlineUsersTab;
