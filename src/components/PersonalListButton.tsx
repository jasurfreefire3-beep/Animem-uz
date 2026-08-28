import React, { useState, useEffect, useRef } from 'react';
import { Bookmark, Check, ChevronDown, Trash2, Heart, Tv, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Anime, UserListStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  getAnimeListStatus, 
  setUserListStatus, 
  USER_LIST_STATUSES, 
  getStatusConfig 
} from '../services/userListService';

interface PersonalListButtonProps {
  anime: Anime;
  className?: string;
  variant?: 'full' | 'compact' | 'badge';
}

export default function PersonalListButton({ anime, className = '', variant = 'full' }: PersonalListButtonProps) {
  const { user, token } = useAuth();
  const [currentStatus, setCurrentStatus] = useState<UserListStatus | null>(() => getAnimeListStatus(anime.id));
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentStatus(getAnimeListStatus(anime.id));

    const handleUpdate = (e: any) => {
      if (e.detail?.animeId && String(e.detail.animeId) === String(anime.id)) {
        setCurrentStatus(e.detail.status);
      } else {
        setCurrentStatus(getAnimeListStatus(anime.id));
      }
    };

    window.addEventListener('animem_user_list_updated', handleUpdate);
    return () => window.removeEventListener('animem_user_list_updated', handleUpdate);
  }, [anime.id]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectStatus = (status: UserListStatus | null) => {
    setUserListStatus(anime.id, status, anime, token);
    setCurrentStatus(status);
    setIsOpen(false);
  };

  const statusConfig = getStatusConfig(currentStatus);

  const getStatusIcon = (status: UserListStatus) => {
    switch (status) {
      case 'watching': return Tv;
      case 'plan_to_watch': return Clock;
      case 'completed': return CheckCircle2;
      case 'dropped': return XCircle;
      case 'favorite': return Heart;
      default: return Bookmark;
    }
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-4 md:px-6 py-3 rounded-sm font-black transition-all flex items-center justify-center gap-2 text-[11px] md:text-sm border uppercase tracking-wider cursor-pointer select-none ${
          currentStatus
            ? 'bg-[#1a1726] border-[#ff006a]/50 text-white shadow-[0_0_15px_rgba(255,0,106,0.2)]'
            : 'bg-[#18181b] border-[#27272a] hover:bg-[#27272a] text-white'
        }`}
        style={currentStatus && statusConfig ? { borderColor: statusConfig.color } : {}}
      >
        {currentStatus && statusConfig ? (
          <>
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_8px_currentColor]"
              style={{ backgroundColor: statusConfig.dotColor, color: statusConfig.dotColor }}
            />
            <span className="truncate">{statusConfig.label}</span>
          </>
        ) : (
          <>
            <Bookmark className="w-4 h-4 shrink-0 text-[#ff006a]" />
            <span>RO'YXATGA QO'SHISH</span>
          </>
        )}
        <ChevronDown size={14} className={`text-white/50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 sm:left-auto right-0 top-full mt-2 w-64 bg-[#14141d] border border-white/15 rounded-2xl p-2 shadow-2xl z-50 backdrop-blur-xl"
          >
            <div className="px-3 py-2 border-b border-white/10 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-white/40">
                Shaxsiy Ro'yxat Statusi
              </span>
            </div>

            <div className="space-y-1">
              {USER_LIST_STATUSES.map(st => {
                const Icon = getStatusIcon(st.id);
                const isSelected = currentStatus === st.id;

                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => handleSelectStatus(st.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'bg-white/10 text-white shadow-inner'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: st.dotColor }}
                      />
                      <Icon size={14} style={{ color: st.color }} />
                      <span>{st.label}</span>
                    </div>

                    {isSelected && (
                      <Check size={14} className="text-[#ff006a]" />
                    )}
                  </button>
                );
              })}

              {currentStatus && (
                <div className="pt-1 mt-1 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => handleSelectStatus(null)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Ro'yxatdan olib tashlash</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
