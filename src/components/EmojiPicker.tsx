import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Smile, Flame, Heart, Zap } from 'lucide-react';

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onClose?: () => void;
}

const EMOJI_CATEGORIES = [
  {
    id: 'popular',
    name: 'Top',
    icon: Flame,
    emojis: ['😂', '😍', '😭', '🔥', '💀', '🥺', '😎', '🥳', '😡', '😱', '🤯', '🤔', '😴', '🤫', '🫡', '👍', '👎', '👏', '💯', '❤️', '💔', '✨', '🎉', '🚀']
  },
  {
    id: 'anime',
    name: 'Anime',
    icon: Sparkles,
    emojis: ['🌸', '⚔️', '🍙', '🍜', '🍥', '🥋', '👺', '👾', '🎮', '⚡', '🐱', '🦊', '🐉', '🦄', '🥷', '👑', '💎', '🌟', '💫', '🎯', '🎭', '🎧', '⛩️', '🍡', '🍵', '🎐']
  },
  {
    id: 'faces',
    name: 'Yuzlar',
    icon: Smile,
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '🥲', '☺️', '😊', '😇', '🙂', '🙃', '😉', '😌', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢']
  },
  {
    id: 'hearts',
    name: 'Yuraklar',
    icon: Heart,
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟']
  },
  {
    id: 'gestures',
    name: 'Qo\'llar',
    icon: Zap,
    emojis: ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪', '🦾']
  }
];

export default function EmojiPicker({ onSelectEmoji, onClose }: EmojiPickerProps) {
  const [activeTab, setActiveTab] = useState('popular');

  const currentCategory = EMOJI_CATEGORIES.find(c => c.id === activeTab) || EMOJI_CATEGORIES[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="bg-[#121215] border border-[#26262a] rounded-xl shadow-2xl overflow-hidden w-72 sm:w-80 flex flex-col z-50 select-none"
    >
      {/* Category Tabs */}
      <div className="flex items-center justify-around bg-[#0c0c0e] border-b border-[#222] p-1.5">
        {EMOJI_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeTab === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveTab(cat.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? 'bg-[#ff006a] text-white shadow-sm shadow-[#ff006a]/30'
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={13} />
              <span className="text-[10px] hidden sm:inline">{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Emoji Grid */}
      <div className="p-3 max-h-48 overflow-y-auto custom-scrollbar grid grid-cols-7 sm:grid-cols-8 gap-1.5 bg-[#09090b]">
        {currentCategory.emojis.map((emoji, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectEmoji(emoji)}
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-lg active:scale-125 transition-transform hover:scale-110"
          >
            {emoji}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
