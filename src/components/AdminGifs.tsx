import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Upload, Link as LinkIcon, Trash2, Plus, 
  Check, Copy, Image, RefreshCw, AlertCircle, Eye, Film, FileText, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface GifItem {
  id: number;
  title: string;
  url: string;
  media_id?: string | null;
  created_at?: string;
}

export default function AdminGifs() {
  const { token } = useAuth();
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Mode: 'upload' or 'url'
  const [addMode, setAddMode] = useState<'upload' | 'url'>('upload');

  // URL mode states
  const [gifUrl, setGifUrl] = useState('');
  const [gifTitle, setGifTitle] = useState('');
  const [isSubmittingUrl, setIsSubmittingUrl] = useState(false);

  // Upload mode states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete modal/state
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchGifs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/gifs');
      if (!res.ok) throw new Error('GIF-larni yuklab bo‘lmadi');
      const data = await res.json();
      setGifs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGifs();
  }, []);

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
      
      const objectUrl = URL.createObjectURL(file);
      setFilePreview(objectUrl);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));

      const objectUrl = URL.createObjectURL(file);
      setFilePreview(objectUrl);
    }
  };

  // Upload file from device directly to MySQL
  const handleUploadFromDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Iltimos, avval qurilmangizdan GIF faylini tanlang');
      return;
    }

    setIsUploadingFile(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (uploadTitle.trim()) {
        formData.append('title', uploadTitle.trim());
      }

      const res = await fetch('/api/gifs/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Yuklashda xatolik yuz berdi');
      }

      setSuccess('GIF stiker muvaffaqiyatli MySQL bazasiga yuklandi!');
      setSelectedFile(null);
      setFilePreview(null);
      setUploadTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // Update local state
      if (data.gif) {
        setGifs(prev => [...prev, data.gif]);
      } else {
        fetchGifs();
      }
    } catch (err: any) {
      setError(err.message || 'Yuklashda xatolik');
    } finally {
      setIsUploadingFile(false);
    }
  };

  // Add GIF via URL
  const handleAddViaUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gifUrl.trim()) {
      setError('Iltimos, GIF URL manzilini kiriting');
      return;
    }

    setIsSubmittingUrl(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/gifs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          url: gifUrl.trim(),
          title: gifTitle.trim() || 'Anime GIF'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Qo‘shishda xatolik');
      }

      setSuccess('GIF havola muvaffaqiyatli saqlandi!');
      setGifUrl('');
      setGifTitle('');

      if (data.gif) {
        setGifs(prev => [...prev, data.gif]);
      } else {
        fetchGifs();
      }
    } catch (err: any) {
      setError(err.message || 'Qo‘shishda xatolik');
    } finally {
      setIsSubmittingUrl(false);
    }
  };

  // Delete GIF
  const handleDelete = async (id: number) => {
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/gifs/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'O‘chirishda xatolik');
      }

      setSuccess('GIF muvaffaqiyatli o‘chirildi!');
      setGifs(prev => prev.filter(g => g.id !== id));
      setDeletingId(null);
    } catch (err: any) {
      setError(err.message || 'O‘chirishda xatolik');
    }
  };

  const handleCopyTag = (gif: GifItem) => {
    const text = `[gif]${gif.url}[/gif]`;
    navigator.clipboard.writeText(text);
    setCopiedId(gif.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Info */}
      <div className="bg-[#181820] border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff006a]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#ff006a]/20 border border-[#ff006a]/40 text-[#ff006a] text-xs font-bold uppercase tracking-wider">
                Stikerlar Boshqaruvi
              </span>
              <span className="text-xs font-semibold text-white/50 bg-white/5 px-2 py-0.5 rounded-full">
                Jami: {gifs.length} ta GIF
              </span>
            </div>
            <h2 className="text-xl font-black text-white flex items-center gap-2 tracking-wide">
              <Sparkles className="text-[#ff006a]" size={22} />
              Anime GIF Stikerlar & Reaksiyalar
            </h2>
            <p className="text-white/60 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Qurilmangizdan to‘g‘ridan-to‘g‘ri MySQL ma’lumotlar bazasiga yangi GIF stikerlar yuklang yoki istalgan tashqi havola orqali qo‘shing. Ular chat va izohlarda darhol paydo bo‘ladi.
            </p>
          </div>

          <button
            onClick={fetchGifs}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 text-xs font-bold transition-all self-start md:self-auto cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-[#ff006a]' : ''} />
            Yangilash
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-red-400 hover:text-white text-xs font-bold cursor-pointer">
              Yopish
            </button>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 size={18} />
              <span>{success}</span>
            </div>
            <button onClick={() => setSuccess('')} className="text-green-400 hover:text-white text-xs font-bold cursor-pointer">
              Yopish
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add GIF Section */}
      <div className="bg-[#121216] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Plus size={18} className="text-[#ff006a]" />
            Yangi GIF Stiker Qo‘shish
          </h3>

          {/* Mode Switcher */}
          <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10 self-start">
            <button
              type="button"
              onClick={() => setAddMode('upload')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                addMode === 'upload'
                  ? 'bg-[#ff006a] text-white shadow-md shadow-[#ff006a]/30'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Upload size={13} />
              Qurilmadan Yuklash (MySQL)
            </button>
            <button
              type="button"
              onClick={() => setAddMode('url')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                addMode === 'url'
                  ? 'bg-[#ff006a] text-white shadow-md shadow-[#ff006a]/30'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <LinkIcon size={13} />
              Havola (URL) Orqali
            </button>
          </div>
        </div>

        {/* Tab 1: Upload from device */}
        {addMode === 'upload' && (
          <form onSubmit={handleUploadFromDevice} className="space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                selectedFile 
                  ? 'border-[#ff006a]/60 bg-[#ff006a]/5' 
                  : 'border-white/20 hover:border-[#ff006a]/50 bg-black/30 hover:bg-black/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".gif,image/gif,image/webp,image/png,image/jpeg"
                onChange={handleFileChange}
                className="hidden"
              />

              {filePreview ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-28 h-28 rounded-xl overflow-hidden bg-black/60 border border-[#ff006a]/40 shadow-xl flex items-center justify-center p-1">
                    <img src={filePreview} alt="Preview" className="w-full h-full object-contain" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white">{selectedFile?.name}</p>
                    <p className="text-[11px] text-white/40">
                      {selectedFile ? (selectedFile.size / 1024).toFixed(1) + ' KB' : ''} • Boshqa fayl tanlash uchun bosing
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-2xl bg-[#ff006a]/10 border border-[#ff006a]/30 flex items-center justify-center text-[#ff006a] mb-1">
                    <Upload size={24} />
                  </div>
                  <p className="text-sm font-bold text-white">GIF faylni tanlash yoki shu yerga tashlash</p>
                  <p className="text-xs text-white/40 max-w-sm">
                    Qurilmangizdagi GIF (yoki WebP/PNG) fayllarni to‘g‘ridan-to‘g‘ri MySQL server bazasiga saqlaydi
                  </p>
                </div>
              )}
            </div>

            {selectedFile && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-white/70 mb-1.5">
                    Stiker nomi / tavsifi (Ixtiyoriy)
                  </label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Masalan: Naruto kulayotgan, Anya smaylik..."
                    className="w-full bg-[#181820] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#ff006a]"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isUploadingFile}
                    className="w-full bg-[#ff006a] hover:bg-[#d40058] disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-[#ff006a]/20"
                  >
                    {isUploadingFile ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        MySQL ga yuklanmoqda...
                      </>
                    ) : (
                      <>
                        <Upload size={14} />
                        MySQL bazasiga saqlash
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}

        {/* Tab 2: Add via URL */}
        {addMode === 'url' && (
          <form onSubmit={handleAddViaUrl} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5">
                  GIF Havolasi (URL) <span className="text-[#ff006a]">*</span>
                </label>
                <div className="relative">
                  <LinkIcon className="absolute left-3.5 top-3 text-white/30" size={14} />
                  <input
                    type="url"
                    required
                    value={gifUrl}
                    onChange={(e) => setGifUrl(e.target.value)}
                    placeholder="https://media.giphy.com/media/.../giphy.gif"
                    className="w-full bg-[#181820] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#ff006a]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5">
                  Stiker nomi (Ixtiyoriy)
                </label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-3 text-white/30" size={14} />
                  <input
                    type="text"
                    value={gifTitle}
                    onChange={(e) => setGifTitle(e.target.value)}
                    placeholder="Masalan: Gojo Satoru ko'zoynak"
                    className="w-full bg-[#181820] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#ff006a]"
                  />
                </div>
              </div>
            </div>

            {/* Live Preview if URL entered */}
            {gifUrl.trim() && (
              <div className="flex items-center gap-4 p-3 bg-black/40 rounded-xl border border-white/10">
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-black/60 border border-white/10 flex items-center justify-center p-1 shrink-0">
                  <img
                    src={gifUrl}
                    alt="Preview"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/100x100?text=Xato+URL';
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{gifTitle || 'Nomsiz GIF'}</p>
                  <p className="text-[11px] text-white/40 truncate">{gifUrl}</p>
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingUrl}
                  className="bg-[#ff006a] hover:bg-[#d40058] disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  {isSubmittingUrl ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                  Saqlash
                </button>
              </div>
            )}

            {!gifUrl.trim() && (
              <button
                type="submit"
                disabled={isSubmittingUrl}
                className="bg-[#ff006a] hover:bg-[#d40058] text-white font-bold py-2.5 px-6 rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Plus size={14} />
                GIF Qo‘shish
              </button>
            )}
          </form>
        )}
      </div>

      {/* GIFs List / Grid */}
      <div className="bg-[#121216] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Film className="text-[#ff006a]" size={18} />
            <h3 className="text-base font-bold text-white">Mavjud GIF Stikerlar</h3>
            <span className="text-xs bg-[#ff006a]/20 text-[#ff006a] px-2 py-0.5 rounded-full font-bold">
              {gifs.length} ta
            </span>
          </div>

          <p className="text-[11px] text-white/40 hidden sm:block">
            Har bir stikerni o‘chirishingiz yoki havolasini nusxalashingiz mumkin
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <RefreshCw className="animate-spin text-[#ff006a]" size={28} />
            <span className="text-xs font-semibold text-white/50">GIF stikerlar yuklanmoqda...</span>
          </div>
        ) : gifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
              <Sparkles size={28} />
            </div>
            <h4 className="text-sm font-bold text-white">Hech qanday GIF topilmadi</h4>
            <p className="text-xs text-white/40 max-w-sm">
              Yuqoridagi maydondan yangi GIF yuklang yoki URL orqali qo‘shing
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {gifs.map((gif, index) => (
              <div
                key={gif.id || index}
                className="group relative bg-[#181820] border border-white/10 rounded-xl overflow-hidden hover:border-[#ff006a]/70 hover:shadow-lg hover:shadow-[#ff006a]/20 transition-all flex flex-col"
              >
                {/* Image Container */}
                <div className="relative aspect-square bg-[#0c0c10] flex items-center justify-center p-2">
                  <img
                    src={gif.url}
                    alt={gif.title || `GIF ${index + 1}`}
                    className="w-full h-full object-contain pointer-events-none group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/150x150?text=GIF';
                    }}
                  />

                  {/* Badges */}
                  {gif.media_id && (
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[9px] font-bold">
                      MySQL
                    </span>
                  )}

                  {/* Actions overlay */}
                  <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                    <button
                      type="button"
                      onClick={() => handleCopyTag(gif)}
                      className="p-2 rounded-lg bg-white/10 hover:bg-[#ff006a] text-white transition-colors cursor-pointer"
                      title="[gif]...[/gif] kodini nusxalash"
                    >
                      {copiedId === gif.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(gif.id)}
                      className="p-2 rounded-lg bg-white/10 hover:bg-red-600 text-white transition-colors cursor-pointer"
                      title="O‘chirish"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Title info */}
                <div className="p-2 bg-[#121216] border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/70 truncate" title={gif.title}>
                    {gif.title || `#${index + 1} GIF`}
                  </span>
                  <span className="text-[9px] text-white/30">
                    #{index + 1}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#181820] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl"
            >
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
                <Trash2 size={24} />
              </div>
              <div className="text-center space-y-1">
                <h4 className="text-base font-bold text-white">GIF stikerni o‘chirmoqchimisiz?</h4>
                <p className="text-xs text-white/50">
                  Ushbu GIF ma’lumotlar bazasidan va chat stikerlaridan butunlay olib tashlanadi.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingId(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(deletingId)}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-red-600/30"
                >
                  Ha, o‘chirish
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
