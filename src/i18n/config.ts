import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationTH from './locales/th/translation.json';
import translationEN from './locales/en/translation.json';

// ทรัพยากรภาษา
const resources = {
  th: {
    translation: translationTH,
  },
  en: {
    translation: translationEN,
  },
};

// กำหนดค่า i18next
i18n
  .use(LanguageDetector) // ตรวจจับภาษาอัตโนมัติ
  .use(initReactI18next) // เชื่อมต่อกับ React
  .init({
    resources,
    fallbackLng: 'th', // ภาษาเริ่มต้น
    lng: 'th', // ภาษาเริ่มต้น
    
    // ตัวเลือกการตรวจจับภาษา
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },

    interpolation: {
      escapeValue: false, // React จัดการ XSS แล้ว
    },

    react: {
      useSuspense: false,
    },
  });

export default i18n;
