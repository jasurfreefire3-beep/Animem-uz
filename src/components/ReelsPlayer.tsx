import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Play, Pause, Loader2 } from 'lucide-react';
import Hls from 'hls.js';

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [showPlayIcon, setShowPlayIcon] = useState<boolean>(false);
  const [showHeartAnim, setShowHeartAnim] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const lastTapTimeRef = useRef<number>(0);

  // Initialize video source reliably
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;
    setIsLoading(true);
    setHasError(false);

    const isHlsUrl = url && (url.endsWith('.m3u8') || url.includes('/hls/'));

    if (isHlsUrl && Hls.isSupported()) {
      hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        if (isActive) {
          video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        }
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls?.recoverMediaError();
              break;
            default:
              // Fallback to direct src if HLS fails
              hls?.destroy();
              video.src = url;
              video.load();
              break;
          }
        }
      });
    } else {
      // Direct source (MP4 / /api/video/:id / blob)
      video.src = url;
      video.load();
      const handleCanPlay = () => {
        setIsLoading(false);
        if (isActive) {
          video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        }
      };
      video.addEventListener('canplay', handleCanPlay, { once: true });
      
      // Fallback timeout in case canplay doesn't fire
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 1500);

      return () => {
        video.removeEventListener('canplay', handleCanPlay);
        clearTimeout(timer);
      };
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [url]);

  // Handle active slide play/pause state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.currentTime = 0;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn("Autoplay prevented:", err);
            setIsPlaying(false);
          });
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  // Handle mute changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = isMuted;
  }, [isMuted]);

  // Time update for progress bar
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const current = video.currentTime;
    const dur = video.duration || 1;
    setProgress((current / dur) * 100);
  };

  const handleVideoEnded = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(() => {});
  };

  const handleTapOrClick = () => {
    const now = Date.now();
    if (now - lastTapTimeRef.current < 300) {
      if (onDoubleTapLike) {
        onDoubleTapLike();
        setShowHeartAnim(true);
        setTimeout(() => setShowHeartAnim(false), 900);
      }
      lastTapTimeRef.current = 0;
      return;
    }
    lastTapTimeRef.current = now;

    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
    setShowPlayIcon(true);
    setTimeout(() => setShowPlayIcon(false), 600);
  };

  return (
    <div 
      className="relative w-full h-full bg-black overflow-hidden select-none flex items-center justify-center cursor-pointer"
      onClick={handleTapOrClick}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        loop
        muted={isMuted}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleVideoEnded}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        className="w-full h-full object-contain bg-black select-none"
      />

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none z-20">
          <Loader2 className="w-10 h-10 text-pink-500 animate-spin" />
        </div>
      )}

      {/* Invisible protective overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none" />

      {/* Floating Mute/Unmute Button in top right */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleMute();
        }}
        className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 transition-all shadow-lg active:scale-95 cursor-pointer"
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
              <Pause className="w-8 h-8 fill-white" />
            )}
          </div>
        </div>
      )}

      {/* Big Heart animation on double tap */}
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

      {/* Bottom Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-30 pointer-events-none">
        <div 
          className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
