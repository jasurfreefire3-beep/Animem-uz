import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell, Send, Image as ImageIcon, Sparkles } from 'lucide-react';
import ImageUploader from './ImageUploader';

export default function AdminNotifications() {
  const { token } = useAuth();
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', text: '' });

  const handleSend = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setStatus({ type: '', text: '' });
    
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
      const res = await fetch(`${API_BASE}/api/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          message: message.trim(),
          image: imageUrl.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Yuborishda xatolik yuz berdi');
      }

      setMessage('');
      setImageUrl('');
      setStatus({ type: 'success', text: "Web Push va MySQL bildirishnomasi barcha foydalanuvchilar qurilmasiga muvaffaqiyatli yuborildi! 🎉" });
    } catch (error: any) {
      console.error('Error sending notification:', error);
      setStatus({ type: 'error', text: error.message || "Xatolik yuz berdi" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-5 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#222] pb-4">
        <div>
          <h2 className="text-base font-bold text-white uppercase tracking-wide flex items-center">
            <Bell className="w-5 h-5 text-[#ff006a] mr-2 animate-bounce" /> Web Push & Qurilma Bildirishnomalari (MySQL)
          </h2>
          <p className="text-white/50 text-xs mt-1">
            Saytga kirmagan foydalanuvchilar (Android, Chrome, Windows/Mac) qurilmasiga ham to'g'ridan-to'g'ri animening rasmi bilan yetib boradi.
          </p>
        </div>
        <span className="px-2.5 py-1 bg-[#ff006a]/20 text-[#ff006a] border border-[#ff006a]/30 text-[11px] font-bold rounded-lg shrink-0 flex items-center gap-1 w-fit">
          <Sparkles size={12} /> Web Push API
        </span>
      </div>
      
      {status.text && (
        <div className={`p-4 rounded-xl text-xs font-bold ${
          status.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {status.text}
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-white/70 mb-2 uppercase">Bildirishnoma Xabari *</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Masalan: Solo Leveling 2-mavsum premyerasi chiqdi! O'zbek tilida hoziroq tomosha qiling..."
          className="w-full bg-[#000] border border-[#222] rounded-xl p-4 text-white placeholder-white/30 focus:outline-none focus:border-[#ff006a] min-h-[100px] text-sm"
        />
      </div>

      <div>
        <ImageUploader
          label="Bildirishnomaga biriktiriladigan Anime Rasmi (Ixtiyoriy)"
          value={imageUrl}
          onChange={(url) => setImageUrl(url)}
          aspectRatio="banner"
          placeholder="https://... yoki qurilmadan rasm yuklang"
          helpText="Qurilmaga kelganda ushbu rasm katta formatda ko'rsatiladi"
        />
      </div>

      <button
        onClick={handleSend}
        disabled={loading || !message.trim()}
        className="bg-gradient-to-r from-[#ff006a] to-[#e6005c] hover:from-[#e6005c] hover:to-[#ff006a] disabled:opacity-50 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-[#ff006a]/30 flex items-center justify-center cursor-pointer text-sm"
      >
        <Send size={16} className="mr-2" />
        {loading ? 'Barcha qurilmalarga yuborilmoqda...' : 'Barcha foydalanuvchilarga yuborish'}
      </button>
    </div>
  );
}
