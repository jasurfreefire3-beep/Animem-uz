import React, { useState, useEffect } from 'react';
import { Film, Plus, Trash2, Edit2, Search, X, Check, Eye, Link as LinkIcon, Calendar, Tag, Layers, Sparkles } from 'lucide-react';
import { Drama } from '../types';
import ImageUploader from './ImageUploader';

interface AdminDramalarProps {
  token: string | null;
}

export default function AdminDramalar({ token }: AdminDramalarProps) {
  const [subTab, setSubTab] = useState<'drama_list' | 'add_drama'>('drama_list');
  const [dramas, setDramas] = useState<Drama[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Form State
  const [editingDrama, setEditingDrama] = useState<Drama | null>(null);
  const [title, setTitle] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [janrlar, setJanrlar] = useState('');
  const [yil, setYil] = useState(new Date().getFullYear().toString());
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [telegramUrl, setTelegramUrl] = useState('');

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);

  useEffect(() => {
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

  const resetForm = () => {
    setEditingDrama(null);
    setTitle('');
    setPosterUrl('');
    setBannerUrl('');
    setJanrlar('');
    setYil(new Date().getFullYear().toString());
    setDescription('');
    setVideoUrl('');
    setTelegramUrl('');
  };

  const startEditDrama = (d: Drama) => {
    setEditingDrama(d);
    setTitle(d.title);
    setPosterUrl(d.poster_url || '');
    setBannerUrl(d.banner_url || '');
    setJanrlar(d.janrlar || '');
    setYil((d.yil || new Date().getFullYear()).toString());
    setDescription(d.description || '');
    setVideoUrl(d.video_url || '');
    setTelegramUrl(d.telegram_url || '');
    setSubTab('add_drama');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setMessage({ type: 'error', text: 'Drama nomini kiriting' });
      return;
    }
    if (!posterUrl.trim()) {
      setMessage({ type: 'error', text: 'Drama rasmini yuklang yoki URL kiriting' });
      return;
    }

    try {
      const payload = {
        title: title.trim(),
        poster_url: posterUrl.trim(),
        banner_url: bannerUrl.trim() || posterUrl.trim(),
        janrlar: janrlar.trim() || 'Drama',
        yil: parseInt(yil) || new Date().getFullYear(),
        description: description.trim(),
        video_url: videoUrl.trim(),
        telegram_url: telegramUrl.trim()
      };

      const url = editingDrama ? `/api/dramas/${editingDrama.id}` : '/api/dramas';
      const method = editingDrama ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Saqlashda xatolik yuz berdi');
      }

      setMessage({ 
        type: 'success', 
        text: editingDrama ? 'Drama muvaffaqiyatli yangilandi!' : 'Yangi drama muvaffaqiyatli qo\'shildi!' 
      });
      resetForm();
      fetchDramas();
      setSubTab('drama_list');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Xatolik yuz berdi' });
    }
  };

  const handleDeleteDrama = async (id: string | number) => {
    try {
      const res = await fetch(`/api/dramas/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Drama o\'chirildi!' });
        setDeleteConfirmId(null);
        fetchDramas();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'O\'chirishda xatolik' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Server bilan aloqa uzildi' });
    }
  };

  const filteredDramas = dramas.filter(d => 
    (d.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.janrlar || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (String(d.yil) || '').includes(searchQuery)
  );

  const popularGenreExamples = ["Romantika", "Komediya", "Melodrama", "Jangari", "Tarixiy", "Mistika", "Fantastika", "Dahshatli", "Tibbiyot", "Maktab"];

  const handleAddGenreTag = (genre: string) => {
    if (!janrlar) {
      setJanrlar(genre);
    } else {
      const existing = janrlar.split(',').map(s => s.trim().toLowerCase());
      if (!existing.includes(genre.toLowerCase())) {
        setJanrlar(`${janrlar}, ${genre}`);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#222] pb-4">
        <button
          onClick={() => { setSubTab('drama_list'); resetForm(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors ${
            subTab === 'drama_list' ? 'bg-[#ff006a] text-white' : 'bg-[#111] text-white/60 hover:text-white hover:bg-[#1a1a1a]'
          }`}
        >
          <Film className="w-4 h-4" /> Barcha Dramalar ({dramas.length})
        </button>
        <button
          onClick={() => { setSubTab('add_drama'); resetForm(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors ${
            subTab === 'add_drama' ? 'bg-[#ff006a] text-white' : 'bg-[#111] text-white/60 hover:text-white hover:bg-[#1a1a1a]'
          }`}
        >
          <Plus className="w-4 h-4" /> {editingDrama ? 'Dramani Tahrirlash' : 'Yangi Drama Qo\'shish'}
        </button>
      </div>

      {/* Alert Messages */}
      {message.text && (
        <div className={`p-4 rounded-sm border text-xs font-semibold flex items-center justify-between ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Drama List Tab */}
      {subTab === 'drama_list' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Dramalarni qidirish (nomi, janri, yili)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#111] border border-[#222] rounded-sm pl-9 pr-4 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#ff006a]"
              />
            </div>
            <button
              onClick={() => { resetForm(); setSubTab('add_drama'); }}
              className="bg-[#ff006a] hover:bg-[#ff006a]/80 text-white px-4 py-2 rounded-sm text-xs font-bold flex items-center justify-center gap-2 uppercase tracking-wide"
            >
              <Plus className="w-4 h-4" /> Drama Qo'shish
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-white/40 text-xs">Yuklanmoqda...</div>
          ) : filteredDramas.length === 0 ? (
            <div className="text-center py-12 bg-[#111] border border-[#222] rounded-sm text-white/40 text-xs">
              Hech qanday drama topilmadi.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredDramas.map((drama) => (
                <div key={drama.id} className="bg-[#111] border border-[#222] rounded-sm overflow-hidden flex flex-col group hover:border-[#ff006a]/40 transition-colors">
                  <div className="relative aspect-[3/4] bg-black overflow-hidden">
                    <img 
                      src={drama.poster_url} 
                      alt={drama.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/10">
                      {drama.yil}
                    </div>
                    <div className="absolute top-2 right-2 bg-[#ff006a]/90 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                      ❤️ {drama.likes || 0}
                    </div>
                  </div>

                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white line-clamp-1 group-hover:text-[#ff006a] transition-colors">
                        {drama.title}
                      </h4>
                      <p className="text-[11px] text-white/50 mt-1 line-clamp-1">
                        {drama.janrlar}
                      </p>
                      <div className="text-[10px] text-white/30 mt-1">
                        Ko'rishlar: {drama.korishlar || 0}
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-[#222] flex items-center justify-between">
                      <a 
                        href={`/drama/${drama.id}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-white/60 hover:text-white text-xs flex items-center gap-1"
                        title="Saytda ko'rish"
                      >
                        <Eye className="w-3.5 h-3.5" /> Ko'rish
                      </a>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEditDrama(drama)}
                          className="p-1.5 hover:bg-[#222] rounded text-white/60 hover:text-white transition-colors"
                          title="Tahrirlash"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        
                        {deleteConfirmId === drama.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteDrama(drama.id)}
                              className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded"
                              title="O'chirishni tasdiqlash"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="p-1.5 bg-white/10 text-white/60 hover:bg-white/20 rounded"
                              title="Bekor qilish"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(drama.id)}
                            className="p-1.5 hover:bg-red-500/10 text-white/60 hover:text-red-400 rounded transition-colors"
                            title="O'chirish"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Drama Form */}
      {subTab === 'add_drama' && (
        <form onSubmit={handleSubmit} className="bg-[#111] border border-[#222] rounded-sm p-6 space-y-6 max-w-4xl">
          <div className="flex items-center justify-between border-b border-[#222] pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Film className="w-5 h-5 text-[#ff006a]" />
              {editingDrama ? 'Dramani Tahrirlash' : 'Yangi Drama Qo\'shish'}
            </h3>
            {editingDrama && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-white/50 hover:text-white"
              >
                Bekor qilish
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Col: Nomi, Janri, Yili */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white mb-2 uppercase tracking-wide">
                  Drama Nomi *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Crash Landing on You, Vincenzo..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#000] border border-[#222] rounded-sm px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff006a]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-2 uppercase tracking-wide flex items-center justify-between">
                  <span>Janri (vergul bilan yoziladi) *</span>
                  <span className="text-[10px] text-white/40 lowercase">Masalan: Romantika, Komediya, Melodrama</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Romantika, Melodrama, Komediya, Jangari"
                  value={janrlar}
                  onChange={(e) => setJanrlar(e.target.value)}
                  className="w-full bg-[#000] border border-[#222] rounded-sm px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff006a]"
                />
                {/* Quick Genre Suggestions */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-white/40 flex items-center mr-1">Tezkor:</span>
                  {popularGenreExamples.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => handleAddGenreTag(g)}
                      className="px-2 py-0.5 bg-[#1a1a1a] hover:bg-[#ff006a]/20 hover:text-[#ff006a] text-white/60 rounded text-[10px] transition-colors"
                    >
                      + {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-2 uppercase tracking-wide">
                  Chiqarilgan Yili *
                </label>
                <input
                  type="number"
                  required
                  placeholder="2024"
                  value={yil}
                  onChange={(e) => setYil(e.target.value)}
                  className="w-full bg-[#000] border border-[#222] rounded-sm px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff006a]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-2 uppercase tracking-wide">
                  Video Havolasi (MP4 / HLS / Iframe / Sibnet / YouTube)
                </label>
                <input
                  type="text"
                  placeholder="https://... yoki iframe link"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="w-full bg-[#000] border border-[#222] rounded-sm px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff006a]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-2 uppercase tracking-wide">
                  Telegram Kanal / Post Havolasi (ixtiyoriy)
                </label>
                <input
                  type="text"
                  placeholder="https://t.me/animem_uz/..."
                  value={telegramUrl}
                  onChange={(e) => setTelegramUrl(e.target.value)}
                  className="w-full bg-[#000] border border-[#222] rounded-sm px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff006a]"
                />
              </div>
            </div>

            {/* Right Col: Poster (Device Upload / URL) & Banner */}
            <div className="space-y-4">
              <ImageUploader
                label="Drama Rasmi / Posteri (Qurilmadan yuklash yoki URL) *"
                value={posterUrl}
                onChange={setPosterUrl}
                aspectRatio="poster"
                required
                helpText="Qurilmangizdan rasm faylini tanlang yoki to'g'ridan-to'g'ri tashlang (JPG, PNG, WebP)"
              />

              <ImageUploader
                label="Orqa Fon / Banner Rasmi (Ixtiyoriy)"
                value={bannerUrl}
                onChange={setBannerUrl}
                aspectRatio="banner"
                helpText="Keng formatli banner rasmi (bo'sh qoldirilsa poster ishlatiladi)"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-white mb-2 uppercase tracking-wide">
              Drama Tavsifi / Syujeti (Ixtiyoriy)
            </label>
            <textarea
              rows={4}
              placeholder="Drama syujeti haqida qisqacha ma'lumot..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#000] border border-[#222] rounded-sm p-3 text-xs text-white focus:outline-none focus:border-[#ff006a] resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#222]">
            <button
              type="button"
              onClick={() => { resetForm(); setSubTab('drama_list'); }}
              className="px-4 py-2 bg-[#222] hover:bg-[#333] text-white/80 hover:text-white rounded-sm text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-[#ff006a] hover:bg-[#ff006a]/90 text-white rounded-sm text-xs font-bold flex items-center gap-2 uppercase tracking-wider shadow-lg shadow-[#ff006a]/20 transition-all"
            >
              <Check className="w-4 h-4" /> {editingDrama ? 'O\'zgarishlarni Saqlash' : 'Dramani Saqlash'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
