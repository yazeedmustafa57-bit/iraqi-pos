import { I18nManager } from 'react-native';
import { translations } from './translations';
import { Language } from '../types';

let currentLanguage: Language = 'ar';

export function setLanguage(lang: Language) {
  currentLanguage = lang;
  const shouldRTL = lang === 'ar' || lang === 'ku';
  // German is LTR like English
  if (I18nManager.isRTL !== shouldRTL) {
    I18nManager.forceRTL(shouldRTL);
    I18nManager.allowRTL(shouldRTL);
  }
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function t(key: string): string {
  return translations[currentLanguage]?.[key] ?? key;
}

export function formatIQD(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = rounded
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formatted} د.ع`;
}
