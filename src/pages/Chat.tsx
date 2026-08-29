import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Message } from '../types';
import { io, Socket } from 'socket.io-client';
import { Send, Sparkles, Trash2, CornerUpLeft, X, Mic, Smile, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import AudioMessage, { parseMessageContent } from '../components/AudioMessage';
import GifPicker from '../components/GifPicker';
import FormattedContent, { isGifContent } from '../components/FormattedContent';

const CHAT_BG_IMAGE = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRbK8qI1E3BjTK74xv_20a3cTlFO8toJzzRqbJmZHUE4Qrg4dAKPrWmyZw&s=10";


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
      <Link to={`/user/${msg.user_id}`} onClick={(e) => e.stopPropagation()} className="shrink-0 mt-0.5">
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
          <Link to={`/user/${msg.user_id}`} onClick={(e) => e.stopPropagation()} className={`font-bold text-xs hover:underline ${isMe ? 'text-[#ff006a]' : 'text-[#4fd1c5]'}`}>
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
                className={`text-[#ff006a] hover:bg-[#ff006a]/20 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 transition-all border border-[#ff006a]/20 cursor-pointer ${
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
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
                className={`text-red-400 hover:text-red-300 hover:bg-red-950/40 text-[9px] font-bold p-1 rounded-full flex items-center transition-all border border-red-500/20 cursor-pointer ${
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="O'chirish (yoki o'ng tugmani bosing)"
              >
                <Trash2 size={10} />
              </button>
            )}
          </div>
        </div>

        <div 
          className={`px-3 py-2 text-white/95 text-xs inline-block leading-relaxed max-w-full shadow-lg rounded-xl border backdrop-blur-sm ${
            isMe 
              ? 'bg-[#141418]/90 border-[#ff006a]/30 text-white' 
              : 'bg-[#16161c]/90 border-white/15 text-white/90'
          }`}
        >
          {msg.reply_to_id && (
            <div className="mb-1.5 text-[10px] bg-black/60 border-l-2 border-[#ff006a] p-1.5 rounded-sm text-left opacity-90">
              <span className="font-bold text-[#ff006a] text-[8px]">@{msg.reply_to_name}</span>
              <p className="text-white/70 text-[9px] truncate max-w-[180px]">
                {parsedReply?.isVoice ? (
                  <span className="flex items-center gap-1 text-[#ff006a]">
                    <Mic size={10} /> Ovozli xabar
                  </span>
                ) : isGifContent(parsedReply?.text || msg.reply_to_content) ? (
                  <span className="flex items-center gap-1 text-[#ff006a]">
                    <Sparkles size={10} /> GIF Stiker
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
            <FormattedContent content={parsedContent.text || msg.content} />
          )}
        </div>
      </div>
    </div>
  );
});

