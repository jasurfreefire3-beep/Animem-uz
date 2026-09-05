import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Play } from 'lucide-react';

interface ReelsPlayerProps {
  id: string | number;
  url: string;
  poster?: string;
  title: string;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onDoubleTapLike?: () => void;
}

function ensurePlayerJsLoaded(): Promise<void> {
  if (typeof window !== 'undefined' && window.Playerjs) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-playerjs-reels]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = '/playerjs.js';
    script.async = true;
    script.dataset.playerjsReels = 'true';
    script.onload = () => resolve();
    script.onerror = () => resolve(); // fallback to native video if error
    document.head.appendChild(script);
  });
}

export default function ReelsPlayer({
  id,
  url,
  poster,
  title,
  isActive,
  isMuted,
  onToggleMute,
  onDoubleTapLike,
}: ReelsPlayerProps) {
  const containerId = useRef(`playerjs-reel-${id}-${Math.random().toString(36).substring(2, 7)}`).current;
  const playerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [showPlayIcon, setShowPlayIcon] = useState<boolean>(false);
  const [showHeartAnim, setShowHeartAnim] = useState<boolean>(false);
  const [useFallback, setUseFallback] = useState<boolean>(false);
  const lastTapTimeRef = useRef<number>(0);

  // Initialize Playerjs or fallback
  useEffect(() => {
    let isCurrent = true;

    ensurePlayerJsLoaded().then(() => {
      if (!isCurrent) return;

      if (window.Playerjs && document.getElementById(containerId)) {
        try {
          const container = document.getElementById(containerId);
          if (container) {
            container.replaceChildren();
          }

          playerRef.current = new window.Playerjs({
            id: containerId,
            file: url,
            poster: poster || '',
            title: title || 'Anime Reel',
            autoplay: isActive ? 1 : 0,
            loop: 1,
            volume: isMuted ? 0 : 80,
            theme: '#ff006a',
            download: 0,
            filedownload: 0,
          });

          // Wait a tick then handle play state
          setTimeout(() => {
            if (!isCurrent) return;
            try {
              if (isActive) {
                playerRef.current?.api?.('play');
                setIsPlaying(true);
              } else {
                playerRef.current?.api?.('pause');
                setIsPlaying(false);
              }
            } catch (e) {}
          }, 150);
        } catch (err) {
          console.warn('Playerjs reel initialization fallback to native video', err);
          setUseFallback(true);
        }
      } else {
        setUseFallback(true);
      }
    });

    return () => {
      isCurrent = false;
      try {
        playerRef.current?.api?.('stop');
      } catch (e) {}
      playerRef.current = null;
    };
  }, [url, containerId, poster, title]);

  // Handle active slide transitions
  useEffect(() => {
    if (useFallback && videoRef.current) {
      if (isActive) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
      return;
    }

    if (playerRef.current?.api) {
      try {
        if (isActive) {
          playerRef.current.api('play');
          setIsPlaying(true);
        } else {
          playerRef.current.api('pause');
          setIsPlaying(false);
        }
      } catch (e) {}
    }
  }, [isActive, useFallback]);

  // Handle mute changes
  useEffect(() => {
    if (useFallback && videoRef.current) {
      videoRef.current.muted = isMuted;
      return;
    }

    if (playerRef.current?.api) {
      try {
        if (isMuted) {
          playerRef.current.api('mute');
        } else {
          playerRef.current.api('unmute');
          playerRef.current.api('volume', 80);
        }
      } catch (e) {}
    }
  }, [isMuted, useFallback]);

  const handleTapOrClick = () => {
    const now = Date.now();
    // Double tap detector (300ms)
    if (now - lastTapTimeRef.current < 300) {
      // Double tap -> trigger like
      if (onDoubleTapLike) {
        onDoubleTapLike();
        setShowHeartAnim(true);
        setTimeout(() => setShowHeartAnim(false), 900);
      }
      lastTapTimeRef.current = 0;
      return;
    }
    lastTapTimeRef.current = now;

    // Single tap -> toggle play / pause
    if (useFallback && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
      setShowPlayIcon(true);
      setTimeout(() => setShowPlayIcon(false), 600);
      return;
    }

    if (playerRef.current?.api) {
      try {
        if (isPlaying) {
          playerRef.current.api('pause');
          setIsPlaying(false);
        } else {
          playerRef.current.api('play');
          setIsPlaying(true);
        }
        setShowPlayIcon(true);
        setTimeout(() => setShowPlayIcon(false), 600);
      } catch (e) {}
    }
  };

  return (
    <div 
      className="relative w-full h-full bg-black overflow-hidden select-none flex items-center justify-center"
      onClick={handleTapOrClick}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {/* PlayerJS Container */}
      {!useFallback ? (
        <div
          id={containerId}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className="w-full h-full flex items-center justify-center [&_video]:object-cover [&_video]:w-full [&_video]:h-full select-none"
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <video
          ref={videoRef}
          src={url}
          poster={poster}
          playsInline
          loop
          muted={isMuted}
          controlsList="nodownload noplaybackrate nofullscreen"
          disablePictureInPicture
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className="w-full h-full object-cover pointer-events-none select-none"
        />
      )}

      {/* Invisible protective click overlay */}
      <div 
        className="absolute inset-0 z-10 select-none" 
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
      />

      {/* Floating Mute/Unmute Button in top right */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleMute();
        }}
        className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 transition-all shadow-lg active:scale-95"
        title={isMuted ? "Ovozni yoqish" : "Ovozni o'chirish"}
        aria-label="Toggle mute"
      >
        {isMuted ? <VolumeX className="w-5 h-5 text-white/90" /> : <Volume2 className="w-5 h-5 text-pink-400" />}
      </button>

      {/* Play/Pause Pulse Icon */}
      {showPlayIcon && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 transition-all duration-300">
          <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white scale-110 shadow-2xl animate-fade-in">
            {isPlaying ? (
              <Play className="w-8 h-8 fill-white translate-x-0.5" />
            ) : (
              <div className="flex space-x-1.5">
                <div className="w-2.5 h-7 bg-white rounded-sm"></div>
                <div className="w-2.5 h-7 bg-white rounded-sm"></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instagram-style Big Heart animation on double tap */}
      {showHeartAnim && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
          <svg
            className="w-28 h-28 text-pink-500 fill-pink-500 drop-shadow-[0_0_25px_rgba(236,72,153,0.8)] animate-bounce"
            viewBox="0 0 24 24"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
      )}
    </div>
  );
}
