// Type-safe Internationalization Service for WhatsPulse CRM
// Provides high-performance string lookup, placeholder interpolation, and RTL direction handling.

import type { Locale, Direction, LocaleMetadata } from './locales.ts';
import { LOCALES, DEFAULT_LOCALE } from './locales.ts';
import { en } from './translations/en.ts';
import { ar } from './translations/ar.ts';

const TRANSLATIONS: Record<Locale, Record<string, string>> = {
  en,
  ar,
};

export class I18nService {
  /**
   * Resolves a translated string by key with variable interpolation and fallback to English.
   */
  public static translate(
    key: string,
    locale: Locale = DEFAULT_LOCALE,
    params?: Record<string, string | number>
  ): string {
    const localeDict = TRANSLATIONS[locale] || TRANSLATIONS[DEFAULT_LOCALE];
    let template = localeDict[key];

    // Fallback to English if missing in target locale
    if (!template && locale !== DEFAULT_LOCALE) {
      template = TRANSLATIONS[DEFAULT_LOCALE][key];
    }

    // Fallback to raw key if missing in all dictionaries
    if (!template) {
      return key;
    }

    // Interpolate variables: {{key}}
    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        template = template.replace(
          new RegExp(`\\{\\{${paramKey}\\}\\}`, 'g'),
          String(paramValue)
        );
      });
    }

    return template;
  }

  /**
   * Returns the writing direction for the given locale ('ltr' or 'rtl')
   */
  public static getDirection(locale: Locale = DEFAULT_LOCALE): Direction {
    return LOCALES[locale]?.dir || 'ltr';
  }

  /**
   * Returns all supported locale metadata entries
   */
  public static getAvailableLocales(): LocaleMetadata[] {
    return Object.values(LOCALES);
  }

  /**
   * Validates whether a string is a supported locale code
   */
  public static isSupportedLocale(code: string): code is Locale {
    return code in LOCALES;
  }
}
