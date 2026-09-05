import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageCircle } from 'lucide-react';
import { ReelComment } from '../types';

interface ReelsCommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reelId: number | string;
  commentsCount: number;
  onCommentAdded: () => void;
  currentUser?: any;
}

export default function ReelsCommentsModal({
  isOpen,
  onClose,
  reelId,
  commentsCount,
  onCommentAdded,
  currentUser,
}: ReelsCommentsModalProps) {
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [newComment, setNewComment] = useState<string>('');
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
          setComments(Array.isArray(data) ? data : []);
          setLoading(false);
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
  }, [isOpen, reelId]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmitComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    const content = newComment.trim();
    setIsSubmitting(true);

    const token = localStorage.getItem('token');
    const guestName = localStorage.getItem('animem_guest_name') || 'Muxlis_' + Math.floor(100 + Math.random() * 900);
    const guestAvatar = localStorage.getItem('animem_guest_avatar') || 'https://files.catbox.moe/45hoi6.png';

    const optimisticComment: ReelComment = {
      id: Date.now(),
      reel_id: reelId,
      username: currentUser?.name || guestName,
      user_avatar: currentUser?.avatar_url || guestAvatar,
      content,
      created_at: new Date().toISOString(),
    };

    setComments((prev) => [optimisticComment, ...prev]);
    setNewComment('');
    onCommentAdded();

    try {
      const res = await fetch(`/api/reels/${reelId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          content,
          username: currentUser?.name || guestName,
          user_avatar: currentUser?.avatar_url || guestAvatar,
        }),
      });
      const data = await res.json();
      if (data?.comment) {
        setComments((prev) => prev.map((c) => (c.id === optimisticComment.id ? data.comment : c)));
      }
    } catch (err) {
      console.error('Post comment error:', err);
    } finally {
      setIsSubmitting(false);
    }
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
        className="w-full sm:max-w-md h-[70vh] sm:h-[600px] bg-[#121217] border border-white/10 rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-[#16161d]">
          <div className="flex items-center space-x-2">
            <MessageCircle className="w-5 h-5 text-pink-500" />
            <h3 className="font-semibold text-white text-base">
              Izohlar ({comments.length || commentsCount})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comment list */}
        <div ref={commentsListRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-3">
              <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-white/50">Izohlar yuklanmoqda...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-2 text-center text-white/50">
              <MessageCircle className="w-12 h-12 text-white/20 stroke-1" />
              <p className="text-sm">Hali hech kim izoh qoldirmagan</p>
              <p className="text-xs text-white/40">Birinchi bo'lib fikringizni yozing!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex items-start space-x-3 group">
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
                  <p className="text-sm text-white/80 break-words mt-0.5 whitespace-pre-wrap leading-relaxed">
                    {comment.content}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

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
        <form onSubmit={handleSubmitComment} className="p-3 border-t border-white/10 bg-[#16161d] flex items-center space-x-2">
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
