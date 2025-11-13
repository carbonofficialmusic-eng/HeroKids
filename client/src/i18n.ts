import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import translationEN from './locales/en/translation.json';
import translationDE from './locales/de/translation.json';
import translationFR from './locales/fr/translation.json';
import translationES from './locales/es/translation.json';
import translationJA from './locales/ja/translation.json';
import translationZH from './locales/zh/translation.json';
import translationKO from './locales/ko/translation.json';

const resources = {
  en: {
    translation: translationEN
  },
  de: {
    translation: translationDE
  },
  fr: {
    translation: translationFR
  },
  es: {
    translation: translationES
  },
  ja: {
    translation: translationJA
  },
  zh: {
    translation: translationZH
  },
  ko: {
    translation: translationKO
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });

export default i18n;
