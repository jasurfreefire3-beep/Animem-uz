import React from 'react';

interface FormattedContentProps {
  content: string;
  className?: string;
  imageClassName?: string;
}

// Regex to identify [gif]URL[/gif] or bare https://api.animem.uz/i/... URLs
const GIF_TAG_REGEX = /\[gif\](https?:\/\/[^\s\]]+)\[\/gif\]/gi;
const ANIMEM_IMAGE_REGEX = /(https?:\/\/api\.animem\.uz\/i\/[a-zA-Z0-9-]+)/gi;

export function isGifContent(content: string): boolean {
  if (!content) return false;
  return GIF_TAG_REGEX.test(content) || ANIMEM_IMAGE_REGEX.test(content);
}

export function extractGifs(content: string): string[] {
  if (!content) return [];
  const matches: string[] = [];
  
  let match;
  const tagRegex = /\[gif\](https?:\/\/[^\s\]]+)\[\/gif\]/gi;
  while ((match = tagRegex.exec(content)) !== null) {
    matches.push(match[1]);
  }
  
  const bareRegex = /(https?:\/\/api\.animem\.uz\/i\/[a-zA-Z0-9-]+)/gi;
  while ((match = bareRegex.exec(content)) !== null) {
    if (!matches.includes(match[1])) {
      matches.push(match[1]);
    }
  }
  
  return matches;
}

export default function FormattedContent({
  content,
  className = '',
  imageClassName = ''
}: FormattedContentProps) {
  if (!content) return null;

  // Split by [gif]...[/gif] and also recognize bare api.animem.uz/i/ links
  // Let's normalize [gif]...[/gif] tags first
  const normalized = content.replace(
    /\[gif\](https?:\/\/[^\s\]]+)\[\/gif\]/gi,
    ' ___GIF_SEPARATOR___$1___GIF_SEPARATOR___ '
  );

  // Also check if entire content is just a direct api.animem.uz/i/ link
  const parts = normalized.split('___GIF_SEPARATOR___');

  return (
    <div className={`space-y-1 ${className}`}>
      {parts.map((part, index) => {
        const trimmed = part.trim();
        if (!trimmed) return null;

        // Check if this part is a GIF / Image URL
        const isUrl = /^https?:\/\/.*\.(gif|webp|png|jpg|jpeg)$/i.test(trimmed) ||
          trimmed.startsWith('https://api.animem.uz/i/') ||
          trimmed.includes('api.animem.uz/i/');

        if (isUrl) {
          return (
            <div key={index} className="my-1 block">
              <img
                src={trimmed}
                alt="Anime GIF"
                className={`rounded-xl max-h-36 sm:max-h-44 max-w-[180px] sm:max-w-[220px] object-contain border border-[#ff006a]/30 shadow-lg shadow-black/40 bg-black/40 hover:scale-105 transition-transform duration-200 cursor-pointer block ${imageClassName}`}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          );
        }

        // Check if there are bare api.animem.uz/i/ links inside text
        if (ANIMEM_IMAGE_REGEX.test(trimmed)) {
          const subParts = trimmed.split(/(https?:\/\/api\.animem\.uz\/i\/[a-zA-Z0-9-]+)/gi);
          return (
            <div key={index} className="leading-relaxed">
              {subParts.map((sub, sIdx) => {
                if (sub.startsWith('https://api.animem.uz/i/')) {
                  return (
                    <div key={sIdx} className="my-1 block">
                      <img
                        src={sub}
                        alt="Anime GIF"
                        className={`rounded-xl max-h-36 sm:max-h-44 max-w-[180px] sm:max-w-[220px] object-contain border border-[#ff006a]/30 shadow-lg shadow-black/40 bg-black/40 hover:scale-105 transition-transform duration-200 cursor-pointer block ${imageClassName}`}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  );
                }
                return <span key={sIdx}>{sub}</span>;
              })}
            </div>
          );
        }

        return (
          <span key={index} className="leading-relaxed">
            {part}
          </span>
        );
      })}
    </div>
  );
}
