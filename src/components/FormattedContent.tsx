import React from 'react';

interface FormattedContentProps {
  content: string;
  className?: string;
  imageClassName?: string;
}

// Regex to identify [gif]...[/gif] tags (matches any url or relative path inside)
const GIF_TAG_REGEX = /\[gif\]([\s\S]*?)\[\/gif\]/gi;
const ANIMEM_IMAGE_REGEX = /(https?:\/\/api\.animem\.uz\/i\/[a-zA-Z0-9_-]+)/gi;

export function isGifContent(content: string): boolean {
  if (!content) return false;
  return /\[gif\][\s\S]*?\[\/gif\]/i.test(content) || 
         ANIMEM_IMAGE_REGEX.test(content) ||
         /^\/api\/media\/gif_[a-zA-Z0-9_-]+/i.test(content.trim());
}

export function extractGifs(content: string): string[] {
  if (!content) return [];
  const matches: string[] = [];
  
  let match;
  const tagRegex = /\[gif\]([\s\S]*?)\[\/gif\]/gi;
  while ((match = tagRegex.exec(content)) !== null) {
    const url = match[1]?.trim();
    if (url && !matches.includes(url)) {
      matches.push(url);
    }
  }
  
  const bareRegex = /(https?:\/\/api\.animem\.uz\/i\/[a-zA-Z0-9_-]+)/gi;
  while ((match = bareRegex.exec(content)) !== null) {
    if (!matches.includes(match[1])) {
      matches.push(match[1]);
    }
  }
  
  return matches;
}

interface Segment {
  type: 'text' | 'gif';
  value: string;
}

export function parseContentSegments(rawContent: string): Segment[] {
  if (!rawContent) return [];

  const segments: Segment[] = [];
  const gifTagRegex = /\[gif\]([\s\S]*?)\[\/gif\]/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = gifTagRegex.exec(rawContent)) !== null) {
    const textBefore = rawContent.slice(lastIndex, match.index);
    if (textBefore) {
      segments.push({ type: 'text', value: textBefore });
    }
    const gifUrl = match[1]?.trim();
    if (gifUrl) {
      segments.push({ type: 'gif', value: gifUrl });
    }
    lastIndex = match.index + match[0].length;
  }

  const remaining = rawContent.slice(lastIndex);
  if (remaining) {
    segments.push({ type: 'text', value: remaining });
  }

  // Now scan text segments for bare media links
  const finalSegments: Segment[] = [];
  const bareRegex = /(https?:\/\/api\.animem\.uz\/i\/[a-zA-Z0-9_-]+|\/api\/media\/gif_[a-zA-Z0-9_-]+|https?:\/\/[^\s]+\.(?:gif|webp|png|jpg|jpeg)(?:\?[^\s]*)?)/gi;

  for (const seg of segments) {
    if (seg.type === 'gif') {
      finalSegments.push(seg);
    } else {
      const parts = seg.value.split(bareRegex);
      for (const part of parts) {
        if (!part) continue;
        if (bareRegex.test(part)) {
          finalSegments.push({ type: 'gif', value: part.trim() });
        } else {
          finalSegments.push({ type: 'text', value: part });
        }
      }
    }
  }

  return finalSegments;
}

export default function FormattedContent({
  content,
  className = '',
  imageClassName = ''
}: FormattedContentProps) {
  if (!content) return null;

  const segments = parseContentSegments(content);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {segments.map((seg, index) => {
        if (seg.type === 'gif') {
          return (
            <div key={index} className="my-1.5 inline-block max-w-full">
              <img
                src={seg.value}
                alt="Anime GIF"
                className={`rounded-xl max-h-40 sm:max-h-52 max-w-[200px] sm:max-w-[260px] object-contain border border-[#ff006a]/30 shadow-lg shadow-black/40 bg-black/40 hover:scale-[1.02] transition-transform duration-200 cursor-pointer block ${imageClassName}`}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  // If image fails, show small fallback link or text
                  const target = e.target as HTMLElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          );
        }

        return (
          <span key={index} className="leading-relaxed whitespace-pre-wrap break-words">
            {seg.value}
          </span>
        );
      })}
    </div>
  );
}