export default function Chat() {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const cached = localStorage.getItem('cached_chat_messages');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('cached_chat_messages');
      return !(cached && JSON.parse(cached).length > 0);
    } catch (e) {
      return true;
    }
  });
  const [input, setInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [activeMsgId, setActiveMsgId] = useState<string | number | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    try {
      if (messages.length > 0) {
        // Only cache the last 50 messages to keep it fast
        localStorage.setItem('cached_chat_messages', JSON.stringify(messages.slice(-50)));
      }
    } catch(e) {}
  }, [messages]);

  // Context menu / Long press state for message actions
  const [selectedMsgForAction, setSelectedMsgForAction] = useState<Message | null>(null);
  const touchTimeoutRef = useRef<any>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ id: string | number; name: string }[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 100;
    setShowScrollBottom(isScrolledUp);
  };

  const handleScrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      scrollToBottom();
    }
  };

  useEffect(() => {

    if (messages.length === 0) {
      setIsLoading(true);
    }

    const fetchInitialMessages = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
        const res = await fetch(`${API_BASE}/api/chat/messages`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setMessages(data);
            try {
              localStorage.setItem('cached_chat_messages', JSON.stringify(data));
            } catch (e) {}
          }
        }
      } catch (err) {
        // Socket listener handles it
      } finally {
        setIsLoading(false);
        scrollToBottom();
      }
    };
    fetchInitialMessages();

    // Connect to the socket server
    const socket = io(window.location.origin);
    socketRef.current = socket;

    socket.on('previousMessages', (prevMsgs: Message[]) => {
      if (Array.isArray(prevMsgs) && prevMsgs.length > 0) {
        setMessages(prevMsgs);
        try {
          localStorage.setItem('cached_chat_messages', JSON.stringify(prevMsgs));
        } catch (e) {}
      }
      setIsLoading(false);
      scrollToBottom();
    });

    socket.on('newMessage', (newMsg: Message) => {
      setMessages((prev) => {
        if (prev.some(m => String(m.id) === String(newMsg.id))) return prev;
        return [...prev, newMsg];
      });
      setIsLoading(false);
      scrollToBottom();
    });

    socket.on('messageDeleted', (deletedId: any) => {
      setMessages((prev) => prev.filter(msg => String(msg.id) !== String(deletedId)));
    });

    socket.on('userTyping', (typingUser: { id: string | number; name: string }) => {
      setTypingUsers((prev) => {
        if (prev.find(u => String(u.id) === String(typingUser.id))) return prev;
        return [...prev, typingUser];
      });
    });

    socket.on('userStoppedTyping', (typingUser: { id: string | number; name: string }) => {
      setTypingUsers((prev) => prev.filter(u => String(u.id) !== String(typingUser.id)));
    });


    socket.on('chatCleared', () => {
      setMessages([]);
      try {
        localStorage.removeItem('cached_chat_messages');
      } catch (e) {}
      setIsLoading(false);
    });

    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    return () => {
      clearTimeout(timeout);
      socket.disconnect();
    };
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const sendChatMessage = async (contentToSend: string) => {
    if (!contentToSend || !user) return;
    const payload = {
      user_id: user.id,
      user_name: user.name,
      content: contentToSend,
      reply_to_id: replyingTo ? String(replyingTo.id) : null,
      reply_to_name: replyingTo ? replyingTo.user_name : null,
      reply_to_content: replyingTo ? replyingTo.content : null
    };

    let sent = false;
    if (socketRef.current && socketRef.current.connected) {
      try {
        socketRef.current.emit('sendMessage', payload);
        sent = true;
      } catch (socketErr) {
        console.error("Socket send failed:", socketErr);
      }
    }

    if (!sent) {
      try {
        const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
        const authToken = token || localStorage.getItem('token') || '';
        const res = await fetch(`${API_BASE}/api/chat/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify(payload)
        });
        
        if (res.ok) {
          sent = true;
        }
      } catch (err) {
        console.warn("REST API send fallback failed:", err);
      }
    }

    if (sent) {
      setInput('');
      setReplyingTo(null);
      setShowEmojiPicker(false);
    } else {
      console.error("Failed to send message via all channels");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;
    await sendChatMessage(input.trim());
  };

  // Immediate message deletion
  const handleDeleteMessage = useCallback(async (msgId: string | number) => {
    try {
      setMessages((prev) => prev.filter((m) => String(m.id) !== String(msgId)));
      setSelectedMsgForAction(null);
      const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
      const authToken = token || localStorage.getItem('token') || '';
      await fetch(`${API_BASE}/api/chat/messages/${msgId}`, {
        method: 'DELETE',
        headers: {
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        }
      });
    } catch (e) {
      console.error("Failed to delete message", e);
    }
  }, [token]);

  // Context menu (Right Click) handler
  const handleContextMenu = useCallback((e: React.MouseEvent, msg: Message) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    setSelectedMsgForAction(msg);
  }, [user]);

  // Long press (Touch) handler for mobile
  const handleTouchStart = useCallback((msg: Message) => {
    if (!user) return;
    touchTimeoutRef.current = setTimeout(() => {
      if (navigator.vibrate) {
        try { navigator.vibrate(40); } catch (e) {}
      }
      setSelectedMsgForAction(msg);
    }, 450);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current);
      touchTimeoutRef.current = null;
    }
  }, []);

  // Voice recording handlers
  const startRecording = async () => {
    if (!user) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);
      setShowEmojiPicker(false);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access denied or error:", err);
      alert("Mikrofondan foydalanishga ruxsat berilmadi yoki mikrofon ulanmagan.");
    }
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    const finalDuration = recordingDuration;
    clearInterval(recordingTimerRef.current);

    mediaRecorderRef.current.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size > 0 && finalDuration >= 1) {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            const voicePayload = `[voice duration="${finalDuration}"]${base64Audio}[/voice]`;
            await sendChatMessage(voicePayload);
          };
          reader.readAsDataURL(audioBlob);
        }
      } catch (e) {
        console.error("Error sending voice message:", e);
      } finally {
        if (mediaRecorderRef.current?.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
        }
        setIsRecording(false);
        setRecordingDuration(0);
      }
    };

    mediaRecorderRef.current.stop();
  };

  const cancelRecording = () => {
    clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const handleSelectGif = async (gifUrl: string) => {
    setShowEmojiPicker(false);
    await sendChatMessage(`[gif]${gifUrl}[/gif]`);
  };

  const handleSelectEmoji = (emojiOrGif: string) => {
    if (emojiOrGif.startsWith('[gif]') || emojiOrGif.startsWith('http')) {
      handleSelectGif(emojiOrGif.replace(/\[\/?gif\]/g, ''));
      return;
    }
    setInput(prev => prev + emojiOrGif);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const formatRecordingTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleClearChat = async () => {
    if (window.confirm("Haqiqatan ham barcha xabarlarni o'chirmoqchimisiz?")) {
      try {
        const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
        await fetch(`${API_BASE}/api/chat/clear`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (e) {
        console.error("Failed to clear chat", e);
      }
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center p-4">
        <div className="bg-[#0c0c0e] border border-[#1a1a1a] p-8 rounded-sm max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-[#ff006a]/10 border border-[#ff006a]/30 flex items-center justify-center mx-auto text-[#ff006a]">
            <Sparkles size={24} />
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide">Umumiy chatga xush kelibsiz!</h2>
          <p className="text-xs text-white/50 leading-relaxed">
            Boshqa anime muxlislari bilan jonli muloqot qilish, ovozli xabarlar va emojilar yuborish uchun profilingizga kiring.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              to="/login"
              className="px-6 py-2.5 bg-gradient-to-r from-[#ff0055] to-[#ff006a] hover:opacity-90 text-white font-bold text-xs rounded-sm transition-all shadow-lg shadow-[#ff006a]/20"
            >
              Kirish
            </Link>
            <Link
              to="/register"
              className="px-6 py-2.5 bg-[#1a1a1a] hover:bg-[#252525] text-white font-bold text-xs rounded-sm transition-all border border-white/10"
            >
              Ro'yxatdan o'tish
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030303] text-white flex flex-col pt-16 pb-6">
      <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col px-2 sm:px-4">
        {/* Chat Container */}
        <div className="bg-[#09090b]/95 border border-[#1a1a1a] rounded-sm flex-1 flex flex-col overflow-hidden shadow-2xl h-[calc(100vh-100px)]">
          {/* Header */}
          <div className="p-3.5 sm:p-4 bg-[#0c0c0e]/95 border-b border-[#1a1a1a] flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-[#ff006a]/10 border border-[#ff006a]/40 flex items-center justify-center text-[#ff006a]">
                <Sparkles size={16} />
              </div>
              <div>
                <h1 className="font-extrabold text-sm sm:text-base text-white tracking-wide flex items-center gap-2">
                  <span>Umumiy chat</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ff006a]/20 text-[#ff006a] font-bold border border-[#ff006a]/30">
                    Jonli
                  </span>
                </h1>
                <p className="text-[10px] text-white/40 hidden sm:block">
                  Ovozli va matnli xabarlar orqali muloqot qiling
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {user.role === 'admin' && (
                <button
                  onClick={handleClearChat}
                  className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-sm text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Barcha xabarlarni o'chirish"
                >
                  <Trash2 size={13} />
                  <span className="hidden sm:inline">Tozalash</span>
                </button>
              )}
            </div>
          </div>

          {/* Messages Area with Anime Custom Background Wallpaper */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar relative"
            style={{
              backgroundImage: `linear-gradient(to bottom, rgba(9, 9, 11, 0.85), rgba(3, 3, 3, 0.90)), url("${CHAT_BG_IMAGE}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'local'
            }}
          >
            {isLoading && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <div className="w-8 h-8 border-2 border-[#ff006a] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-white/70 text-xs font-semibold animate-pulse tracking-wide">
                  Xabarlar yuklanmoqda...
                </span>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-24 text-white/40 text-xs font-medium">
                Xabarlar mavjud emas. Suhbatni birinchi bo'lib boshlang!
              </div>
            ) : (
              messages.map((msg) => (
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
                ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Replying Preview */}
          <AnimatePresence>
            {replyingTo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 py-2 bg-[#0c0c0e] border-t border-[#1a1a1a] flex items-center justify-between text-xs shrink-0"
              >
                <div className="flex items-center space-x-2 border-l-2 border-[#ff006a] pl-2.5">
                  <CornerUpLeft size={12} className="text-[#ff006a]" />
                  <div className="truncate">
                    <span className="font-bold text-[#ff006a]">@{replyingTo.user_name}</span>
                    <span className="text-white/50 ml-2 truncate max-w-xs inline-block align-middle">
                      {parseMessageContent(replyingTo.content).isVoice ? '🎤 Ovozli xabar' : replyingTo.content}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="p-1 text-white/40 hover:text-white cursor-pointer"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Context Action Menu Modal (Long-press & Right-Click) */}
          <AnimatePresence>
            {selectedMsgForAction && (
              <div 
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
                onClick={() => setSelectedMsgForAction(null)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[#121216] border border-[#ff006a]/40 rounded-xl p-4 w-80 shadow-2xl space-y-3"
                >
                  <div className="border-b border-white/10 pb-2">
                    <p className="text-[11px] text-white/50">Xabar amallari</p>
                    <p className="text-xs font-bold text-white truncate">
                      {selectedMsgForAction.user_name}: {parseMessageContent(selectedMsgForAction.content).isVoice ? '🎤 Ovozli xabar' : selectedMsgForAction.content}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    {(user.role === 'admin' || user.id === selectedMsgForAction.user_id) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(selectedMsgForAction.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-colors cursor-pointer border border-red-500/20"
                      >
                        <Trash2 size={15} />
                        <span>Xabarni o'chirish</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setReplyingTo(selectedMsgForAction);
                        setSelectedMsgForAction(null);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <CornerUpLeft size={15} className="text-[#ff006a]" />
                      <span>Javob berish</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMsgForAction(null)}
                      className="w-full py-1.5 text-xs text-white/40 hover:text-white transition-colors text-center"
                    >
                      Bekor qilish
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* GIF Picker Popover */}
          <AnimatePresence>
            {showEmojiPicker && (
              <div className="absolute bottom-20 left-4 z-50">
                <GifPicker
                  onSelectGif={handleSelectGif}
                  onClose={() => setShowEmojiPicker(false)}
                />
              </div>
            )}
          </AnimatePresence>

          {/* Scroll To Bottom Button */}
          <AnimatePresence>
            {showScrollBottom && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.6, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.6, y: 10 }}
                onClick={handleScrollToBottom}
                className="absolute right-4 sm:right-6 bottom-20 z-40 p-2.5 bg-[#121216]/95 hover:bg-[#ff006a] text-[#ff006a] hover:text-white border border-[#ff006a]/40 hover:border-[#ff006a] rounded-full shadow-2xl shadow-black/80 backdrop-blur-md transition-all duration-200 cursor-pointer flex items-center justify-center group"
                title="Pastga tushish"
              >
                <ChevronDown className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Input Area */}
          <div className="p-3.5 bg-[#0c0c0e] border-t border-[#1a1a1a] relative shrink-0">
            {isRecording ? (
              /* Audio Recording Bar */
              <div className="flex items-center justify-between bg-[#150a10] border border-[#ff006a]/40 rounded-sm px-4 py-2.5 animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-3.5 h-3.5 rounded-full bg-red-500 animate-ping" />
                  <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
                    {formatRecordingTime(recordingDuration)}
                  </span>
                  <span className="text-xs text-[#ff006a] font-semibold hidden sm:inline">
                    Ovoz yozilmoqda...
                  </span>
                </div>

                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="p-1.5 text-white/50 hover:text-red-400 hover:bg-white/10 rounded transition-colors cursor-pointer"
                    title="Bekor qilish"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={stopAndSendRecording}
                    className="px-3.5 py-1.5 bg-[#ff006a] hover:bg-[#d40058] text-white rounded font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#ff006a]/30 transition-all cursor-pointer"
                    title="Yuborish"
                  >
                    <Send size={13} />
                    <span>Yuborish</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Standard Input Bar */
              <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
                {/* GIF Trigger Button */}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`px-3 py-1.5 rounded-sm text-xs font-black tracking-wider transition-all cursor-pointer border ${
                    showEmojiPicker
                      ? 'text-white bg-[#ff006a] border-[#ff006a] shadow-sm shadow-[#ff006a]/40 scale-105'
                      : 'text-[#ff006a] bg-[#ff006a]/10 border-[#ff006a]/30 hover:bg-[#ff006a] hover:text-white hover:border-[#ff006a]'
                  }`}
                  title="Anime GIF Stikerlar"
                >
                  GIF
                </button>

                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={replyingTo ? "Javob yozing..." : "Fikringizni yozing..."}
                  className="flex-1 bg-[#030303] border border-[#1a1a1a] rounded-sm px-4 py-2.5 text-xs sm:text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#ff006a]/50 transition-colors"
                />

                {input.trim() ? (
                  <button
                    type="submit"
                    className="p-2.5 text-white bg-[#ff006a] hover:bg-[#d40058] rounded-sm transition-all flex items-center justify-center shadow shadow-[#ff006a]/10 cursor-pointer"
                    title="Yuborish"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="p-2.5 text-white/70 hover:text-white bg-[#1a1a1e] hover:bg-[#ff006a] rounded-sm transition-all flex items-center justify-center border border-white/10 cursor-pointer"
                    title="Ovozli xabar yozish"
                  >
                    <Mic className="w-4 h-4 text-[#ff006a] hover:text-white" />
                  </button>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
