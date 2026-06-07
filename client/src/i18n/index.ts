// 54Bank i18n — 6 languages for pan-African market
import en from './en.json';
import fr from './fr.json';
import ar from './ar.json';
import ha from './ha.json';
import yo from './yo.json';
import sw from './sw.json';

export type Locale = 'en' | 'fr' | 'ar' | 'ha' | 'yo' | 'sw';
export const locales: Record<Locale, Record<string, string>> = { en, fr, ar, ha, yo, sw };

const DEFAULT_LOCALE: Locale = 'en';
let currentLocale: Locale = (localStorage.getItem('54bank_locale') as Locale) || DEFAULT_LOCALE;

export function t(key: string): string {
  return locales[currentLocale]?.[key] || locales[DEFAULT_LOCALE]?.[key] || key;
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  localStorage.setItem('54bank_locale', locale);
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = locale;
}

export function getLocale(): Locale { return currentLocale; }
export function isRTL(): boolean { return currentLocale === 'ar'; }
export function formatCurrency(amount: number, locale?: Locale): string {
  const l = locale || currentLocale;
  const currency = locales[l]?.currency || 'NGN';
  return new Intl.NumberFormat(l === 'ha' ? 'ha-NG' : l === 'yo' ? 'yo-NG' : l, {
    style: 'currency', currency, minimumFractionDigits: 2
  }).format(amount / 100); // kobo to naira
}
