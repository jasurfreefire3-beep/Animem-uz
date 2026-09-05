import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  Home, 
  Tv, 
  BookOpen,
  Film,
  Calendar, 
  Clock, 
  Star, 
  Heart, 
  Bookmark,
  History, 
  Settings, 
  Moon, 
  Sun,
  Shield,
  Gift,
  X,
  MessageSquare,
  Clapperboard,
  Upload
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { translateGenre } from '../types';

const logoImg = "https://files.catbox.moe/45hoi6.png";

interface SidebarProps {
  onClose?: () => void;
  onGenreSelect?: (genre: string) => void;
}

export default function Sidebar({ onClose, onGenreSelect }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const { t, getLocalizedPath } = useLanguage();
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved !== 'light';
  });

  useEffect(() => {
    // Initial sync
    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }

    const handleGlobalThemeChange = () => {
      const savedTheme = localStorage.getItem('theme');
      setDarkMode(savedTheme !== 'light');
    };

    window.addEventListener('theme-changed', handleGlobalThemeChange);
    return () => window.removeEventListener('theme-changed', handleGlobalThemeChange);
  }, []);

  const toggleDarkMode = () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    const themeKey = newValue ? 'dark' : 'light';
    localStorage.setItem('theme', themeKey);
    if (themeKey === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    window.dispatchEvent(new Event('theme-changed'));
  };

  const menuItems = [
    { name: t.navHome, path: '/', icon: Home },
    { name: t.navAnimes, path: '/animelar', icon: Tv },
    { name: t.navManga, path: '/manga', icon: BookOpen },
    { name: t.navDramas, path: '/dramalar', icon: Film },
    { name: t.navReels, path: '/reels', icon: Clapperboard },
    { name: t.navUpload, path: '/upload', icon: Upload },
    { name: t.navDonat, path: '/donat', icon: Gift },
    { name: t.navSchedule, path: '/jadval', icon: Calendar },
    { name: t.navNewReleases, path: '/yangi-chiqishlar', icon: Clock },
    { name: t.navTop100, path: '/top100', icon: Star },
    { name: t.navMyList, path: '/shaxsiy-royxat', icon: Bookmark },
    { name: t.navFavorites, path: '/sevimlilar', icon: Heart },
    { name: t.navHistory, path: '/tarix', icon: History },
    { name: t.navChat, path: '/chat', icon: MessageSquare },
    { name: t.navSettings, path: '/sozlamalar', icon: Settings },
  ];

  const categories = [
    'Action',
    'Adventure',
    'Comedy',
    'Drama',
    'Fantasy',
    'Horror',
    'Romance',
    'Sci-Fi',
    'Slice of Life',
    'Supernatural',
  ];

  // Helper to check if item is active regardless of language prefix
  const isItemActive = (rawPath: string) => {
    const current = location.pathname.replace(/^\/(uz|ru|ing|en)(\/|$)/, '/');
    const normalizedCurrent = current.endsWith('/') && current.length > 1 ? current.slice(0, -1) : current;
    const normalizedTarget = rawPath.endsWith('/') && rawPath.length > 1 ? rawPath.slice(0, -1) : rawPath;
    return normalizedCurrent === normalizedTarget;
  };

  return (
    <div className="w-full h-full flex flex-col text-white select-none">
      {/* Brand Logo */}
      <div className="relative h-44 flex items-center justify-center px-3 border-b border-[#1a1a1a]">
        <Link to={getLocalizedPath('/')} onClick={onClose} className="flex items-center justify-center w-full group py-1">
          <img 
            src={logoImg} 
            alt="AnimeUz" 
            className="h-[145px] w-full max-w-[240px] object-contain transition-transform group-hover:scale-105 drop-shadow-xl" 
          />
        </Link>
        {onClose && (
          <button 
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 text-white/50 hover:text-white hover:bg-[#1a1a1a] rounded-sm transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Scrollable Navigation */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-4 px-4 space-y-6">
        {/* Main Menu */}
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item.path);
            return (
              <Link
                key={item.name}
                to={getLocalizedPath(item.path)}
                onClick={onClose}
                className={`flex items-center space-x-3.5 px-4 py-3 rounded-sm text-sm font-bold transition-all ${
                  active 
                    ? 'bg-[#ff006a] text-white shadow-[0_0_15px_rgba(255,0,106,0.2)]' 
                    : 'text-white/50 hover:bg-[#1a1a1a] hover:text-white'
                }`}
              >
                <Icon size={18} className={active ? 'text-white' : 'text-white/50'} />
                <span>{item.name}</span>
              </Link>
            );
          })}

          {user && user.role === 'admin' && (
            <Link
              to={getLocalizedPath('/admin')}
              onClick={onClose}
              className={`flex items-center space-x-3.5 px-4 py-3 rounded-sm text-sm font-bold transition-all ${
                isItemActive('/admin')
                  ? 'bg-red-600 text-white'
                  : 'text-white/50 hover:bg-red-950/20 hover:text-red-400'
              }`}
            >
              <Shield size={18} />
              <span>Control Panel</span>
            </Link>
          )}
        </div>

        {/* Categories Section */}
        <div>
          <h4 className="px-4 text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">
            {t.categories}
          </h4>
          <div className="space-y-0.5">
            {categories.map((genre) => (
              <Link
                key={genre}
                to={`${getLocalizedPath('/animelar')}?genre=${genre}`}
                onClick={() => {
                  if (onGenreSelect) onGenreSelect(genre);
                  if (onClose) onClose();
                }}
                className="flex items-center px-4 py-2 text-xs font-bold text-white/50 hover:text-white hover:bg-[#111] rounded-sm transition-colors"
              >
                <span className="mr-2 text-[#ff006a]/50 group-hover:text-[#ff006a] font-mono">&gt;</span>
                {translateGenre(genre)}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Mode Switch & Info */}
      <div className="p-4 border-t border-[#1a1a1a] bg-[#0c0c0e] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button 
            onClick={toggleDarkMode}
            className="p-2 hover:bg-[#1a1a1a] rounded text-white/50 hover:text-white transition-all cursor-pointer"
            title={darkMode ? "Kungi rejim" : "Tungi rejim"}
          >
            {darkMode ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
        <div className="text-[10px] text-white/20 font-bold tracking-wider font-mono uppercase">
          ANIMEUZ v1.2
        </div>
      </div>
    </div>
  );
}
