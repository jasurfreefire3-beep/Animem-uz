import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Language, translations, Translations, translateGenre, translateStatus } from '../i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language, updateUrl?: boolean) => void;
  t: Translations;
  translateGenre: (genre: string) => string;
  translateStatus: (status: string) => string;
  getLocalizedPath: (path: string, lang?: Language) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'animem_lang';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Detect language from URL path first (/uz, /ru, /ing, /en), or fallback to localStorage, or 'uz'
  const detectLangFromUrl = useCallback((): Language | null => {
    const pathname = location.pathname;
    const match = pathname.match(/^\/(uz|ru|ing|en)(\/|$)/);
    if (match) {
      const code = match[1];
      if (code === 'en') return 'ing';
      return code as Language;
    }
    return null;
  }, [location.pathname]);

  const [language, setLanguageState] = useState<Language>(() => {
    const fromUrl = detectLangFromUrl();
    if (fromUrl) return fromUrl;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'uz' || saved === 'ru' || saved === 'ing') {
        return saved;
      }
      if (saved === 'en') return 'ing';
      // Also check old string names
      if (saved === 'Русский') return 'ru';
      if (saved === 'English') return 'ing';
    } catch (e) {}
    return 'uz';
  });

  // Sync language with URL when route changes
  useEffect(() => {
    const fromUrl = detectLangFromUrl();
    if (fromUrl && fromUrl !== language) {
      setLanguageState(fromUrl);
      try {
        localStorage.setItem(STORAGE_KEY, fromUrl);
      } catch (e) {}
    }
  }, [location.pathname, detectLangFromUrl, language]);

  // Set document lang attribute
  useEffect(() => {
    document.documentElement.lang = language === 'ing' ? 'en' : language;
  }, [language]);

  const setLanguage = (newLang: Language, updateUrl: boolean = true) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      localStorage.setItem('anime_settings_lang', newLang === 'uz' ? "O'zbekcha" : newLang === 'ru' ? "Русский" : "English");
    } catch (e) {}

    if (updateUrl) {
      // If current path starts with /uz, /ru, /ing, /en, replace prefix
      const pathname = location.pathname;
      const cleanPath = pathname.replace(/^\/(uz|ru|ing|en)(\/|$)/, '/');
      const targetPath = newLang === 'uz' ? cleanPath : `/${newLang}${cleanPath === '/' ? '' : cleanPath}`;
      navigate(targetPath + location.search + location.hash, { replace: true });
    }
  };

  const getLocalizedPath = (path: string, customLang?: Language): string => {
    const targetLang = customLang || language;
    const cleanPath = path.replace(/^\/(uz|ru|ing|en)(\/|$)/, '/');
    if (targetLang === 'uz') {
      return cleanPath;
    }
    return `/${targetLang}${cleanPath === '/' ? '' : cleanPath}`;
  };

  const currentTranslations = translations[language] || translations.uz;

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t: currentTranslations,
        translateGenre: (genre: string) => translateGenre(genre, language),
        translateStatus: (status: string) => translateStatus(status, language),
        getLocalizedPath,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
