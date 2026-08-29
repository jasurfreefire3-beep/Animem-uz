import React from 'react';
import GifPicker, { ANIMEM_GIFS } from './GifPicker';

interface EmojiPickerProps {
  onSelectEmoji: (emojiOrGif: string) => void;
  onClose?: () => void;
}

export { ANIMEM_GIFS };

export default function EmojiPicker({ onSelectEmoji, onClose }: EmojiPickerProps) {
  return (
    <GifPicker
      onSelectGif={(gifUrl) => onSelectEmoji(`[gif]${gifUrl}[/gif]`)}
      onClose={onClose}
    />
  );
}
