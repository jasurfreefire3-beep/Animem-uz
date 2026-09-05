import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Upload, 
  Film, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowLeft, 
  Play, 
  Pause, 
  Tag, 
  Tv, 
  Sparkles, 
  X, 
  Image as ImageIcon, 
  FileVideo, 
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { uploadReelVideo } from '../utils/upload';

const POPULAR_TAGS = ['#anime', '#reels', '#animemuz', '#amv', '#naruto', '#onepiece', '#jujutsu', '#uzbek'];

export default function UploadPage() {
  const { user, token } = useAuth();
  const { getLocalizedPath } = useLanguage();
  const navigate = useNavigate();

  // Form state
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [animeTitle, setAnimeTitle] = useState('');
  const [tags, setTags] = useState('#anime #reels #animemuz');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [autoThumbnail, setAutoThumbnail] = useState('');
  const [isCustomThumb, setIsCustomThumb] = useState(false);

  // Video playback preview state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState<number>(0);

  // Upload progress state
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successReel, setSuccessReel] = useState<any | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Autocomplete anime suggestions
  const [animeSuggestions, setAnimeSuggestions] = useState<string[]>([]);
  const [allAnimes, setAllAnimes] = useState<Array<{ id: number; title: string }>>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const thumbInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch anime titles for quick suggestions
  useEffect(() => {
    let isMounted = true;
    const fetchAnimes = async () => {
      try {
        const res = await fetch('/api/animes');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && isMounted) {
            setAllAnimes(data);
            const titles = data.map((a: any) => a.title).filter(Boolean);
            setAnimeSuggestions(titles.slice(0, 15));
          }
        }
      } catch (_) {}
    };
    fetchAnimes();
    return () => { isMounted = false; };
  }, []);

  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Handle file selection
  const handleFileSelect = (selectedFile: File) => {
    setError(null);
    const maxSizeBytes = user?.role === 'admin' ? 100 * 1024 * 1024 : 30 * 1024 * 1024;
    const maxSizeMB = user?.role === 'admin' ? 100 : 30;

    if (!selectedFile.type.startsWith('video/')) {
      setError("Faqat video formatidagi fayllarni yuklashingiz mumkin (MP4, WebM, MOV)");
      return;
    }

    if (selectedFile.size > maxSizeBytes) {
      const currentMB = (selectedFile.size / (1024 * 1024)).toFixed(1);
      setError(`Video hajmi juda katta (${currentMB} MB). Maksimal ruxsat etilgan hajm: ${maxSizeMB} MB!`);
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setFile(selectedFile);
    setPreviewUrl(objectUrl);
    setIsPlaying(false);

    // Auto populate title from file name if empty
    if (!title.trim()) {
      const cleanName = selectedFile.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .trim();
      setTitle(cleanName);
    }

    // Auto extract thumbnail from video at 1.0 second
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = objectUrl;
    tempVideo.muted = true;
    tempVideo.playsInline = true;

    tempVideo.onloadedmetadata = () => {
      setDuration(tempVideo.duration || 0);
      tempVideo.currentTime = Math.min(1.0, (tempVideo.duration || 2) / 2);
    };

    tempVideo.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = tempVideo.videoWidth || 720;
        canvas.height = tempVideo.videoHeight || 1280;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL('image/jpeg', 0.85);
          setAutoThumbnail(base64);
          if (!isCustomThumb) {
            setThumbnailUrl(base64);
          }
        }
      } catch (e) {
        console.warn('Canvas video capture warning:', e);
      }
    };
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Custom thumbnail upload handler
  const handleCustomThumbSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const thumbFile = e.target.files?.[0];
    if (!thumbFile) return;

    if (!thumbFile.type.startsWith('image/')) {
      setError("Muqova uchun faqat rasm (JPG, PNG, WebP) yuklash mumkin");
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = reader.result as string;
        setThumbnailUrl(b64);
        setIsCustomThumb(true);
      };
      reader.readAsDataURL(thumbFile);
    } catch (_) {
      setError("Rasmni o'qishda xatolik");
    }
  };

  // Toggle tag in tags string
  const toggleTag = (tag: string) => {
    const currentTags = tags.split(/\s+/).filter(Boolean);
    if (currentTags.includes(tag)) {
      setTags(currentTags.filter(t => t !== tag).join(' '));
    } else {
      setTags([...currentTags, tag].join(' '));
    }
  };

  // Video play/pause toggle
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  // Main Submit Handler
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("Reel yuklash uchun avval tizimga kiring!");
      return;
    }

    if (!file) {
      setError("Iltimos, avval video faylini tanlang!");
      return;
    }

    if (!title.trim()) {
      setError("Iltimos, video sarlavhasini kiriting!");
      return;
    }

    setUploading(true);
    setUploadPercent(0);
    setUploadStatusText("Video yuklashga tayyorlanmoqda... 0%");
    setError(null);

    try {
      // 1. Upload video file with real-time percentage
      const authToken = token || localStorage.getItem('token') || '';
      const videoUrl = await uploadReelVideo(file, authToken, (pct, statusText) => {
        setUploadPercent(pct);
        setUploadStatusText(statusText);
      });

      // 2. Upload thumbnail if custom or base64
      let finalThumbUrl = thumbnailUrl || autoThumbnail || "https://files.catbox.moe/45hoi6.png";
      if (finalThumbUrl.startsWith('data:image')) {
        setUploadStatusText("Muqova rasmi saqlanmoqda...");
        try {
          const thumbRes = await fetch('/api/media/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify({ base64: finalThumbUrl })
          });
          if (thumbRes.ok) {
            const thumbData = await thumbRes.json();
            if (thumbData.url) {
              finalThumbUrl = thumbData.url;
            }
          }
        } catch (_) {}
      }

      // 3. Create reel entry in DB
      setUploadStatusText("Reel ma'lumotlari bazaga yozilmoqda...");
      const res = await fetch('/api/reels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          title: title.trim(),
          anime_title: animeTitle.trim() || 'Anime',
          video_url: videoUrl,
          thumbnail_url: finalThumbUrl,
          tags: tags.trim() || '#anime #reels #animemuz',
          author_name: user?.name || 'Foydalanuvchi',
          author_avatar: user?.avatar_url || 'https://files.catbox.moe/45hoi6.png'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Reelni saqlashda xatolik yuz berdi");
      }

      setUploadPercent(100);
      setUploadStatusText("Reel muvaffaqiyatli chop etildi!");
      setSuccessReel(data.reel || { id: data.id || 'new', title: title.trim() });
    } catch (err: any) {
      console.error("Reel upload failure:", err);
      setError(err?.message || "Video yuklashda xatolik yuz berdi. Iltimos qaytadan urinib ko'ring!");
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreviewUrl(null);
    setTitle('');
    setAnimeTitle('');
    setTags('#anime #reels #animemuz');
    setThumbnailUrl('');
    setAutoThumbnail('');
    setIsCustomThumb(false);
    setSuccessReel(null);
    setError(null);
    setUploadPercent(0);
  };

  // Auth gate if not logged in
  if (!user) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-[#0f0f11] border border-white/10 rounded-2xl p-6 sm:p-8 text-center space-y-5 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-600/20 to-purple-600/20 border border-pink-500/30 flex items-center justify-center mx-auto text-pink-500 shadow-lg shadow-pink-500/10">
            <Film className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Reels Yuklash Uchun Kiring
            </h1>
            <p className="text-sm text-white/60 leading-relaxed">
              O'zbek tilidagi qiziqarli anime lavhalari va reels videolaringizni butun hamjamiyat bilan bo'lishish uchun profilingizga kiring.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Link
              to={getLocalizedPath('/login')}
              className="flex-1 py-3 px-5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-pink-600/20 transition-all text-center"
            >
              Kirish
            </Link>
            <Link
              to={getLocalizedPath('/register')}
              className="flex-1 py-3 px-5 bg-white/5 hover:bg-white/10 text-white font-bold text-sm rounded-xl border border-white/10 transition-all text-center"
            >
              Ro'yxatdan o'tish
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto py-4 sm:py-8 px-3 sm:px-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(getLocalizedPath('/reels'))}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-95 cursor-pointer shrink-0"
            title="Reelsga qaytish"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-pink-400 uppercase tracking-wider mb-0.5">
              <span>Reels Platformasi</span>
              <span>•</span>
              <span className="text-white/50">animem.uz/upload</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Film className="w-6 h-6 text-pink-500" />
              Yangi Reel Video Yuklash
            </h1>
          </div>
        </div>

        {/* Requirements Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Max 30 MB
          </span>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">
            9:16 Vertikal
          </span>
          <Link
            to={getLocalizedPath('/reels')}
            className="text-[11px] font-bold px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-colors"
          >
            Reels ko'rish
          </Link>
        </div>
      </div>

      {/* Success State View */}
      {successReel ? (
        <div className="bg-[#0f0f11] border border-green-500/30 rounded-2xl p-6 sm:p-10 text-center space-y-6 shadow-2xl backdrop-blur-xl animate-fade-in max-w-xl mx-auto my-8">
          <div className="w-20 h-20 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto text-green-400 shadow-xl shadow-green-500/10">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white">Reel Muvaffaqiyatli Yuklandi!</h2>
            <p className="text-sm text-white/70">
              Sizning videongiz bazaga qo'shildi va barcha foydalanuvchilar uchun Reels lentasida namoyish etilmoqda.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => navigate(getLocalizedPath('/reels'))}
              className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-pink-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Film className="w-4 h-4" /> Reelsda Ko'rish
            </button>
            <button
              onClick={handleReset}
              className="flex-1 py-3 px-6 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm border border-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Yana Video Yuklash
            </button>
          </div>
        </div>
      ) : (
        /* Main Upload Grid */
        <form onSubmit={handleUploadSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Video Selector & Live Preview (5 cols on desktop) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[#0f0f11] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileVideo className="w-4 h-4 text-pink-500" />
                Video Fayli
              </h2>

              {!file ? (
                /* Empty Dropzone */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 min-h-[340px] sm:min-h-[420px] ${
                    isDragging
                      ? 'border-pink-500 bg-pink-500/10 scale-[1.01]'
                      : 'border-white/20 bg-white/[0.02] hover:border-pink-500/50 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-600/20 to-purple-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-bold text-white">Video faylni tanlang</p>
                    <p className="text-xs text-white/50">
                      yoki videoni shu yerga tashlang
                    </p>
                  </div>
                  <div className="text-[11px] text-white/40 space-y-0.5 pt-2">
                    <p>• Maksimal hajm: <strong className="text-pink-400">30 MB</strong></p>
                    <p>• Qo'llab-quvvatlanadi: MP4, WebM, MOV</p>
                    <p>• Tavsiya: 9:16 vertikal format</p>
                  </div>
                  <button
                    type="button"
                    className="mt-3 px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-md transition-all pointer-events-none"
                  >
                    Faylni tanlash
                  </button>
                </div>
              ) : (
                /* Selected Video Preview */
                <div className="space-y-3">
                  <div className="relative aspect-[9/16] w-full max-h-[450px] mx-auto bg-black rounded-xl overflow-hidden border border-white/10 flex items-center justify-center group shadow-2xl">
                    <video
                      ref={videoRef}
                      src={previewUrl || ''}
                      playsInline
                      loop
                      className="w-full h-full object-contain cursor-pointer"
                      onClick={togglePlay}
                    />

                    {/* Play/Pause overlay button */}
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-opacity hover:scale-105 active:scale-95 cursor-pointer z-10"
                    >
                      {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                    </button>

                    {/* Video metadata overlay badge */}
                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-[10px] bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 z-10">
                      <span className="font-mono text-white/80 truncate max-w-[150px]">{file.name}</span>
                      <span className="font-bold text-pink-400">{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                    </div>
                  </div>

                  {/* Change Video Button */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="text-xs text-pink-400 hover:text-pink-300 font-bold flex items-center gap-1.5 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Boshqa video tanlash
                    </button>
                    <span className="text-[11px] text-white/40">
                      {duration > 0 ? `${Math.round(duration)} soniya` : ''}
                    </span>
                  </div>
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
            </div>

            {/* Thumbnail Generator / Selector Card */}
            {file && (
              <div className="bg-[#0f0f11] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                    Video Muqovasi (Thumbnail)
                  </h3>
                  {isCustomThumb && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomThumb(false);
                        setThumbnailUrl(autoThumbnail);
                      }}
                      className="text-[11px] text-white/50 hover:text-white underline cursor-pointer"
                    >
                      Videodan olish
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-16 h-24 rounded-lg overflow-hidden bg-black border border-white/20 shrink-0 relative">
                    <img
                      src={thumbnailUrl || autoThumbnail || "https://files.catbox.moe/45hoi6.png"}
                      alt="Muqova"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <p className="text-xs text-white/70 leading-relaxed">
                      Muqova avtomatik videodan olindi. Istasangiz o'zingiz boshqa rasm yuklashingiz mumkin.
                    </p>
                    <button
                      type="button"
                      onClick={() => thumbInputRef.current?.click()}
                      disabled={uploading}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" /> Boshqa rasm yuklash
                    </button>
                  </div>
                </div>

                <input
                  ref={thumbInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleCustomThumbSelect}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Right Column: Metadata form & Upload Status (7 cols on desktop) */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-[#0f0f11] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-white/10">
                <Sparkles className="w-4 h-4 text-pink-500" />
                Reel Ma'lumotlari
              </h2>

              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80 flex items-center justify-between">
                  <span>Reel Sarlavhasi <span className="text-pink-500">*</span></span>
                  <span className="text-[10px] text-white/40 font-normal">{title.length}/100</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                  placeholder="Masalan: Gojo Saturo afsonaviy jangi"
                  disabled={uploading}
                  className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/15 text-white text-sm placeholder-white/30 focus:outline-none focus:border-pink-500 transition-colors"
                />
              </div>

              {/* Anime Title Input & Suggestions */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80 flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5 text-purple-400" />
                  <span>Qaysi Animega Tegishli?</span>
                </label>
                <input
                  type="text"
                  value={animeTitle}
                  onChange={(e) => setAnimeTitle(e.target.value)}
                  placeholder="Masalan: Jujutsu Kaisen, Naruto, One Piece..."
                  disabled={uploading}
                  className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/15 text-white text-sm placeholder-white/30 focus:outline-none focus:border-purple-500 transition-colors"
                />

                {/* Quick suggestions pills */}
                {animeSuggestions.length > 0 && !animeTitle && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {animeSuggestions.slice(0, 6).map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAnimeTitle(item)}
                        disabled={uploading}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 transition-colors cursor-pointer"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags & Quick Tag Selectors */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/80 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-pink-400" />
                  <span>Hashtaglar / Teglar</span>
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="#anime #reels #animemuz"
                  disabled={uploading}
                  className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/15 text-white text-sm placeholder-white/30 focus:outline-none focus:border-pink-500 transition-colors font-mono"
                />

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {POPULAR_TAGS.map((ptag) => {
                    const active = tags.includes(ptag);
                    return (
                      <button
                        key={ptag}
                        type="button"
                        onClick={() => toggleTag(ptag)}
                        disabled={uploading}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all cursor-pointer ${
                          active
                            ? 'bg-pink-600 text-white border border-pink-500 shadow-sm'
                            : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/10'
                        }`}
                      >
                        {ptag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Error Message Box */}
              {error && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              {/* Real-Time Upload Progress Indicator */}
              {uploading && (
                <div className="bg-gradient-to-b from-white/5 to-white/[0.02] border border-pink-500/30 rounded-2xl p-5 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-pink-500" />
                      {uploadStatusText || "Yuklanmoqda..."}
                    </span>
                    <span className="text-base font-black text-pink-400 font-mono">
                      {uploadPercent}%
                    </span>
                  </div>

                  {/* Progress Bar Container */}
                  <div className="w-full h-3 bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 rounded-full transition-all duration-200 shadow-md shadow-pink-500/30"
                      style={{ width: `${Math.max(3, uploadPercent)}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-white/40 text-right">
                    Iltimos, oyna yuklanish tugaguncha yopilmasin
                  </p>
                </div>
              )}

              {/* Submit Action Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={uploading || !file || !title.trim()}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-pink-600 via-pink-500 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-40 disabled:hover:from-pink-600 disabled:hover:to-purple-600 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-pink-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Yuklanmoqda ({uploadPercent}%)</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span>Reelni Chop Etish</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
