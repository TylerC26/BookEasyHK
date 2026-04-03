'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import translations, { type Locale, type TranslationKey } from './translations';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({
  children,
  defaultLocale = 'zh-HK',
}: {
  children: React.ReactNode;
  defaultLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    const saved = localStorage.getItem('bookeasyhk-locale') as Locale | null;
    if (saved && (saved === 'zh-HK' || saved === 'en')) {
      setLocaleState(saved);
    } else {
      const browserLang = navigator.language;
      if (browserLang.startsWith('zh')) {
        setLocaleState('zh-HK');
      } else {
        setLocaleState('en');
      }
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('bookeasyhk-locale', newLocale);
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[locale][key] || translations['en'][key] || key;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
