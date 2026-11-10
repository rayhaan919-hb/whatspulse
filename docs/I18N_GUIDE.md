# Internationalization (i18n) & RTL Developer Guide

WhatsPulse CRM includes a high-performance, type-safe internationalization (i18n) engine with native support for both **Left-to-Right (LTR)** and **Right-to-Left (RTL)** languages (English and Arabic out of the box).

---

## 1. Architectural Principles

1. **Logical CSS Properties:**
   Layout positioning never relies on physical `left`/`right` properties. Always use CSS logical properties supported natively by Tailwind CSS:
   - Margin: `ms-` (margin-inline-start) and `me-` (margin-inline-end) instead of `ml-`/`mr-`.
   - Padding: `ps-` (padding-inline-start) and `pe-` (padding-inline-end) instead of `pl-`/`pr-`.
   - Borders: `border-s-` and `border-e-` instead of `border-l-`/`border-r-`.
   - Alignment: `text-start` and `text-end` instead of `text-left`/`text-right`.
   - Positioning: `start-` and `end-` instead of `left-`/`right-`.

2. **Automatic HTML Direction Switching:**
   When the user switches languages, the `I18nProvider` automatically updates the document root attributes:
   ```html
   <html lang="ar" dir="rtl">
   ```
   This ensures browser scrollbars, form controls, and bidirectional text rendering automatically conform to the selected language.

3. **Fallback Safety:**
   If a translation key is missing in a secondary language dictionary, the engine automatically falls back to English without crashing or throwing errors.

---

## 2. Adding a New Language in 3 Steps

Adding support for a new language (e.g. Spanish `es`, French `fr`, German `de`, or Hebrew `he`) takes under 3 minutes:

### Step 1: Register the Locale in `src/lib/i18n/locales.ts`
Add the locale code to the `Locale` union type and register its metadata:

```typescript
export type Locale = 'en' | 'ar' | 'es';

export const LOCALES: Record<Locale, LocaleMetadata> = {
  en: { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr', flag: '🇺🇸' },
  ar: { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl', flag: '🇸🇦' },
  es: { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr', flag: '🇪🇸' },
};
```

### Step 2: Create the Translation Dictionary
Create a new file `src/lib/i18n/translations/es.ts` and translate the key strings:

```typescript
// Spanish (es) Translation Dictionary
export const es: Record<string, string> = {
  'common.save': 'Guardar',
  'common.cancel': 'Cancelar',
  'navbar.brand': 'WhatsPulse CRM',
  'inbox.conversations': 'Conversaciones',
  'inbox.selectedCount': '{{count}} seleccionadas',
  'chat.send': 'Enviar',
  // ... copy keys from en.ts
};
```

### Step 3: Register in `src/lib/i18n/i18n-service.ts`
Import your dictionary and include it in `TRANSLATIONS`:

```typescript
import { es } from './translations/es.ts';

const TRANSLATIONS: Record<Locale, Record<string, string>> = {
  en,
  ar,
  es,
};
```

That's it! The new language will immediately appear in the Navbar language switcher and be available across all components.

---

## 3. How to Use Translations in Components

Import the `useI18n` hook:

```tsx
'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n/context';

export function MyComponent() {
  const { t, locale, dir, setLocale } = useI18n();

  return (
    <div className="p-4 text-start">
      <h2>{t('inbox.conversations')}</h2>
      <p>{t('inbox.selectedCount', { count: 5 })}</p>
      
      <button 
        type="button" 
        onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
        className="editorial-btn-primary"
      >
        {t('navbar.switchLanguage')}
      </button>
    </div>
  );
}
```

---

## 4. Accessibility & Quality Checklist

When externalizing strings and building UI components:
- [x] Every icon-only button must have an explicit `aria-label={t('...')}`.
- [x] Interactive dialogs must have `role="dialog"`, `aria-modal="true"`, and `aria-label`.
- [x] All dialogs and popovers must close on the `Escape` key.
- [x] Focus indicators must have high contrast (`focus-visible:ring-2 focus-visible:ring-[#3139fb]`).
