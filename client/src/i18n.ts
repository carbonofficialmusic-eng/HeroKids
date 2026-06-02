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

const resources = {
  en: { translation: translationEN },
  de: { translation: translationDE },
  fr: { translation: translationFR },
  es: { translation: translationES },
  ja: { translation: translationJA },
  zh: { translation: translationZH },
  ko: { translation: translationKO },
  sv: { translation: translationSV },
};

const SUPPORTED = ['en', 'de', 'fr', 'es', 'ja', 'zh', 'ko', 'sv'];
const STORAGE_KEY = 'herokids_lang';

function detectLanguage(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED.includes(stored)) return stored;

  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  for (const raw of candidates) {
    const code = raw.split('-')[0].toLowerCase();
    if (SUPPORTED.includes(code)) return code;
  }
  return 'de';
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: detectLanguage(),
    fallbackLng: 'de',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

i18n.on('languageChanged', (lng) => {
  if (SUPPORTED.includes(lng)) {
    localStorage.setItem(STORAGE_KEY, lng);
  }
});

export default i18n;
