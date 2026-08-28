import { useState, useEffect } from 'react';
import { Download, Smartphone, X, Sparkles, Check, Share2, PlusSquare, ArrowDown, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(true); // default true until checked
  const [showButton, setShowButton] = useState<boolean>(false);
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);

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

    // 2. Check if device is iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iosDevice);

    // 3. Listen for native browser PWA install prompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowButton(false);
      localStorage.setItem('animem_pwa_installed', 'true');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 5000);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // If no dismissed timestamp within 3 days, show button after 1.5s delay
    const now = Date.now();
    const isDismissedRecently = storedDismissed && (now - parseInt(storedDismissed, 10) < 3 * 24 * 60 * 60 * 1000);

    if (!isDismissedRecently) {
      const timer = setTimeout(() => {
        setShowButton(true);
      }, 1500);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    // If native prompt is available (Android / Chrome / Edge / Desktop)
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

    // If iOS device, show iOS Add to Home Screen instructions
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    // Generic modern browser fallback guidance
    setShowIOSModal(true);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowButton(false);
    localStorage.setItem('animem_pwa_dismissed', Date.now().toString());
  };

  const handleMarkAsInstalled = () => {
    setIsInstalled(true);
    setShowButton(false);
    setShowIOSModal(false);
    localStorage.setItem('animem_pwa_installed', 'true');
  };

  if (isInstalled) {
    return null;
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
                  src="https://api.animem.uz/i/0f31cac0-f63c-464e-83eb-a750f9c913e3" 
                  alt="Animem.uz Ilovasi" 
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
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#ff006a]/20 text-[#ff006a] border border-[#ff006a]/30 tracking-wider">
                    Tezkor & HD
                  </span>
                  <span className="text-[10px] text-white/50 font-medium hidden min-[380px]:inline">
                    PWA Ilova
                  </span>
                </div>
                <h4 className="text-xs sm:text-sm font-extrabold text-white tracking-tight leading-tight mt-0.5 truncate group-hover:text-[#ff006a] transition-colors">
                  Ilovamizni yuklab oling
                </h4>
                <p className="text-[11px] text-white/60 truncate leading-snug">
                  Barcha animelarni qulay tomosha qiling
                </p>
              </div>

              {/* Install Action CTA Button */}
              <button
                type="button"
                className="shrink-0 px-3 py-2 sm:px-3.5 sm:py-2 bg-gradient-to-r from-[#ff006a] to-[#ff2a85] hover:from-[#ff1a7a] hover:to-[#ff006a] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-[#ff006a]/30 transition-all group-hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Smartphone size={14} className="stroke-[2.5]" />
                <span className="hidden min-[360px]:inline">Yuklash</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={handleDismiss}
                className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0 cursor-pointer"
                title="Yopish"
                aria-label="Yopish"
              >
                <X size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS & Browser Fallback Guidance Modal */}
      <AnimatePresence>
        {showIOSModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-[#111116] border border-[#272730] rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_40px_rgba(255,0,106,0.2)] overflow-hidden"
            >
              {/* Top Accent Gradient */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#ff006a] via-purple-500 to-[#ff006a]" />

              {/* Close Button */}
              <button
                onClick={() => setShowIOSModal(false)}
                className="absolute top-4 right-4 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="text-center flex flex-col items-center">
                {/* Logo with Glow */}
                <div className="relative mb-3 mt-1">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#ff006a] to-purple-600 p-0.5 shadow-lg shadow-[#ff006a]/40">
                    <img 
                      src="https://api.animem.uz/i/0f31cac0-f63c-464e-83eb-a750f9c913e3" 
                      alt="Animem.uz" 
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/icon-192.png"; }}
                      className="w-full h-full object-cover rounded-2xl" 
                    />
                  </div>
                </div>

                <h3 className="text-lg font-black text-white uppercase tracking-wide">
                  Animem.uz Ilovasini O'rnatish
                </h3>
                <p className="text-white/60 text-xs sm:text-sm mt-1 max-w-xs">
                  {isIOS 
                    ? "iPhone / iPad Safari brauzerida ilovani o'rnatish juda oson:"
                    : "Qurilmangizga ilovani to'g'ridan-to'g'ri o'rnatish uchun quyidagi amallarni bajaring:"}
                </p>

                {/* Steps */}
                <div className="w-full bg-[#181820] border border-white/5 rounded-2xl p-4 mt-4 space-y-3 text-left">
                  {isIOS ? (
                    <>
                      <div className="flex items-start gap-3 text-xs text-white/90">
                        <span className="w-6 h-6 rounded-full bg-[#ff006a]/20 text-[#ff006a] border border-[#ff006a]/30 font-bold flex items-center justify-center shrink-0">
                          1
                        </span>
                        <div className="flex-1">
                          Safari brauzeri pastki panelidagi <strong className="text-white inline-flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded"><Share2 size={12} className="text-blue-400" /> Ulashish (Share)</strong> tugmasini bosing.
                        </div>
                      </div>

                      <div className="flex items-start gap-3 text-xs text-white/90">
                        <span className="w-6 h-6 rounded-full bg-[#ff006a]/20 text-[#ff006a] border border-[#ff006a]/30 font-bold flex items-center justify-center shrink-0">
                          2
                        </span>
                        <div className="flex-1">
                          Ochilgan menyudan pastga surib <strong className="text-white inline-flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded"><PlusSquare size={12} className="text-[#ff006a]" /> Bosh ekranga qo'shish</strong> (На экран «Домой») ni tanlang.
                        </div>
                      </div>

                      <div className="flex items-start gap-3 text-xs text-white/90">
                        <span className="w-6 h-6 rounded-full bg-[#ff006a]/20 text-[#ff006a] border border-[#ff006a]/30 font-bold flex items-center justify-center shrink-0">
                          3
                        </span>
                        <div className="flex-1">
                          Yuqori o'ng burchakdagi <strong className="text-[#ff006a]">Qo'shish (Add)</strong> tugmasini bosing. Ilova bosh ekranda paydo bo'ladi!
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-3 text-xs text-white/90">
                        <span className="w-6 h-6 rounded-full bg-[#ff006a]/20 text-[#ff006a] border border-[#ff006a]/30 font-bold flex items-center justify-center shrink-0">
                          1
                        </span>
                        <div className="flex-1">
                          Brauzeringiz menyusini (yuqori o'ng burchakdagi <strong className="text-white">⋮ 3 nuqta</strong>) oching.
                        </div>
                      </div>

                      <div className="flex items-start gap-3 text-xs text-white/90">
                        <span className="w-6 h-6 rounded-full bg-[#ff006a]/20 text-[#ff006a] border border-[#ff006a]/30 font-bold flex items-center justify-center shrink-0">
                          2
                        </span>
                        <div className="flex-1">
                          <strong className="text-[#ff006a] inline-flex items-center gap-1"><Smartphone size={12} /> "Ilovani o'rnatish"</strong> yoki <strong className="text-white">"Bosh ekranga qo'shish"</strong> tugmasini bosing.
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Buttons */}
                <div className="w-full flex flex-col sm:flex-row items-center gap-2.5 mt-5">
                  <button
                    onClick={handleMarkAsInstalled}
                    className="w-full py-3 px-5 bg-gradient-to-r from-[#ff006a] to-[#e6005c] hover:from-[#ff1a7d] hover:to-[#ff006a] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-[0_0_25px_rgba(255,0,106,0.5)] transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check size={16} />
                    <span>O'rnatdim / Tushundim</span>
                  </button>

                  <button
                    onClick={() => setShowIOSModal(false)}
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

      {/* Success Toast when App is Installed */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-20 sm:bottom-6 left-4 sm:left-6 z-50 bg-[#16161c] border border-green-500/50 rounded-2xl p-4 shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_20px_rgba(34,197,94,0.3)] flex items-center gap-3 text-white max-w-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-green-500/20 border border-green-500/40 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 text-green-400 stroke-[3]" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Ilova muvaffaqiyatli o'rnatildi! 🎉</h4>
              <p className="text-[11px] text-white/60 mt-0.5">
                Endi Animem.uz ilovasini to'g'ridan-to'g'ri bosh ekrandan ishga tushirishingiz mumkin.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
