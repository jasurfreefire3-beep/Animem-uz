import { useState, useEffect } from 'react';
import { Settings, Eye, Globe, Film, ToggleLeft, ToggleRight, Sparkles, Check, Bell, Send, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { 
  getNotificationPermission, 
  requestNotificationPermission, 
  sendDeviceNotification,
  isNotificationSupported,
  PWA_APP_ICON
} from '../services/notificationService';
import { useLanguage } from '../context/LanguageContext';
import { Language } from '../i18n/translations';

export default function Sozlamalar() {
  const { language, setLanguage, t } = useLanguage();
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'light' ? 'light' : 'dark';
  });
  const [quality, setQuality] = useState('1080p');
  const [autoPlay, setAutoPlay] = useState(true);
  const [savedMessage, setSavedMessage] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>('default');
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    // Sync with html class initial state
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }

    // Load config from localStorage
    const savedAutoPlay = localStorage.getItem('anime_settings_autoplay');
    if (savedAutoPlay !== null) {
      setAutoPlay(savedAutoPlay === 'true');
    }
    const savedQuality = localStorage.getItem('anime_settings_quality');
    if (savedQuality) {
      setQuality(savedQuality);
    }

    setNotifPermission(getNotificationPermission());

    const syncTheme = () => {
      const currentSaved = localStorage.getItem('theme');
      setTheme(currentSaved === 'light' ? 'light' : 'dark');
    };

    window.addEventListener('theme-changed', syncTheme);
    return () => window.removeEventListener('theme-changed', syncTheme);
  }, []);

  const handleToggleNotifications = async () => {
    if (!isNotificationSupported()) {
      alert("Kechirasiz, brauzeringiz bildirishnomalarni qo'llab-quvvatlamaydi.");
      return;
    }
    const granted = await requestNotificationPermission();
    setNotifPermission(getNotificationPermission());
    if (granted) {
      triggerSaveAlert();
    }
  };

  const handleSendTestNotification = async () => {
    if (notifPermission !== 'granted') {
      const granted = await requestNotificationPermission();
      setNotifPermission(getNotificationPermission());
      if (!granted) return;
    }

    const titles = {
      uz: "Animem.uz | Yangi Anime Premyerasi! 🎬",
      ru: "Animem.uz | Новая премьера аниме! 🎬",
      ing: "Animem.uz | New Anime Premiere! 🎬"
    };

    const bodies = {
      uz: "Solo Leveling 2-mavsum 1-qismi yuklandi! Tomosha qilish uchun bosing.",
      ru: "Загружена 1-я серия 2-го сезона Solo Leveling! Нажмите для просмотра.",
      ing: "Solo Leveling Season 2 Episode 1 is now available! Click to watch."
    };

    const success = await sendDeviceNotification({
      title: titles[language] || titles.uz,
      body: bodies[language] || bodies.uz,
      icon: PWA_APP_ICON,
      badge: PWA_APP_ICON,
      image: "https://api.animem.uz/api/images/1788100536951_0twmwyl",
      url: "/",
      tag: "test-notification"
    });

    if (success) {
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3500);
    }
  };

  const handleThemeChange = (val: 'dark' | 'light') => {
    setTheme(val);
    localStorage.setItem('theme', val);
    if (val === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    window.dispatchEvent(new Event('theme-changed'));
    triggerSaveAlert();
  };

  const handleAutoplayToggle = () => {
    const newVal = !autoPlay;
    setAutoPlay(newVal);
    localStorage.setItem('anime_settings_autoplay', String(newVal));
    triggerSaveAlert();
  };

  const handleQualityChange = (val: string) => {
    setQuality(val);
    localStorage.setItem('anime_settings_quality', val);
    triggerSaveAlert();
  };

  const handleLangChange = (langKey: Language) => {
    setLanguage(langKey, true);
    triggerSaveAlert();
  };

  const triggerSaveAlert = () => {
    setSavedMessage(true);
    setTimeout(() => {
      setSavedMessage(false);
    }, 2000);
  };

  const languagesList: { code: Language; label: string; flag: string }[] = [
    { code: 'uz', label: "O'zbekcha", flag: "🇺🇿" },
    { code: 'ru', label: "Русский", flag: "🇷🇺" },
    { code: 'ing', label: "English", flag: "🇬🇧" }
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-6 relative overflow-hidden">
        <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wide flex items-center gap-3">
          <Settings className="w-6 h-6 text-[#ff006a]" /> {t.settingsTitle}
        </h1>
        <p className="text-white/50 text-xs mt-1">{t.settingsSubtitle}</p>
      </div>

      {savedMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold rounded-xl flex items-center gap-2"
        >
          <Check size={14} /> {t.settingsSaved}
        </motion.div>
      )}

      {/* Settings Panel */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-6 divide-y divide-[#222] space-y-6">
        
        {/* Language Settings */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Globe size={16} className="text-[#ff006a]" /> {t.systemLanguage}
            </h3>
            <p className="text-white/40 text-xs">{t.chooseLanguage}</p>
          </div>
          <div className="flex items-center space-x-1.5 flex-wrap gap-1">
            {languagesList.map((item) => (
              <button
                key={item.code}
                onClick={() => handleLangChange(item.code)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  language === item.code 
                    ? 'bg-gradient-to-r from-[#ff006a] to-[#d40058] border-[#ff006a] text-white shadow-[0_0_15px_rgba(255,0,106,0.35)] scale-105' 
                    : 'bg-[#000] border-[#222] text-white/60 hover:text-white hover:border-[#333]'
                }`}
              >
                <span>{item.flag}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Theme Settings */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-6">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles size={16} className="text-[#ff006a]" /> {t.interfaceTheme}
            </h3>
            <p className="text-white/40 text-xs">{t.themeSubtitle}</p>
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => handleThemeChange('dark')}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                theme === 'dark' 
                  ? 'bg-[#ff006a] border-[#ff006a] text-white shadow-[0_0_10px_rgba(255,0,106,0.2)]' 
                  : 'bg-[#000] border-[#222] text-white/50 hover:text-white hover:border-[#333]'
              }`}
            >
              {t.darkTheme}
            </button>
            <button
              onClick={() => handleThemeChange('light')}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                theme === 'light' 
                  ? 'bg-[#ff006a] border-[#ff006a] text-white shadow-[0_0_10px_rgba(255,0,106,0.2)]' 
                  : 'bg-[#000] border-[#222] text-white/50 hover:text-white hover:border-[#333]'
              }`}
            >
              {t.lightTheme}
            </button>
          </div>
        </div>

        {/* Video Quality Settings */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-6">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Film size={16} className="text-[#ff006a]" /> {t.standardQuality}
            </h3>
            <p className="text-white/40 text-xs">{t.qualitySubtitle}</p>
          </div>
          <div className="flex items-center space-x-1.5">
            {['1080p', '720p', '480p', 'Auto'].map((q) => (
              <button
                key={q}
                onClick={() => handleQualityChange(q)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  quality === q 
                    ? 'bg-[#ff006a] border-[#ff006a] text-white shadow-[0_0_10px_rgba(255,0,106,0.2)]' 
                    : 'bg-[#000] border-[#222] text-white/50 hover:text-white hover:border-[#333]'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Auto Play Settings */}
        <div className="flex items-center justify-between gap-4 pt-6">
          <div className="space-y-0.5 flex-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Eye size={16} className="text-[#ff006a]" /> {t.autoPlay}
            </h3>
            <p className="text-white/40 text-xs">{t.autoPlaySubtitle}</p>
          </div>
          <button
            onClick={handleAutoplayToggle}
            className="p-1 text-white hover:text-[#ff006a] transition-all cursor-pointer"
          >
            {autoPlay ? (
              <ToggleRight size={40} className="text-[#ff006a]" />
            ) : (
              <ToggleLeft size={40} className="text-white/30" />
            )}
          </button>
        </div>

        {/* Push Notifications Settings */}
        <div className="pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Bell size={16} className="text-[#ff006a]" /> {t.pushNotifications}
              </h3>
              <p className="text-white/40 text-xs">
                {t.pushNotificationsSubtitle}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleNotifications}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                  notifPermission === 'granted'
                    ? 'bg-green-500/20 border-green-500/40 text-green-400'
                    : 'bg-[#ff006a] border-[#ff006a] hover:bg-[#e6005c] text-white shadow-[0_0_12px_rgba(255,0,106,0.3)]'
                }`}
              >
                {notifPermission === 'granted' ? (
                  <>
                    <CheckCircle2 size={14} /> {t.notificationsEnabled}
                  </>
                ) : (
                  <>
                    <Bell size={14} /> {t.enableNotifications}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Test Notification Button & Status */}
          <div className="bg-[#0a0a0c] border border-white/5 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-white/70 flex items-center gap-2">
              <Sparkles size={14} className="text-yellow-400 shrink-0" />
              <span>{t.testNotification}</span>
            </div>
            <button
              onClick={handleSendTestNotification}
              className="px-3.5 py-1.5 bg-white/10 hover:bg-white/15 active:scale-95 text-white text-xs font-semibold rounded-lg border border-white/10 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Send size={13} className="text-[#ff006a]" />
              <span>{testSent ? (t.sent || "Yuborildi! ✨") : t.sendTestNotification}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
