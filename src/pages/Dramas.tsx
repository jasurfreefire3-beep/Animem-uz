import React, { useState, useEffect } from 'react';
import { Film, Search, Filter, Sparkles, Heart, Clock, TrendingUp, Calendar } from 'lucide-react';
import { Drama } from '../types';
import DramaCard from '../components/DramaCard';
import { motion } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';

export default function Dramas() {
  const { t } = useLanguage();
  const [dramas, setDramas] = useState<Drama[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'likes'>('latest');

  useEffect(() => {
    document.title = "Dramalar - Animem Uz";
    fetchDramas();
  }, []);

  const fetchDramas = async () => {
    try {
      const res = await fetch('/api/dramas');
      if (res.ok) {
        const data = await res.json();
        setDramas(data);
      }
    } catch (err) {
      console.error('Failed to fetch dramas:', err);
    } finally {
      setLoading(false);
    }
  };

  // Collect all unique genres from available dramas
  const allGenres = Array.from(
    new Set(
      dramas.flatMap(d => (d.janrlar || '').split(',').map(s => s.trim())).filter(Boolean)
    )
  );

  // Collect all unique years
  const allYears = Array.from(
    new Set(
      dramas.map(d => d.yil).filter(Boolean)
    )
  ).sort((a, b) => (Number(b) || 0) - (Number(a) || 0));

  const filteredDramas = dramas.filter(drama => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      (drama.title || '').toLowerCase().includes(q) ||
      (drama.janrlar || '').toLowerCase().includes(q) ||
      (drama.description || '').toLowerCase().includes(q)
    );

    const matchesGenre = selectedGenre === 'All' || 
      (drama.janrlar || '').toLowerCase().includes(selectedGenre.toLowerCase());

    const matchesYear = selectedYear === 'All' || String(drama.yil) === String(selectedYear);

    return matchesSearch && matchesGenre && matchesYear;
  }).sort((a, b) => {
    if (sortBy === 'popular') {
      return (b.korishlar || 0) - (a.korishlar || 0);
    }
    if (sortBy === 'likes') {
      return (b.likes || 0) - (a.likes || 0);
    }
    // Default: latest
    return (new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()) || (Number(b.id) - Number(a.id));
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header Banner */}
      <div className="relative rounded-lg overflow-hidden bg-gradient-to-r from-[#1a0814] via-[#111] to-[#08121a] border border-[#222] p-6 sm:p-10">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff006a]/10 border border-[#ff006a]/20 text-[#ff006a] text-xs font-bold uppercase tracking-wider mb-3">
            <Film className="w-3.5 h-3.5" /> Koreys va Osiyo Dramalari
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Eng Sara <span className="text-[#ff006a]">Dramalar</span> To'plami
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-white/60">
            Koreya, Yaponiya va Xitoyning eng sara, mashhur va yangi dramalarini yuqori sifatda tomosha qiling, layk bosing va o'z fikrlaringizni qoldiring!
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#111] border border-[#222] rounded-md p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Drama nomi, janri yoki kalit so'zlar bo'yicha qidirish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#222] rounded-sm pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#ff006a] transition-colors"
            />
          </div>

          {/* Sort Buttons */}
          <div className="flex items-center gap-1 bg-[#0a0a0a] p-1 border border-[#222] rounded-sm shrink-0">
            <button
              onClick={() => setSortBy('latest')}
              className={`px-3 py-1.5 rounded-sm text-xs font-bold flex items-center gap-1.5 transition-colors ${
                sortBy === 'latest' ? 'bg-[#ff006a] text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Eng yangi
            </button>
            <button
              onClick={() => setSortBy('popular')}
              className={`px-3 py-1.5 rounded-sm text-xs font-bold flex items-center gap-1.5 transition-colors ${
                sortBy === 'popular' ? 'bg-[#ff006a] text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" /> Ko'p ko'rilgan
            </button>
            <button
              onClick={() => setSortBy('likes')}
              className={`px-3 py-1.5 rounded-sm text-xs font-bold flex items-center gap-1.5 transition-colors ${
                sortBy === 'likes' ? 'bg-[#ff006a] text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              <Heart className="w-3.5 h-3.5" /> Ko'p layk
            </button>
          </div>
        </div>

        {/* Genre Tags Scroll */}
        {allGenres.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <span className="text-xs text-white/40 font-bold uppercase tracking-wider shrink-0 mr-1">Janr:</span>
            <button
              onClick={() => setSelectedGenre('All')}
              className={`px-3 py-1 rounded-sm text-xs font-bold shrink-0 transition-colors ${
                selectedGenre === 'All'
                  ? 'bg-[#ff006a] text-white'
                  : 'bg-[#1a1a1a] text-white/60 hover:text-white hover:bg-[#252525]'
              }`}
            >
              Barchasi
            </button>
            {allGenres.map(genre => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`px-3 py-1 rounded-sm text-xs font-bold shrink-0 transition-colors ${
                  selectedGenre === genre
                    ? 'bg-[#ff006a] text-white'
                    : 'bg-[#1a1a1a] text-white/60 hover:text-white hover:bg-[#252525]'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Drama Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-[#111] border border-[#222] rounded-sm animate-pulse" />
          ))}
        </div>
      ) : filteredDramas.length === 0 ? (
        <div className="text-center py-16 bg-[#111] border border-[#222] rounded-md p-8">
          <Film className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">Hech qanday drama topilmadi</h3>
          <p className="text-xs text-white/50 mt-1">Boshqa kalit so'z yoki janr bo'yicha qidirib ko'ring.</p>
          {(selectedGenre !== 'All' || searchQuery) && (
            <button
              onClick={() => { setSelectedGenre('All'); setSearchQuery(''); }}
              className="mt-4 px-4 py-2 bg-[#ff006a] text-white rounded-sm text-xs font-bold hover:bg-[#ff006a]/80"
            >
              Filtrlarni tozalash
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredDramas.map((drama, idx) => (
            <motion.div
              key={drama.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.04, 0.4) }}
            >
              <DramaCard drama={drama} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
