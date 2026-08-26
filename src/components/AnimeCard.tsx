import { Link } from 'react-router-dom';
import { Anime, toSlug } from '../types';
import { Star, Play, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AnimeCardProps {
  anime: Anime;
  showBadge?: string; // Optional badge e.g. "Yangi", "TOP 1"
}

export default function AnimeCard({ anime, showBadge }: AnimeCardProps) {
  const { user } = useAuth();
  const episodeCount = Number(anime.qismlar_soni) || 1;
  const isMultiEpisode = episodeCount >= 2;
  const targetPath = user ? `/anime/${toSlug(anime.title)}` : '/register';
  const targetUrl = `https://animem.uz/anime/${toSlug(anime.title)}`;

  return (
    <Link
      to={targetPath}
      title={`${anime.title} - O'zbek tilida ko'rish`}
      className="group relative block focus:outline-none"
    >
      {/* Outer Aesthetic Glowing Anime Frame */}
      <div className="relative p-[2px] rounded-xl bg-gradient-to-b from-white/20 via-white/5 to-[#ff006a]/25 group-hover:from-[#ff006a] group-hover:via-[#ff006a]/80 group-hover:to-purple-600 transition-all duration-500 shadow-md group-hover:shadow-[0_0_25px_rgba(255,0,106,0.4)]">
        
        {/* Inner Card Canvas with aspect ratio */}
        <div className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-[#0c0c0e]">
          {/* Poster Image */}
          <img
            src={anime.image_url}
            alt={`${anime.title} - ${targetUrl}`}
            title={`${anime.title} - Animem.uz`}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transform group-hover:scale-108 group-hover:brightness-105 transition-all duration-500 ease-out"
          />

          {/* Cinematic Dark Gradient & Rim Vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none opacity-80 group-hover:opacity-50 transition-opacity" />

          {/* Stylish Anime Frame Corner Accents */}
          <div className="absolute top-1.5 left-1.5 w-2.5 h-2.5 border-t-2 border-l-2 border-white/50 group-hover:border-[#ff006a] rounded-tl-sm transition-colors duration-300 pointer-events-none" />
          <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 border-t-2 border-r-2 border-white/50 group-hover:border-[#ff006a] rounded-tr-sm transition-colors duration-300 pointer-events-none" />
          <div className="absolute bottom-1.5 left-1.5 w-2.5 h-2.5 border-b-2 border-l-2 border-white/50 group-hover:border-[#ff006a] rounded-bl-sm transition-colors duration-300 pointer-events-none" />
          <div className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 border-b-2 border-r-2 border-white/50 group-hover:border-[#ff006a] rounded-br-sm transition-colors duration-300 pointer-events-none" />

          {/* Hover Play Button Overlay with Pulse Glow */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[1px]">
            <div className="w-12 h-12 bg-gradient-to-tr from-[#ff006a] to-[#ff4081] rounded-full flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-300 shadow-[0_0_20px_rgba(255,0,106,0.7)] border border-white/40">
              <Play className="w-5 h-5 text-white fill-current ml-0.5" />
            </div>
          </div>

          {/* Episode Count Badge */}
          <div className="absolute bottom-2 left-2 bg-[#ff006a]/90 backdrop-blur-md text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-lg border border-white/20 tracking-wider">
            {isMultiEpisode ? `EP ${episodeCount}` : 'FILM / 1 QISM'}
          </div>

          {/* Rating Badge */}
          {anime.rating && (
            <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-md text-white text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 border border-yellow-500/30 shadow-lg">
              <Star className="w-2.5 h-2.5 text-yellow-400 fill-current" />
              {Number(anime.rating).toFixed(1)}
            </div>
          )}

          {/* Custom Tag Badge if provided */}
          {showBadge && (
            <div className="absolute top-2 right-2 bg-gradient-to-r from-emerald-500 to-teal-400 text-black text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-lg border border-emerald-300/40">
              {showBadge}
            </div>
          )}
        </div>
      </div>

      {/* Anime Title */}
      <h3 className="text-white font-bold text-sm line-clamp-1 group-hover:text-[#ff006a] transition-colors mt-2 px-0.5">
        {anime.title}
      </h3>

      {/* Footer metadata */}
      <div className="flex justify-between items-center text-[10px] text-white/40 mt-1 font-mono px-0.5">
        <span className="flex items-center gap-1 group-hover:text-white/60 transition-colors">
          <Eye className="w-3.5 h-3.5 text-[#ff006a]" /> {anime.korishlar || 0}
        </span>
        <span className="text-white/50">{anime.yil || 'Noma\'lum'}</span>
      </div>
    </Link>
  );
}
