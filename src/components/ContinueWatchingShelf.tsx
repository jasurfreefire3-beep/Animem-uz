import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, Sparkles, ChevronRight, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { AnimeWatchProgress } from '../types';
import { getContinueWatchingList } from '../services/watchProgressService';

export default function ContinueWatchingShelf() {
  const [items, setItems] = useState<AnimeWatchProgress[]>([]);

  useEffect(() => {
    setItems(getContinueWatchingList());

    const handleUpdate = () => {
      setItems(getContinueWatchingList());
    };

    window.addEventListener('animem_watch_progress_updated', handleUpdate);
    return () => window.removeEventListener('animem_watch_progress_updated', handleUpdate);
  }, []);

  if (items.length === 0) return null;

  return (
    <motion.section 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative bg-gradient-to-r from-[#17111c] via-[#121218] to-[#17111c] border border-[#ff006a]/20 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-[0_0_30px_rgba(255,0,106,0.08)] overflow-hidden mb-8"
    >
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff006a]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#ff006a]/20 border border-[#ff006a]/40 flex items-center justify-center text-[#ff006a] shadow-[0_0_12px_rgba(255,0,106,0.3)]">
            <Play size={14} className="fill-current ml-0.5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              Tomoshani Davom Ettirish
              <span className="px-2 py-0.5 text-[10px] font-bold bg-[#ff006a]/20 border border-[#ff006a]/30 text-[#ff006a] rounded-full">
                {items.length} ta
              </span>
            </h2>
            <p className="text-white/40 text-[11px] hidden sm:block">
              Siz to'xtagan so'nggi epizodlardan davom eting
            </p>
          </div>
        </div>

        <Link
          to="/shaxsiy-royxat"
          className="text-xs font-bold text-[#ff006a] hover:text-[#ff3385] transition-colors flex items-center gap-1 group"
        >
          <span>Barchasini ko'rish</span>
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Carousel items */}
      <div className="flex gap-3 sm:gap-4 overflow-x-auto custom-scrollbar pb-2 pt-1 -mx-1 px-1">
        {items.slice(0, 8).map(item => {
          const epWatchedCount = Object.keys(item.episodes || {}).length;
          const totalEp = item.totalEpisodes || 12;
          const percent = Math.min(100, Math.round((epWatchedCount / totalEp) * 100));

          return (
            <div
              key={item.animeId}
              className="group shrink-0 w-48 sm:w-56 bg-[#0e0e14] hover:bg-[#15151e] border border-white/10 hover:border-[#ff006a]/50 rounded-2xl p-2 sm:p-2.5 transition-all duration-300 shadow-md flex flex-col justify-between"
            >
              {/* Poster Thumbnail */}
              <div className="relative aspect-video rounded-xl overflow-hidden bg-[#07070a] mb-2.5">
                <img
                  src={item.poster}
                  alt={item.animeTitle}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/placeholder.jpg'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Instant Play Link */}
                <Link
                  to={`/anime/${item.animeSlug || item.animeId}`}
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-xs"
                >
                  <span className="w-10 h-10 rounded-full bg-[#ff006a] text-white flex items-center justify-center shadow-[0_0_20px_#ff006a] transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </span>
                </Link>

                {/* Episode Badge */}
                <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[9px] font-extrabold text-white">
                  {item.lastEpisode}-qism
                </div>

                {/* Progress bar at base */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                  <div
                    className="h-full bg-[#ff006a] shadow-[0_0_6px_#ff006a]"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              {/* Title & Ep Meta */}
              <div>
                <h4 className="text-xs font-bold text-white truncate group-hover:text-[#ff006a] transition-colors" title={item.animeTitle}>
                  {item.animeTitle}
                </h4>
                <div className="flex items-center justify-between text-[10px] text-white/50 mt-1">
                  <span>{item.lastEpisode}-qism</span>
                  <span className="text-[#ff006a] font-bold">{percent}%</span>
                </div>
              </div>

              {/* Action Button */}
              <Link
                to={`/anime/${item.animeSlug || item.animeId}`}
                className="mt-2.5 w-full py-1.5 bg-[#ff006a]/15 hover:bg-[#ff006a] text-[#ff006a] hover:text-white border border-[#ff006a]/30 rounded-xl text-center text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
              >
                <Play size={11} className="fill-current" /> Davom ettirish
              </Link>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
