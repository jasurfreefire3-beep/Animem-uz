import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageCircle, Sparkles } from 'lucide-react';
import { ReelComment } from '../types';
import FormattedContent from './FormattedContent';
import GifPicker from './GifPicker';

interface ReelsCommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reelId: number | string;
  commentsCount: number;
  onCommentAdded: () => void;
  onCommentsCountSync?: (count: number) => void;
  currentUser?: any;
}

export default function ReelsCommentsModal({
  isOpen,
  onClose,
  reelId,
  commentsCount,
  onCommentAdded,
  onCommentsCountSync,
  currentUser,
}: ReelsCommentsModalProps) {
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [newComment, setNewComment] = useState<string>('');
  const [showGifPicker, setShowGifPicker] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const commentsListRef = useRef<HTMLDivElement>(null);

  // Fetch comments when modal opens or reelId changes
  useEffect(() => {
    if (!isOpen || !reelId) return;

    let isCurrent = true;
    setLoading(true);

    fetch(`/api/reels/${reelId}/comments`)
      .then((res) => res.json())
      .then((data) => {
        if (isCurrent) {
          const list = Array.isArray(data) ? data : [];
          setComments(list);
          setLoading(false);
          if (onCommentsCountSync) {
            onCommentsCountSync(list.length);
          }
        }
      })
      .catch((err) => {
        console.error('Fetch comments error:', err);
        if (isCurrent) {
          setComments([]);
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [isOpen, reelId, onCommentsCountSync]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmitComment = async (customContent?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const contentToSend = (typeof customContent === 'string' ? customContent : newComment).trim();
    if (!contentToSend || isSubmitting) return;

    setIsSubmitting(true);
    setShowGifPicker(false);

    const token = localStorage.getItem('token');
    const guestName = localStorage.getItem('animem_guest_name') || 'Muxlis_' + Math.floor(100 + Math.random() * 900);
    const guestAvatar = localStorage.getItem('animem_guest_avatar') || 'https://files.catbox.moe/45hoi6.png';

    const optimisticComment: ReelComment = {
      id: Date.now(),
      reel_id: reelId,
      username: currentUser?.name || guestName,
      user_avatar: currentUser?.avatar_url || guestAvatar,
      content: contentToSend,
      created_at: new Date().toISOString(),
    };

    setComments((prev) => [optimisticComment, ...prev]);
    if (!customContent) {
      setNewComment('');
    }
    onCommentAdded();

    try {
      const res = await fetch(`/api/reels/${reelId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          content: contentToSend,
          username: currentUser?.name || guestName,
          user_avatar: currentUser?.avatar_url || guestAvatar,
        }),
      });
      const data = await res.json();
      if (data?.comment) {
        setComments((prev) => prev.map((c) => (c.id === optimisticComment.id ? data.comment : c)));
        if (data.comments_count !== undefined && onCommentsCountSync) {
          onCommentsCountSync(data.comments_count);
        }
      }
    } catch (err) {
      console.error('Post comment error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectGif = (gifUrl: string) => {
    setShowGifPicker(false);
    handleSubmitComment(`[gif]${gifUrl}[/gif]`);
  };

  const addEmoji = (emoji: string) => {
    setNewComment((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diffSec < 60) return "hozirgina";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin} daq`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour} soat`;
      const diffDay = Math.floor(diffHour / 24);
      return `${diffDay} kun`;
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full sm:max-w-md h-[75vh] sm:h-[620px] bg-[#121217] border border-white/10 rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-slide-up relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-[#16161d]">
          <div className="flex items-center space-x-2">
            <MessageCircle className="w-5 h-5 text-pink-500" />
            <h3 className="font-semibold text-white text-base">
              Izohlar ({Math.max(comments.length, commentsCount)})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comments List */}
        <div 
          ref={commentsListRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-3">
              <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-white/50">Izohlar yuklanmoqda...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center space-y-2">
              <MessageCircle className="w-10 h-10 text-white/20" />
              <p className="text-sm font-medium text-white/60">Hozircha izohlar yo'q</p>
              <p className="text-xs text-white/40">Birinchi bo'lib fikringizni yozing!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex items-start space-x-3 group pt-3 first:pt-0">
                <img
                  src={comment.user_avatar || 'https://files.catbox.moe/45hoi6.png'}
                  alt={comment.username}
                  className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0 mt-0.5"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = 'https://files.catbox.moe/45hoi6.png';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline space-x-2">
                    <span className="font-medium text-xs text-white/90 truncate">
                      {comment.username}
                    </span>
                    <span className="text-[11px] text-white/40">
                      {formatRelativeTime(comment.created_at)}
                    </span>
                  </div>
                  <div className="text-sm text-white/80 break-words mt-0.5 leading-relaxed">
                    <FormattedContent content={comment.content} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Gif Picker popover */}
        {showGifPicker && (
          <div className="absolute bottom-24 left-3 right-3 sm:left-auto sm:right-3 z-50">
            <GifPicker
              onSelectGif={handleSelectGif}
              onClose={() => setShowGifPicker(false)}
            />
          </div>
        )}

        {/* Quick Emojis */}
        <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between text-lg bg-[#14141a]">
          {['🔥', '❤️', '👏', '😍', '⚡️', '😂', '👑', '💯'].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => addEmoji(emoji)}
              className="hover:scale-125 transition-transform active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Comment input form */}
        <form onSubmit={(e) => handleSubmitComment(undefined, e)} className="p-3 border-t border-white/10 bg-[#16161d] flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowGifPicker(prev => !prev)}
            className={`p-2 rounded-full border transition-all ${
              showGifPicker 
                ? 'bg-[#ff006a]/20 border-[#ff006a] text-[#ff006a]' 
                : 'bg-white/5 border-white/10 text-white/60 hover:text-[#ff006a] hover:border-[#ff006a]/40'
            }`}
            title="GIF tanlash"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Fikringizni bildiring..."
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-pink-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="p-2.5 rounded-full bg-pink-600 hover:bg-pink-500 disabled:opacity-40 disabled:hover:bg-pink-600 text-white transition-all shadow-md active:scale-95 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
