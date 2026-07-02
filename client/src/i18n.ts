import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import translationEN from './locales/en/translation.json';
import translationDE from './locales/de/translation.json';
import translationFR from './locales/fr/translation.json';
import translationES from './locales/es/translation.json';
import translationJA from './locales/ja/translation.json';
import translationZH from './locales/zh/translation.json';
import translationKO from './locales/ko/translation.json';
import translationSV from './locales/sv/translation.json';
import translationPT from './locales/pt/translation.json';

const resources = {
  en: { translation: translationEN },
  de: { translation: translationDE },
  fr: { translation: translationFR },
  es: { translation: translationES },
  ja: { translation: translationJA },
  zh: { translation: translationZH },
  ko: { translation: translationKO },
  sv: { translation: translationSV },
  pt: { translation: translationPT },
};

const SUPPORTED = ['en', 'de', 'fr', 'es', 'ja', 'zh', 'ko', 'sv', 'pt'];

// Separate key for *explicit* user choice (set only via Settings page).
// The old key 'herokids_lang' was also written by the family-language sync,
// which could override browser detection with the family's app language.
// Using a new key means those stale values are ignored automatically.
export const LANG_USER_KEY = 'herokids_lang_user';

function detectLanguage(): string {
  // Only trust an explicit user choice, not auto-set values.
  const explicit = localStorage.getItem(LANG_USER_KEY);
  if (explicit && SUPPORTED.includes(explicit)) return explicit;

  // Fall back to browser language.
  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  for (const raw of candidates) {
    const code = raw.split('-')[0].toLowerCase();
    if (SUPPORTED.includes(code)) return code;
  }
  return 'en';
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: detectLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

export default i18n;
