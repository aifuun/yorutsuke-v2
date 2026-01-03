// i18n configuration
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ja from './locales/ja.json';
import en from './locales/en.json';

// Language type
export type Language = 'ja' | 'en';

// Initialize i18next
i18n
  .use(initReactI18next)
  .init({
    resources: {
      ja: { translation: ja },
      en: { translation: en },
    },
    lng: 'en', // Default language
    fallbackLng: 'ja',
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

/**
 * Change language and persist to settings
 */
export function changeLanguage(lang: Language): void {
  i18n.changeLanguage(lang);
}

/**
 * Get current language
 */
export function getCurrentLanguage(): Language {
  return i18n.language as Language;
}

// Re-export useTranslation for convenience
export { useTranslation } from 'react-i18next';

export default i18n;
