import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import el from './el.json';
import en from './en.json';
import type { Locale } from '../types';

const STORAGE_KEY = 'fe.locale';
export const LOCALES: Locale[] = ['el', 'en'];

/** Greek is the default; English only when the user picked it on this phone. */
export function storedLocale(): Locale {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'el';
  } catch {
    return 'el';
  }
}

export function setLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* storage unavailable — keep in memory only */
  }
  document.documentElement.lang = locale;
  void i18n.changeLanguage(locale);
}

void i18n.use(initReactI18next).init({
  resources: { el: { translation: el }, en: { translation: en } },
  lng: storedLocale(),
  fallbackLng: 'el',
  interpolation: { escapeValue: false },
  returnNull: false,
});

document.documentElement.lang = storedLocale();

export const currentLocale = (): Locale => (i18n.language === 'en' ? 'en' : 'el');

export default i18n;
