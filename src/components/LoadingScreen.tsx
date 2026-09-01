import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export const LOADING_IMAGE_URL = 'https://i.pinimg.com/736x/17/c6/88/17c688c6242fe4c3293be182924e73a3.jpg';

interface LoadingScreenProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg' | 'fullscreen';
  className?: string;
}

export default function LoadingScreen({ text, size = 'md', className = '' }: LoadingScreenProps) {
  let langText = "Yuklanmoqda...";
  try {
    const { t } = useLanguage();
    if (t?.loading) langText = t.loading;
  } catch (e) {}

  const displayText = text || langText;

  if (size === 'fullscreen') {
    return (
      <div className={`fixed inset-0 z-[100] bg-[#070709]/95 backdrop-blur-md flex flex-col items-center justify-center p-4 ${className}`}>
        <div className="relative flex items-center justify-center">
          {/* Glowing neon spinner ring */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 border-3 border-[#ff006a]/20 border-t-[#ff006a] border-r-purple-500 rounded-full animate-spin shadow-[0_0_30px_rgba(255,0,106,0.5)]" />
          
          {/* Requested Center Loading Image */}
          <div className="absolute w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden flex items-center justify-center bg-black/60 shadow-inner p-1">
            <img 
              src={LOADING_IMAGE_URL} 
              alt="Loading..." 
              className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(255,0,106,0.6)] animate-pulse"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = 'https://api.animem.uz/api/images/1788100529230_au9wggu';
              }}
            />
          </div>
        </div>
        <span className="text-white/70 text-xs sm:text-sm font-bold tracking-wider uppercase mt-4 animate-pulse">
          {displayText}
        </span>
      </div>
    );
  }

  const dimensions = size === 'sm' 
    ? { container: 'w-10 h-10', ring: 'w-10 h-10 border-2', img: 'w-6 h-6' }
    : size === 'lg'
    ? { container: 'w-20 h-20', ring: 'w-20 h-20 border-3', img: 'w-12 h-12' }
    : { container: 'w-14 h-14', ring: 'w-14 h-14 border-3', img: 'w-8 h-8' };

  return (
    <div className={`flex flex-col items-center justify-center min-h-[35vh] w-full gap-3 py-8 ${className}`}>
      <div className={`relative flex items-center justify-center ${dimensions.container}`}>
        <div className={`${dimensions.ring} border-[#ff006a]/20 border-t-[#ff006a] border-r-purple-500 rounded-full animate-spin shadow-[0_0_20px_rgba(255,0,106,0.35)]`} />
        <div className={`absolute ${dimensions.img} rounded-full overflow-hidden flex items-center justify-center bg-black/40`}>
          <img 
            src={LOADING_IMAGE_URL} 
            alt="Loading..." 
            className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(255,0,106,0.5)] animate-pulse" 
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = 'https://api.animem.uz/api/images/1788100529230_au9wggu';
            }}
          />
        </div>
      </div>
      {displayText && (
        <span className="text-white/50 text-xs font-semibold tracking-wider uppercase animate-pulse">
          {displayText}
        </span>
      )}
    </div>
  );
}
