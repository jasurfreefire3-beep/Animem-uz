import React, { useState } from 'react';
import { X, Copy, Check, Share2, Send } from 'lucide-react';
import { Reel } from '../types';

interface ReelsShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  reel: Reel;
  onShareSuccess?: () => void;
}

export default function ReelsShareModal({
  isOpen,
  onClose,
  reel,
  onShareSuccess,
}: ReelsShareModalProps) {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/reels?reel=${reel.id}` 
    : `https://animem.uz/reels?reel=${reel.id}`;

  const shareText = `Animem.uz'da ajoyib anime reel: "${reel.title}" tomosha qiling! 🔥\n${currentUrl}`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(currentUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      notifyServerShared();
    } catch (e) {
      console.warn('Copy failed', e);
    }
  };

  const notifyServerShared = () => {
    fetch(`/api/reels/${reel.id}/share`, { method: 'POST' }).catch(() => {});
    if (onShareSuccess) onShareSuccess();
  };

  const handleTelegramShare = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(reel.title)}`;
    window.open(url, '_blank');
    notifyServerShared();
  };

  const handleWhatsAppShare = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
    notifyServerShared();
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: reel.title,
          text: `Animem.uz reels: ${reel.title}`,
          url: currentUrl,
        });
        notifyServerShared();
      } catch (e) {}
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full sm:max-w-sm bg-[#141419] border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl flex flex-col space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center space-x-2">
            <Share2 className="w-5 h-5 text-pink-500" />
            <h3 className="font-semibold text-white text-base">Ulashish</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Share buttons */}
        <div className="grid grid-cols-3 gap-3">
          {/* Telegram */}
          <button
            onClick={handleTelegramShare}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-[#229ED9]/15 hover:bg-[#229ED9]/25 border border-[#229ED9]/30 text-white transition-all space-y-2 group"
          >
            <div className="w-10 h-10 rounded-full bg-[#229ED9] flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <Send className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-medium text-white/90">Telegram</span>
          </button>

          {/* WhatsApp */}
          <button
            onClick={handleWhatsAppShare}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-white transition-all space-y-2 group"
          >
            <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-medium text-white/90">WhatsApp</span>
          </button>

          {/* Device Share or Copy */}
          <button
            onClick={handleNativeShare}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/30 text-white transition-all space-y-2 group"
          >
            <div className="w-10 h-10 rounded-full bg-pink-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-medium text-white/90">Boshqa</span>
          </button>
        </div>

        {/* Copy Link Input */}
        <div className="pt-2">
          <label className="text-xs text-white/50 block mb-1.5 font-medium">Reel havolasi</label>
          <div className="flex items-center space-x-2 bg-white/5 border border-white/10 rounded-xl p-1.5 pl-3">
            <input
              type="text"
              readOnly
              value={currentUrl}
              className="bg-transparent text-xs text-white/80 w-full outline-none select-all"
            />
            <button
              onClick={handleCopyLink}
              className="px-3 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-xs font-semibold text-white flex items-center space-x-1.5 transition-all shrink-0 active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Nusxalandi!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Nusxa olish</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
