'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Locale, Direction, LocaleMetadata } from './locales.ts';
import { DEFAULT_LOCALE } from './locales.ts';
import { I18nService } from './i18n-service.ts';

interface I18nContextValue {
  locale: Locale;
  dir: Direction;
  setLocale: (newLocale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  availableLocales: LocaleMetadata[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === 'undefined') return DEFAULT_LOCALE;
    try {
      const saved = localStorage.getItem('whatspulse_locale');
      if (saved && I18nService.isSupportedLocale(saved)) {
        return saved;
      }

      // Check browser navigator language
      const browserLang = navigator.language?.split('-')[0];
      if (browserLang && I18nService.isSupportedLocale(browserLang)) {
        return browserLang;
      }
    } catch {
      // Ignore localStorage restrictions
    }
    return DEFAULT_LOCALE;
  });

  const dir = useMemo(() => I18nService.getDirection(locale), [locale]);

  // Synchronize document attributes for CSS logical properties
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.documentElement.dir = dir;
    }
  }, [locale, dir]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem('whatspulse_locale', newLocale);
    } catch {
      // Ignore localStorage restrictions
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return I18nService.translate(key, locale, params);
    },
    [locale]
  );

  const availableLocales = useMemo(() => I18nService.getAvailableLocales(), []);

  const contextValue = useMemo<I18nContextValue>(
    () => ({
      locale,
      dir,
      setLocale,
      t,
      availableLocales,
    }),
    [locale, dir, setLocale, t, availableLocales]
  );

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      locale: DEFAULT_LOCALE,
      dir: 'ltr',
      setLocale: () => {},
      t: (key: string, params?: Record<string, string | number>) =>
        I18nService.translate(key, DEFAULT_LOCALE, params),
      availableLocales: I18nService.getAvailableLocales(),
    };
  }
  return context;
}
