import React from 'react';
import { ExternalLink, Sparkles, Gift, Zap } from 'lucide-react';

interface DirectLinkAdBannerProps {
  className?: string;
  variant?: 'banner' | 'compact' | 'card';
}

export const PROPELLER_DIRECT_URL = "https://omg10.com/4/11676563";

export default function DirectLinkAdBanner({ className = '', variant = 'banner' }: DirectLinkAdBannerProps) {
  if (variant === 'compact') {
    return (
      <a
        href={PROPELLER_DIRECT_URL}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className={`group flex items-center justify-between gap-3 px-4 py-2.5 bg-gradient-to-r from-[#1f1024] via-[#16101f] to-[#1a0e21] hover:from-[#2e1538] hover:to-[#251230] border border-[#ff006a]/30 hover:border-[#ff006a]/60 rounded-xl transition-all duration-300 shadow-[0_0_15px_rgba(255,0,106,0.15)] ${className}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-[#ff006a]/20 border border-[#ff006a]/40 flex items-center justify-center text-[#ff006a] shrink-0">
            <Gift size={14} className="animate-bounce" />
          </span>
          <div className="truncate">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 bg-[#ff006a]/20 text-[#ff006a] rounded border border-[#ff006a]/30">
                PROMO
              </span>
              <span className="text-xs font-bold text-white group-hover:text-[#ff006a] transition-colors truncate">
                Maxsus taklif va bonuslar
              </span>
            </div>
          </div>
        </div>

        <span className="shrink-0 text-xs font-bold text-[#ff006a] group-hover:text-white flex items-center gap-1">
          <span>O'tish</span>
          <ExternalLink size={12} className="group-hover:translate-x-0.5 transition-transform" />
        </span>
      </a>
    );
  }

  return (
    <div className={`w-full my-4 ${className}`}>
      <a
        href={PROPELLER_DIRECT_URL}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="group relative block overflow-hidden rounded-2xl border border-[#ff006a]/30 hover:border-[#ff006a]/70 bg-gradient-to-r from-[#170e1c] via-[#100d18] to-[#1a0f22] p-4 sm:p-5 transition-all duration-300 shadow-[0_0_25px_rgba(255,0,106,0.12)] hover:shadow-[0_0_35px_rgba(255,0,106,0.25)]"
      >
        {/* Glow backdrop effects */}
        <div className="absolute top-0 right-0 w-60 h-60 bg-[#ff006a]/15 rounded-full blur-3xl pointer-events-none group-hover:bg-[#ff006a]/25 transition-all duration-500" />
        <div className="absolute -bottom-10 left-10 w-40 h-40 bg-purple-600/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Animated Icon Box */}
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#ff006a] to-purple-600 flex items-center justify-center text-white shrink-0 shadow-[0_0_15px_rgba(255,0,106,0.5)] transform group-hover:scale-105 transition-transform">
              <Zap size={22} className="fill-current animate-pulse" />
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full bg-[#ff006a]/20 border border-[#ff006a]/40 text-[#ff006a] text-[10px] font-black uppercase tracking-wider">
                  HOMIY REKLAMASI
                </span>
                <span className="flex items-center gap-1 text-[11px] text-purple-300 font-semibold">
                  <Sparkles size={11} /> Eksklyuziv taklif
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-white group-hover:text-[#ff006a] transition-colors leading-snug">
                Eng so'nggi maxsus aksiyalar va super bonuslar!
              </h3>
              <p className="text-[11px] sm:text-xs text-white/50">
                Hamkorimizning eng qiziqarli imkoniyatlaridan foydalanish uchun bosing
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <div className="w-full sm:w-auto shrink-0">
            <span className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#ff006a] group-hover:bg-[#ff1a7a] text-white text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-[0_0_15px_rgba(255,0,106,0.4)] group-hover:shadow-[0_0_25px_rgba(255,0,106,0.6)]">
              <span>Batafsil ko'rish</span>
              <ExternalLink size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </a>
    </div>
  );
}
