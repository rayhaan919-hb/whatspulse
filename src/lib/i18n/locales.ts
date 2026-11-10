// Internationalization (i18n) Locale Definitions & Metadata
// Supports English (LTR) and Arabic (RTL) out of the box with logical CSS property integration.

export type Locale = 'en' | 'ar';
export type Direction = 'ltr' | 'rtl';

export interface LocaleMetadata {
  code: Locale;
  name: string;
  nativeName: string;
  dir: Direction;
  flag: string;
}

export const LOCALES: Record<Locale, LocaleMetadata> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    dir: 'ltr',
    flag: '🇺🇸',
  },
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    dir: 'rtl',
    flag: '🇸🇦',
  },
};

export const DEFAULT_LOCALE: Locale = 'en';
