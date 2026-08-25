const fs = require('fs');
const file = 'src/pages/Chat.tsx';
let code = fs.readFileSync(file, 'utf8');

const importRegex = /import React, \{ useState, useRef, useEffect \} from 'react';/;
code = code.replace(importRegex, `import React, { useState, useRef, useEffect, memo } from 'react';`);

// We need to extract the inline message rendering block.
// To do this, let's inject a MemoizedMessage component right above Chat.

const memoComponent = `
const MemoizedMessage = memo(({ 
  msg, 
  user, 
  activeMsgId, 
  setActiveMsgId, 
  setReplyingTo, 
  handleDeleteMessage,
  handleContextMenu,
  handleTouchStart,
  handleTouchEnd
}: any) => {
  const isMe = msg.user_id === user?.id;
  const canDelete = user && (user.role === 'admin' || user.id === msg.user_id);
  const avatarSrc = msg.user_avatar || msg.avatar_url;
  const isActive = activeMsgId === msg.id;
  const parsedContent = parseMessageContent(msg.content);
  const parsedReply = msg.reply_to_content ? parseMessageContent(msg.reply_to_content) : null;

  return (
    <div 
      onClick={() => setActiveMsgId(isActive ? null : msg.id)}
      onContextMenu={(e) => handleContextMenu(e, msg)}
      onTouchStart={() => handleTouchStart(msg)}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      className="flex items-start gap-2.5 group my-1 cursor-pointer select-none"
    >
      <Link to={\`/user/\${msg.user_id}\`} onClick={(e) => e.stopPropagation()} className="shrink-0 mt-0.5">
        {avatarSrc ? (
          <img loading="lazy" decoding="async"
            referrerPolicy="no-referrer"
            src={avatarSrc}
            alt={msg.user_name}
            className="w-9 h-9 rounded-full object-cover border-2 border-[#ff006a]/40 shrink-0 hover:border-[#ff006a] transition-all shadow-md"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2a2a2e] to-[#151518] border-2 border-[#ff006a]/40 flex items-center justify-center text-xs text-[#ff006a] font-extrabold uppercase shrink-0 shadow-md">
            {msg.user_name.charAt(0)}
          </div>
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <Link to={\`/user/\${msg.user_id}\`} onClick={(e) => e.stopPropagation()} className={\`font-bold text-xs hover:underline \${isMe ? 'text-[#ff006a]' : 'text-[#4fd1c5]'}\`}>
            {msg.user_name}
          </Link>
          <span className="text-white/40 text-[9px]">
            {format(new Date(msg.created_at), 'HH:mm')}
          </span>
          
          <div className="ml-auto flex items-center gap-1">
            {user && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setReplyingTo(msg);
                }}
                className={\`text-[#ff006a] hover:bg-[#ff006a]/20 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 transition-all border border-[#ff006a]/20 cursor-pointer \${
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }\`}
                title="Javob berish"
              >
                <CornerUpLeft size={10} />
                <span>Reply</span>
              </button>
            )}

            {canDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteMessage(msg.id);
                }}
                className={\`text-red-400 hover:text-red-300 hover:bg-red-950/40 text-[9px] font-bold p-1 rounded-full flex items-center transition-all border border-red-500/20 cursor-pointer \${
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }\`}
                title="O'chirish (yoki o'ng tugmani bosing)"
              >
                <Trash2 size={10} />
              </button>
            )}
          </div>
        </div>

        <div 
          className={\`px-3 py-2 text-white/95 text-xs inline-block leading-relaxed max-w-full shadow-lg rounded-xl border backdrop-blur-sm \${
            isMe 
              ? 'bg-[#141418]/90 border-[#ff006a]/30 text-white' 
              : 'bg-[#16161c]/90 border-white/15 text-white/90'
          }\`}
        >
          {msg.reply_to_id && (
            <div className="mb-1.5 text-[10px] bg-black/60 border-l-2 border-[#ff006a] p-1.5 rounded-sm text-left opacity-90">
              <span className="font-bold text-[#ff006a] text-[8px]">@{msg.reply_to_name}</span>
              <p className="text-white/70 text-[9px] truncate max-w-[180px]">
                {parsedReply?.isVoice ? (
                  <span className="flex items-center gap-1 text-[#ff006a]">
                    <Mic size={10} /> Ovozli xabar
                  </span>
                ) : (
                  parsedReply?.text || msg.reply_to_content
                )}
              </p>
            </div>
          )}

          {parsedContent.isVoice ? (
            <AudioMessage
              src={parsedContent.audioUrl}
              duration={parsedContent.duration}
              isMe={isMe}
            />
          ) : (
            <span>{parsedContent.text}</span>
          )}
        </div>
      </div>
    </div>
  );
});
`;

code = code.replace(/export default function Chat\(\) \{/, memoComponent + '\nexport default function Chat() {');

// Now let's replace the inline map function body:
const mapBodyRegex = /messages\.map\(\(msg\) => \{\s*const isMe[\s\S]*?\}\)/;
code = code.replace(mapBodyRegex, `messages.map((msg) => (
                  <MemoizedMessage
                    key={msg.id}
                    msg={msg}
                    user={user}
                    activeMsgId={activeMsgId}
                    setActiveMsgId={setActiveMsgId}
                    setReplyingTo={setReplyingTo}
                    handleDeleteMessage={handleDeleteMessage}
                    handleContextMenu={handleContextMenu}
                    handleTouchStart={handleTouchStart}
                    handleTouchEnd={handleTouchEnd}
                  />
                ))`);

fs.writeFileSync(file, code);
