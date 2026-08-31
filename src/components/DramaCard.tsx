import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Eye, Calendar, Film, Play } from 'lucide-react';
import { Drama, toSlug } from '../types';
import { useAuth } from '../context/AuthContext';

interface DramaCardProps {
  drama: Drama;
  onLikeChange?: (dramaId: string | number, newLikes: number, isLiked: boolean) => void;
}

export default function DramaCard({ drama, onLikeChange }: DramaCardProps) {
  const { user, token } = useAuth();
  const [likes, setLikes] = useState(drama.likes || 0);
  const [isLiked, setIsLiked] = useState(() => {
    if (!drama.liked_users) return false;
    const identifier = user ? `user_${user.id}` : null;
    return identifier ? (drama.liked_users || []).map(String).includes(identifier) : false;
  });
  const [likeLoading, setLikeLoading] = useState(false);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (likeLoading) return;

    setLikeLoading(true);
    // Optimistic UI update
    const nextIsLiked = !isLiked;
    const nextLikes = nextIsLiked ? likes + 1 : Math.max(0, likes - 1);
    setIsLiked(nextIsLiked);
    setLikes(nextLikes);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/dramas/${drama.id}/like`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          guestId: localStorage.getItem('guest_id') || undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        setLikes(data.likes);
        setIsLiked(data.isLiked);
        if (onLikeChange) {
          onLikeChange(drama.id, data.likes, data.isLiked);
        }
      }
    } catch (err) {
      console.warn("Like error:", err);
    } finally {
      setLikeLoading(false);
    }
  };

  const slug = toSlug(drama.title || 'drama');
  const dramaUrl = `/drama/${drama.id}`;

  const genresList = (drama.janrlar || '')
    .split(',')
    .map(g => g.trim())
    .filter(Boolean)
    .slice(0, 2);

  return (
    <div className="group relative bg-[#0d0d0d] border border-[#222] hover:border-[#ff006a]/50 rounded-sm overflow-hidden flex flex-col transition-all duration-300 hover:shadow-xl hover:shadow-[#ff006a]/5">
      {/* Poster Image */}
      <Link to={dramaUrl} className="relative aspect-[2/3] w-full bg-[#151515] overflow-hidden block">
        <img
          src={drama.poster_url || drama.banner_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600'}
          alt={drama.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Gradient Overlay on Hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

        {/* Year Badge */}
        {drama.yil && (
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm border border-white/10 px-2 py-0.5 rounded text-[10px] font-bold text-white tracking-wider">
            {drama.yil}
          </div>
        )}

        {/* Like Button */}
        <button
          onClick={handleLike}
          disabled={likeLoading}
          aria-label="Layk bosish"
          className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-all duration-200 ${
            isLiked
              ? 'bg-[#ff006a] text-white scale-110 shadow-lg shadow-[#ff006a]/50'
              : 'bg-black/60 text-white/70 hover:text-white hover:bg-black/80 hover:scale-105'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
        </button>

        {/* Play Icon on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-[#ff006a] flex items-center justify-center text-white shadow-lg shadow-[#ff006a]/40 transform scale-75 group-hover:scale-100 transition-transform">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </div>

        {/* Bottom stats inside poster */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] text-white/80 font-medium">
          <span className="flex items-center gap-1">
            <Heart className={`w-3 h-3 ${isLiked ? 'text-[#ff006a] fill-current' : 'text-white/60'}`} />
            {likes}
          </span>
          <span className="flex items-center gap-1 text-white/60">
            <Eye className="w-3 h-3" />
            {drama.korishlar || 0}
          </span>
        </div>
      </Link>

      {/* Info Content */}
      <div className="p-3 flex-1 flex flex-col justify-between bg-[#0d0d0d]">
        <div>
          <Link to={dramaUrl} className="block">
            <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-[#ff006a] line-clamp-1 transition-colors">
              {drama.title}
            </h3>
          </Link>

          {/* Genres */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {genresList.map((genre, idx) => (
              <span
                key={idx}
                className="text-[10px] text-white/50 bg-[#1a1a1a] px-1.5 py-0.5 rounded-sm border border-[#222]"
              >
                {genre}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
