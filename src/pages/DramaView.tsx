import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Heart, Eye, Calendar, Film, Share2, MessageSquare, 
  Send, Trash2, Check, ArrowLeft, Play, ListOrdered, Tv
} from 'lucide-react';
import { Drama, DramaEpisode, Comment } from '../types';
import { useAuth } from '../context/AuthContext';
import DramaCard from '../components/DramaCard';
import VideoPlayer from '../components/VideoPlayer';

export default function DramaView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [drama, setDrama] = useState<Drama | null>(null);
  const [episodes, setEpisodes] = useState<DramaEpisode[]>([]);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [allDramas, setAllDramas] = useState<Drama[]>([]);
  const [likes, setLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    setCurrentEpisodeIndex(0);
    fetchDramaDetails();
    fetchComments();
    fetchAllDramas();
  }, [id]);

  const fetchDramaDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/dramas/${id}`);
      if (res.ok) {
        const data: Drama = await res.json();
        setDrama(data);
        setLikes(data.likes || 0);

        const dramaEps = data.episodes || [];
        setEpisodes(dramaEps);
        setCurrentEpisodeIndex(0);

        document.title = `${data.title} - Koreys Drama O'zbek Tilida Ko'rish | Animem Uz`;
        
        // Update meta description
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
          metaDesc.setAttribute('content', `${data.title} koreys dramasi o'zbek tilida bepul onlayn tomosha qilish. ${data.description ? data.description.substring(0, 160) : ''}`);
        }

        // Check if liked
        const identifier = user ? `user_${user.id}` : null;
        if (identifier && data.liked_users) {
          setIsLiked((data.liked_users || []).map(String).includes(identifier));
        }
      } else {
        setDrama(null);
      }
    } catch (err) {
      console.error('Failed to fetch drama:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllDramas = async () => {
    try {
      const res = await fetch('/api/dramas');
      if (res.ok) {
        const data = await res.json();
        setAllDramas(data);
      }
    } catch (err) {}
  };

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/dramas/${id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (err) {
      console.error('Failed to fetch drama comments:', err);
    }
  };

  const handleToggleLike = async () => {
    if (likeLoading || !drama) return;
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
      }
    } catch (err) {
      console.warn("Drama like toggle error:", err);
    } finally {
      setLikeLoading(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) return;
    if (!user || !token) {
      navigate('/login');
      return;
    }

    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/dramas/${id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: commentContent.trim() })
      });

      if (res.ok) {
        const newCom = await res.json();
        setComments([newCom, ...comments]);
        setCommentContent('');
      }
    } catch (err) {
      console.error('Post comment error:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string | number) => {
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setComments(comments.filter(c => String(c.id) !== String(commentId)));
      }
    } catch (err) {
      console.error('Delete comment error:', err);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: drama?.title || 'Drama',
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-[#ff006a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!drama) {
    return (
      <div className="text-center py-20 max-w-lg mx-auto">
        <Film className="w-12 h-12 text-white/20 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Drama topilmadi</h2>
        <p className="text-xs text-white/50 mb-6">Ushbu drama mavjud emas yoki o'chirilgan bo'lishi mumkin.</p>
        <Link to="/dramalar" className="px-5 py-2.5 bg-[#ff006a] text-white rounded-sm text-xs font-bold uppercase">
          Barcha Dramalarga Qaytish
        </Link>
      </div>
    );
  }

  const relatedDramas = allDramas
    .filter(d => String(d.id) !== String(drama.id))
    .slice(0, 6);

  const genresList = (drama.janrlar || '').split(',').map(s => s.trim()).filter(Boolean);

  const currentEp = episodes[currentEpisodeIndex] || null;
  const currentVideoUrl = currentEp?.video_url || drama.video_url || '';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Back Button */}
      <div>
        <Link
          to="/dramalar"
          className="inline-flex items-center gap-2 text-xs font-bold text-white/60 hover:text-white transition-colors uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4" /> Barcha Dramalar
        </Link>
      </div>

      {/* Main Drama Header & Player Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Video Player (PlayerJS) or Banner */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Player Box */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tv className="w-4 h-4 text-[#ff006a]" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  {currentEp ? (currentEp.title || `${currentEp.qism}-Qism`) : '1-Qism'}
                </h2>
              </div>
              {episodes.length > 1 && (
                <span className="text-xs text-white/50 font-medium">
                  {currentEpisodeIndex + 1} / {episodes.length} qismlar
                </span>
              )}
            </div>

            {currentVideoUrl ? (
              <VideoPlayer 
                url={currentVideoUrl} 
                poster={drama.banner_url || drama.poster_url} 
                animeTitle={`${drama.title} - ${currentEp ? (currentEp.title || `${currentEp.qism}-qism`) : '1-qism'}`} 
              />
            ) : (
              <div className="relative aspect-video w-full bg-black rounded-md overflow-hidden border border-[#222] shadow-2xl flex items-center justify-center">
                <img
                  src={drama.banner_url || drama.poster_url}
                  alt={drama.title}
                  className="w-full h-full object-cover opacity-50"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="relative z-10 text-center p-6">
                  <div className="w-14 h-14 rounded-full bg-[#ff006a] flex items-center justify-center text-white mx-auto mb-3 shadow-lg shadow-[#ff006a]/40">
                    <Play className="w-6 h-6 fill-current ml-1" />
                  </div>
                  <h3 className="text-lg font-bold text-white">{drama.title}</h3>
                  <p className="text-xs text-white/60 mt-1">Tez orada yangi qismlar joylanadi</p>
                </div>
              </div>
            )}
          </div>

          {/* Telegram link if provided */}
          {drama.telegram_url && (
            <a
              href={drama.telegram_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#0088cc]/10 hover:bg-[#0088cc]/20 border border-[#0088cc]/40 text-[#0088cc] rounded-sm text-xs font-bold transition-colors"
            >
              <img 
                src="https://api.animem.uz/i/2f5df3e0-bd69-4fd4-b558-429a47091414" 
                alt="Telegram" 
                className="w-4 h-4 object-contain rounded-full" 
              />
              <span>Telegram Kanalida Ko'rish / Yuklab Olish</span>
            </a>
          )}

          {/* Episodes List (Qismlar) */}
          {episodes.length > 0 && (
            <div className="bg-[#111] border border-[#222] rounded-md p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#222] pb-3">
                <div className="flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-[#ff006a]" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Qismlar Ro'yxati ({episodes.length})
                  </h3>
                </div>
                <span className="text-[11px] text-white/40 font-medium">
                  Tomosha qilish uchun qismni tanlang
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {episodes.map((ep, idx) => {
                  const isCurrent = currentEpisodeIndex === idx;
                  return (
                    <button
                      key={ep.id || idx}
                      onClick={() => {
                        setCurrentEpisodeIndex(idx);
                        window.scrollTo({ top: 120, behavior: 'smooth' });
                      }}
                      className={`px-3 py-2.5 rounded-sm text-xs font-bold flex flex-col items-center justify-center border transition-all ${
                        isCurrent
                          ? 'bg-[#ff006a] border-[#ff006a] text-white shadow-lg shadow-[#ff006a]/25 scale-105'
                          : 'bg-[#181818] border-[#252525] text-white/80 hover:bg-[#222] hover:text-white hover:border-[#333]'
                      }`}
                    >
                      <span className="text-xs">{ep.qism}-qism</span>
                      {ep.title && ep.title !== `${ep.qism}-Qism` && (
                        <span className="text-[9px] opacity-60 truncate w-full text-center mt-0.5">
                          {ep.title}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Bar (Like, Share, Views) */}
          <div className="bg-[#111] border border-[#222] rounded-md p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Like Button */}
              <button
                onClick={handleToggleLike}
                disabled={likeLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-bold transition-all cursor-pointer ${
                  isLiked
                    ? 'bg-[#ff006a] text-white shadow-lg shadow-[#ff006a]/20 scale-105'
                    : 'bg-[#1a1a1a] text-white/80 hover:text-white hover:bg-[#252525]'
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                <span>{likes} Layk</span>
              </button>

              {/* Share Button */}
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] hover:bg-[#252525] text-white/80 hover:text-white rounded-sm text-xs font-bold transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                <span>{copied ? 'Nusxalandi!' : 'Ulashish'}</span>
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs text-white/50 font-medium">
              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" /> {drama.korishlar || 0} marta ko'rildi
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> {drama.yil || 'Noma\'lum'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Drama Info Box */}
        <div className="bg-[#111] border border-[#222] rounded-md p-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex gap-4 items-start">
              <img
                src={drama.poster_url}
                alt={drama.title}
                className="w-24 aspect-[2/3] object-cover rounded-sm border border-[#222] shrink-0"
              />
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-white leading-snug">{drama.title}</h1>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-[#ff006a]/10 border border-[#ff006a]/20 text-[#ff006a] rounded text-[10px] font-bold">
                    {drama.yil}
                  </span>
                  <span className="text-[11px] text-white/50">Drama</span>
                  {episodes.length > 0 && (
                    <span className="text-[11px] text-white/50">• {episodes.length} qism</span>
                  )}
                </div>
              </div>
            </div>

            {/* Janrlar */}
            <div>
              <h4 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Janrlar</h4>
              <div className="flex flex-wrap gap-1.5">
                {genresList.map((g, i) => (
                  <Link
                    key={i}
                    to={`/dramalar?genre=${encodeURIComponent(g)}`}
                    className="px-2.5 py-1 bg-[#1a1a1a] hover:bg-[#ff006a]/20 hover:text-[#ff006a] text-white/70 text-xs rounded-sm border border-[#222] transition-colors"
                  >
                    {g}
                  </Link>
                ))}
              </div>
            </div>

            {/* Syujet */}
            {drama.description && (
              <div>
                <h4 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">Drama Haqida</h4>
                <p className="text-xs text-white/70 leading-relaxed max-h-48 overflow-y-auto pr-1 whitespace-pre-line">
                  {drama.description}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comments Section & Recommended */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#111] border border-[#222] rounded-md p-6 space-y-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#ff006a]" /> Fikrlar va Izohlar ({comments.length})
            </h3>

            {/* Post Comment Form */}
            <form onSubmit={handlePostComment} className="space-y-3">
              <textarea
                rows={3}
                placeholder={user ? "Ushbu drama haqida o'z fikringizni qoldiring..." : "Fikr qoldirish uchun tizimga kiring..."}
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                disabled={!user}
                className="w-full bg-[#0a0a0a] border border-[#222] rounded-sm p-3 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#ff006a] resize-none disabled:opacity-50"
              />
              <div className="flex justify-between items-center">
                {!user ? (
                  <span className="text-[11px] text-white/40">
                    Izoh yozish uchun <Link to="/login" className="text-[#ff006a] hover:underline font-bold">Kiring</Link> yoki <Link to="/register" className="text-[#ff006a] hover:underline font-bold">Ro'yxatdan o'ting</Link>
                  </span>
                ) : (
                  <span className="text-[11px] text-white/40">Hurmat bilan fikr bildiring</span>
                )}

                <button
                  type="submit"
                  disabled={!user || submittingComment || !commentContent.trim()}
                  className="px-5 py-2 bg-[#ff006a] hover:bg-[#ff006a]/90 disabled:opacity-50 text-white text-xs font-bold rounded-sm flex items-center gap-2 transition-all uppercase tracking-wider cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> {submittingComment ? "Yuborilmoqda..." : "Fikr Qoldirish"}
                </button>
              </div>
            </form>

            {/* Comments List */}
            <div className="space-y-4 pt-4 border-t border-[#222]">
              {comments.length === 0 ? (
                <div className="text-center py-8 text-white/40 text-xs">
                  Hozircha hech qanday fikr qoldirilmagan. Birinchi bo'lib fikringizni yozing!
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="bg-[#0a0a0a] border border-[#222] rounded-sm p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#ff006a]/20 border border-[#ff006a]/40 text-[#ff006a] flex items-center justify-center text-xs font-bold overflow-hidden">
                          {comment.user_avatar ? (
                            <img src={comment.user_avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            (comment.user_name || 'U')[0].toUpperCase()
                          )}
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-white">{comment.user_name || "Foydalanuvchi"}</h5>
                          <span className="text-[10px] text-white/30">
                            {comment.created_at ? new Date(comment.created_at).toLocaleDateString('uz-UZ') : ''}
                          </span>
                        </div>
                      </div>

                      {/* Admin or Owner can delete */}
                      {user && (user.role === 'admin' || user.id === comment.user_id) && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-white/30 hover:text-red-400 p-1 transition-colors cursor-pointer"
                          title="Fikrni o'chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-white/80 pl-9 leading-relaxed">
                      {comment.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Tavsiya etiladigan boshqa dramalar */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
            <Film className="w-4 h-4 text-[#ff006a]" /> Boshqa Dramalar
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {relatedDramas.map((relDrama) => (
              <DramaCard key={relDrama.id} drama={relDrama} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
