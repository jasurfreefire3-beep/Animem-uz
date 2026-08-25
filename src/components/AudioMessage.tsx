import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, AlertCircle } from 'lucide-react';

interface AudioMessageProps {
  src: string;
  duration?: number | string;
  isMe?: boolean;
}

export function parseMessageContent(content: string) {
  if (!content) return { isVoice: false, duration: 0, audioUrl: '', text: '' };
  
  const voiceMatch = content.match(/^\[voice(?:\s+duration="([^"]+)")?\]([\s\S]+?)\[\/voice\]$/);
  if (voiceMatch) {
    return {
      isVoice: true,
      duration: voiceMatch[1] ? parseFloat(voiceMatch[1]) : 0,
      audioUrl: voiceMatch[2],
      text: ''
    };
  }
  
  if (content.startsWith('data:audio/')) {
    return {
      isVoice: true,
      duration: 0,
      audioUrl: content,
      text: ''
    };
  }

  return {
    isVoice: false,
    duration: 0,
    audioUrl: '',
    text: content
  };
}

export default function AudioMessage({ src, duration: initialDuration, isMe }: AudioMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState<number>(() => {
    if (typeof initialDuration === 'number') return initialDuration;
    if (typeof initialDuration === 'string') {
      const parsed = parseFloat(initialDuration);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 0;
  });
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setHasError(true);
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
    };
  }, [src]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current || hasError) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error("Audio playback error:", err);
          setHasError(true);
        });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (hasError) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-400 py-1">
        <AlertCircle size={14} />
        <span>Ovozli xabarni ijro etib bo'lmadi</span>
      </div>
    );
  }

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 min-w-[200px] max-w-[280px] sm:max-w-[320px] py-1 select-none">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-md ${
          isMe
            ? 'bg-[#ff006a] text-white hover:bg-[#e0005d]'
            : 'bg-[#ff006a]/20 text-[#ff006a] hover:bg-[#ff006a] hover:text-white border border-[#ff006a]/30'
        }`}
        title={isPlaying ? "Pauza" : "Tinglash"}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>

      {/* Progress & Waveform */}
      <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
        {/* Animated Sound Wave Bars */}
        <div className="flex items-center gap-1 h-5 overflow-hidden">
          {[40, 75, 100, 60, 85, 45, 90, 70, 50, 80, 95, 65, 40, 85, 60, 75].map((height, idx) => {
            const barProgress = (idx / 16) * 100;
            const isPassed = progressPercent >= barProgress;
            return (
              <div
                key={idx}
                className={`w-1 rounded-full transition-all duration-150 ${
                  isPassed
                    ? isMe ? 'bg-white' : 'bg-[#ff006a]'
                    : isMe ? 'bg-white/30' : 'bg-white/20'
                } ${isPlaying ? 'animate-pulse' : ''}`}
                style={{
                  height: `${isPlaying ? Math.max(25, (height * (1 + (idx % 3) * 0.2)) % 100) : height}%`,
                  animationDuration: `${0.4 + (idx % 5) * 0.15}s`
                }}
              />
            );
          })}
        </div>

        {/* Seek Input (hidden but interactive) + Time Info */}
        <div className="flex items-center justify-between text-[10px] text-white/60 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span className="flex items-center gap-1 text-[9px] text-white/40">
            <Volume2 size={10} />
            {formatTime(totalDuration || currentTime)}
          </span>
        </div>
      </div>
    </div>
  );
}
