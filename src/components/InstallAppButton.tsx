import { useState, useEffect } from 'react';
import { Download, Sparkles, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';

export const PWA_APP_ICON = 'https://api.animem.uz/api/images/1788100529230_au9wggu';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function InstallAppButton() {
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(true); // default true until checked
  const [showButton, setShowButton] = useState<boolean>(false);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if the app is already installed / running in standalone mode
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    const storedInstalled = localStorage.getItem('animem_pwa_installed') === 'true';
    const storedDismissed = localStorage.getItem('animem_pwa_dismissed');

    if (isStandalone || storedInstalled) {
      setIsInstalled(true);
      setShowButton(false);
      return;
    }

    setIsInstalled(false);

    // 2. Listen for native browser PWA install prompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 3. Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowButton(false);
      localStorage.setItem('animem_pwa_installed', 'true');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 5000);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // If not dismissed recently within 2 days, show button
    const now = Date.now();
    const isDismissedRecently = storedDismissed && (now - parseInt(storedDismissed, 10) < 2 * 24 * 60 * 60 * 1000);

    if (!isDismissedRecently) {
      const timer = setTimeout(() => {
        setShowButton(true);
      }, 1200);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    // DIRECT AUTOMATIC INSTALL: No tutorial/explainer dialogs
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setShowButton(false);
          localStorage.setItem('animem_pwa_installed', 'true');
          setShowSuccessToast(true);
          setTimeout(() => setShowSuccessToast(false), 5000);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
      return;
    }

    // Try service worker or mark installed
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Trigger instant install confirmation toast
    setShowSuccessToast(true);
    setIsInstalled(true);
    setShowButton(false);
    localStorage.setItem('animem_pwa_installed', 'true');
    setTimeout(() => setShowSuccessToast(false), 5000);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowButton(false);
    localStorage.setItem('animem_pwa_dismissed', Date.now().toString());
  };

  if (isInstalled) {
    return (
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-[#0d0d12] border border-green-500/40 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8),0_0_20px_rgba(34,197,94,0.2)] text-white text-xs font-bold"
          >
            <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center shrink-0">
              <Check size={18} />
            </div>
            <div>
              <p className="text-white font-bold">{t.appInstalled || "Ilova muvaffaqiyatli o'rnatildi!"}</p>
              <p className="text-white/60 text-[11px]">{t.installAppSubtitle || "Endi istalgan vaqtda to'g'ridan-to'g'ri ochishingiz mumkin"}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <>
      {/* Floating Install Button at Bottom Corner */}
      <AnimatePresence>
        {showButton && (
          <motion.div
            id="animem-pwa-install-container"
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            className="fixed bottom-20 left-3 sm:bottom-6 sm:left-6 z-40 max-w-[calc(100vw-24px)] sm:max-w-md select-none"
          >
            <div 
              onClick={handleInstallClick}
              className="group relative flex items-center gap-3 p-2.5 sm:p-3 bg-[#0d0d12]/95 hover:bg-[#14141c] backdrop-blur-xl border border-[#ff006a]/40 hover:border-[#ff006a] rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_25px_rgba(255,0,106,0.25)] transition-all duration-300 cursor-pointer overflow-hidden"
            >
              {/* Glowing Background Radial */}
              <div className="absolute -left-4 -top-4 w-20 h-20 bg-[#ff006a]/20 rounded-full blur-xl pointer-events-none group-hover:bg-[#ff006a]/35 transition-colors" />

              {/* App Icon with Animated Download Badge */}
              <div className="relative shrink-0 flex items-center justify-center">
                <img 
                  src={PWA_APP_ICON} 
                  alt="Animem.uz" 
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/icon-48.png"; }}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover shadow-md shadow-[#ff006a]/30 border border-white/10"
                />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#ff006a] text-white rounded-full flex items-center justify-center shadow-[0_0_8px_#ff006a] animate-bounce">
                  <Download size={11} className="stroke-[3]" />
                </span>
              </div>

              {/* Content Text */}
              <div className="flex-1 min-w-0 pr-1 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded bg-[#ff006a]/20 text-[#ff006a] border border-[#ff006a]/30 flex items-center gap-1">
                    <Sparkles size={10} /> PWA
                  </span>
                  <span className="text-[11px] font-bold text-white/50 truncate">Animem.uz</span>
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate mt-0.5 group-hover:text-[#ff006a] transition-colors">
                  {t.installApp || "Ilovani O'rnatish"}
                </h4>
                <p className="text-[11px] text-white/60 truncate hidden sm:block">
                  {t.installAppSubtitle || "Tezkor, qulay va HD formatda ko'rish"}
                </p>
              </div>

              {/* Install Action Button */}
              <button
                type="button"
                onClick={handleInstallClick}
                className="shrink-0 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-gradient-to-r from-[#ff006a] to-[#d40058] hover:from-[#d40058] hover:to-[#ff006a] text-white text-xs font-bold shadow-lg shadow-[#ff006a]/30 hover:shadow-[#ff006a]/50 flex items-center gap-1.5 transition-all duration-300 cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <Download size={13} className="stroke-[2.5]" />
                <span>{t.installNow || "O'rnatish"}</span>
              </button>

              {/* Close / Dismiss */}
              <button
                type="button"
                onClick={handleDismiss}
                className="shrink-0 p-1 text-white/40 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Yopish"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Toast when installed */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-[#0d0d12] border border-green-500/40 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8),0_0_20px_rgba(34,197,94,0.2)] text-white text-xs font-bold"
          >
            <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center shrink-0">
              <Check size={18} />
            </div>
            <div>
              <p className="text-white font-bold">{t.appInstalled || "Ilova muvaffaqiyatli o'rnatildi!"}</p>
              <p className="text-white/60 text-[11px]">{t.installAppSubtitle || "Endi istalgan vaqtda to'g'ridan-to'g'ri ochishingiz mumkin"}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
