import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, X, Flame } from 'lucide-react';

export const ANIMEM_GIFS = [
  "https://api.animem.uz/i/47253226-8c0c-4bd7-8a13-63fc8ab21048",
  "https://api.animem.uz/i/024daac2-c373-46d9-a1d3-17b772cf9d8d",
  "https://api.animem.uz/i/7f001189-caff-4761-b773-1ef852ba3405",
  "https://api.animem.uz/i/e14ebcc6-3198-4769-988e-b532d768c2c0",
  "https://api.animem.uz/i/a6740e1b-8128-4a35-9b59-991702aa7953",
  "https://api.animem.uz/i/20275072-6bcb-4bbf-9c31-b963c535ca52",
  "https://api.animem.uz/i/7f56e16a-336f-40e7-a088-3e7d379b6e7e",
  "https://api.animem.uz/i/e013bbda-731b-4243-b1a5-82b9184e6ba8",
  "https://api.animem.uz/i/0ed4d485-ed9a-42c4-96cf-0ea9e2520ff8",
  "https://api.animem.uz/i/4dcca4bb-4a81-40ee-b12d-1584b122bc20",
  "https://api.animem.uz/i/ee473d3e-95c5-4654-ab79-0f7f80bf72ac",
  "https://api.animem.uz/i/94bf66ce-7403-4a2f-8db6-267f15cd3d73",
  "https://api.animem.uz/i/d5740534-37b6-42f2-92d1-0d6012f7b424",
  "https://api.animem.uz/i/d6702c5f-a45e-4259-b3ac-6ac028671136",
  "https://api.animem.uz/i/863cae92-7e12-46d6-96c5-cf6da96afa43",
  "https://api.animem.uz/i/11e32365-a5d1-44b8-9eaf-809040de5fc3",
  "https://api.animem.uz/i/7c9b7e12-2d75-418a-b867-2a83169b9143",
  "https://api.animem.uz/i/b0000dc1-622a-4136-b20d-c7464b2dfee3",
  "https://api.animem.uz/i/f29d2f0f-4eed-43e3-8a18-c68acf9703f2",
  "https://api.animem.uz/i/ebb32df7-d609-46fa-a739-57b686bea1a4",
  "https://api.animem.uz/i/6ad422b0-29ff-4c44-b3bd-30e6015701ae",
  "https://api.animem.uz/i/d5077661-9cde-4524-ae21-be259f1e8b8a",
  "https://api.animem.uz/i/423b7231-db98-41e6-ae1e-af0ded6ca0ef",
  "https://api.animem.uz/i/cfae88fb-ade5-495c-a441-5b800075382b",
  "https://api.animem.uz/i/6b895206-f186-4db0-9a82-89ad97769806",
  "https://api.animem.uz/i/088aba4e-b0ef-443b-b7a6-bf6b8609e2b4",
  "https://api.animem.uz/i/208c0d15-d9cb-4507-ac51-814423a11d59",
  "https://api.animem.uz/i/632296a9-9ef1-453a-ac08-9db0aebdfc8c"
];

// Global in-memory cache for fast display
let cachedGifList: string[] = ANIMEM_GIFS;

interface GifPickerProps {
  onSelectGif: (gifUrl: string) => void;
  onClose?: () => void;
  className?: string;
}

export default function GifPicker({ onSelectGif, onClose, className = '' }: GifPickerProps) {
  const [gifList, setGifList] = useState<string[]>(cachedGifList);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/gifs')
      .then(res => res.json())
      .then(data => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          const urls = data.map((item: any) => item.url || item).filter(Boolean);
          if (urls.length > 0) {
            cachedGifList = urls;
            setGifList(urls);
          }
        }
      })
      .catch(() => {
        // Fallback to static list
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className={`bg-[#121216] border border-[#ff006a]/30 rounded-2xl shadow-2xl overflow-hidden w-72 sm:w-84 flex flex-col z-50 select-none backdrop-blur-xl shadow-black/90 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between bg-[#0a0a0d] border-b border-white/10 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="px-1.5 py-0.5 rounded bg-[#ff006a]/20 border border-[#ff006a]/50 text-[#ff006a] font-black text-[10px] tracking-wider">
            GIF
          </div>
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#ff006a]" />
            Anime GIF Stikerlar
          </span>
          <span className="text-[10px] font-semibold text-white/40 bg-white/5 px-1.5 py-0.5 rounded-full">
            {gifList.length} ta
          </span>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            title="Yopish"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* GIFs Grid */}
      <div className="p-2.5 max-h-64 sm:max-h-72 overflow-y-auto custom-scrollbar grid grid-cols-4 gap-2 bg-[#09090c]">
        {gifList.map((gifUrl, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setSelectedIdx(idx);
              onSelectGif(gifUrl);
            }}
            className={`group relative aspect-square rounded-xl overflow-hidden bg-[#181820] border transition-all duration-200 cursor-pointer flex items-center justify-center p-1 hover:scale-105 active:scale-95 ${
              selectedIdx === idx
                ? 'border-[#ff006a] ring-2 ring-[#ff006a]/40 bg-[#ff006a]/10'
                : 'border-white/10 hover:border-[#ff006a]/70 hover:shadow-lg hover:shadow-[#ff006a]/20'
            }`}
          >
            <img
              src={gifUrl}
              alt={`Anime GIF ${idx + 1}`}
              className="w-full h-full object-contain pointer-events-none group-hover:scale-110 transition-transform duration-200"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/100x100?text=GIF';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>

      {/* Footer Info */}
      <div className="px-3 py-1.5 bg-[#0a0a0d] border-t border-white/5 flex items-center justify-between text-[10px] text-white/40">
        <span className="flex items-center gap-1">
          <Flame size={11} className="text-[#ff006a]" /> Animem.uz GIF kolleksiyasi
        </span>
        <span className="text-[9px] text-white/30">Bosib yuboring</span>
      </div>
    </motion.div>
  );
}
