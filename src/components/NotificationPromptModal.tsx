import { useState, useEffect } from 'react';
import { Bell, Sparkles, Film, Zap, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  shouldShowNotificationPrompt,
  requestNotificationPermission,
  dismissNotificationPrompt,
  registerServiceWorker,
  getNotificationPermission
} from '../services/notificationService';

export default function NotificationPromptModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  useEffect(() => {
    // Register SW automatically on load
    registerServiceWorker();

    // Check if we should present the prompt to user
    const timer = setTimeout(() => {
      if (shouldShowNotificationPrompt()) {
        setIsOpen(true);
      }
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  const handleEnable = async () => {
    setIsActivating(true);
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        setIsOpen(false);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 4500);
      } else {
        // Permission was dismissed or denied
        setIsOpen(false);
        dismissNotificationPrompt();
      }
    } catch (e) {
      console.error(e);
      setIsOpen(false);
    } finally {
      setIsActivating(false);
    }
  };

  const handleDismiss = () => {
    dismissNotificationPrompt();
    setIsOpen(false);
  };

  return (
    <>
      {/* Main Notification Permission Request Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="notification-prompt-modal-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-3 sm:p-4"
          >
            {/* Backdrop */}
            <motion.div
              key="notification-prompt-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleDismiss}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            />

            {/* Modal Box */}
            <motion.div
              key="notification-prompt-box"
              initial={{ opacity: 0, scale: 0.92, y: 25 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 25 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="relative w-full max-w-md bg-[#111114] border border-[#27272e] rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_40px_rgba(255,0,106,0.15)] overflow-hidden z-10"
            >
              {/* Top Accent Gradient Bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#ff006a] via-[#ff6699] to-[#ff006a]" />

              {/* Close Button */}
              <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                title="Yopish"
              >
                <X size={18} />
              </button>

              <div className="flex flex-col items-center text-center">
                {/* Glowing Bell Icon */}
                <div className="relative mb-5 mt-2">
                  <div className="absolute -inset-2 bg-[#ff006a]/25 rounded-full blur-lg animate-pulse" />
                  <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#23101c] to-[#140810] border border-[#ff006a]/50 flex items-center justify-center shadow-[0_0_20px_rgba(255,0,106,0.3)]">
                    <Bell className="w-8 h-8 text-[#ff006a] animate-bounce" />
                    <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-[#111114]" />
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-wide">
                  Yangi animelardan xabardor bo'ling!
                </h2>

                {/* Description */}
                <p className="text-white/70 text-xs sm:text-sm mt-2 leading-relaxed max-w-sm">
                  Animem.uz saytiga yangi o'zbekcha tarjima animelar va yangi qismlar joylanganda qurilmangizga to'g'ridan-to'g'ri bildirishnoma boradi.
                </p>

                {/* Feature Bullet Points */}
                <div className="w-full bg-[#17171c] border border-white/5 rounded-xl p-3.5 mt-4 space-y-2 text-left">
                  <div className="flex items-center gap-2.5 text-xs text-white/80">
                    <Zap className="w-4 h-4 text-[#ff006a] shrink-0" />
                    <span>Yangi qismlar chiqqan zahoti tezkor bildirishnoma</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-white/80">
                    <Film className="w-4 h-4 text-pink-400 shrink-0" />
                    <span>Yangi serial va premyeralar haqida xabar</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-white/80">
                    <Sparkles className="w-4 h-4 text-yellow-400 shrink-0" />
                    <span>Mutlaqo bepul, spamsiz va istalgan vaqt o'chirish mumkin</span>
                  </div>
                </div>

                {/* Buttons */}
                <div className="w-full flex flex-col sm:flex-row items-center gap-2.5 mt-5">
                  <button
                    onClick={handleEnable}
                    disabled={isActivating}
                    className="w-full py-3 px-5 bg-gradient-to-r from-[#ff006a] to-[#e6005c] hover:from-[#ff1a7d] hover:to-[#ff006a] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-[0_0_25px_rgba(255,0,106,0.5)] transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Bell className="w-4 h-4" />
                    <span>{isActivating ? 'Yoqilmoqda...' : 'Bildirishnomalarni yoqish'}</span>
                  </button>

                  <button
                    onClick={handleDismiss}
                    className="w-full sm:w-auto py-3 px-4 text-white/50 hover:text-white hover:bg-white/5 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Keyinroq
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Toast */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            key="notification-success-toast"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-20 sm:bottom-8 right-4 sm:right-8 z-[110] bg-[#16161a] border border-[#ff006a]/40 rounded-xl p-4 shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_20px_rgba(255,0,106,0.3)] flex items-center gap-3 text-white max-w-sm"
          >
            <div className="w-9 h-9 rounded-lg bg-green-500/20 border border-green-500/40 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Bildirishnomalar faollashdi!</h4>
              <p className="text-[11px] text-white/60 mt-0.5">
                Yangi animelar va qismlar chiqqanda qurilmangizga bildirishnoma yuboriladi.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
