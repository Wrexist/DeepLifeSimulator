// Optional dependencies - handle gracefully if not available
let I18n: any = null;
let Localization: any = null;

try {
  I18n = require('i18n-js').I18n;
} catch (error) {
  // i18n-js not available, will use fallback
}

try {
  Localization = require('expo-localization');
} catch (error) {
  // expo-localization not available, will use fallback
}

// Supported languages (top 20 countries from the plan)
export const SUPPORTED_LANGUAGES = {
  en: 'English',
  es: 'Spanish',
  zh: 'Chinese (Simplified)',
  ja: 'Japanese',
  de: 'German',
  fr: 'French',
  pt: 'Portuguese',
  ru: 'Russian',
  ko: 'Korean',
  it: 'Italian',
  ar: 'Arabic',
  hi: 'Hindi',
  tr: 'Turkish',
  pl: 'Polish',
  nl: 'Dutch',
  th: 'Thai',
  vi: 'Vietnamese',
  id: 'Indonesian',
  sv: 'Swedish',
  cs: 'Czech',
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// RTL languages (hebrew 'he' not in supported languages, using 'ar' only)
export const RTL_LANGUAGES: SupportedLanguage[] = ['ar'];

/**
 * Check if a language is RTL
 */
export function isRTL(language: SupportedLanguage): boolean {
  return RTL_LANGUAGES.includes(language);
}

/**
 * Get device language
 */
export function getDeviceLanguage(): SupportedLanguage {
  if (!Localization) return 'en';
  const deviceLocale = Localization.locale?.split('-')[0] as SupportedLanguage;
  return SUPPORTED_LANGUAGES[deviceLocale] ? deviceLocale : 'en';
}

/**
 * Initialize i18n instance
 */
export function initializeI18n(translations: Record<string, any>): any {
  if (!I18n) {
    // Fallback if i18n-js is not available
    return {
      t: (key: string) => key,
      locale: 'en',
    };
  }
  const i18n = new I18n(translations);
  i18n.enableFallback = true;
  i18n.defaultLocale = 'en';
  i18n.locale = getDeviceLanguage();
  return i18n;
}

/**
 * Format currency based on locale
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale?: SupportedLanguage
): string {
  const localeString = locale ? `${locale}-${locale.toUpperCase()}` : (Localization?.locale || 'en-US');
  
  try {
    return new Intl.NumberFormat(localeString, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    // Fallback to simple formatting
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/**
 * Format date based on locale
 */
export function formatDate(
  date: Date,
  locale?: SupportedLanguage
): string {
  const localeString = locale ? `${locale}-${locale.toUpperCase()}` : (Localization?.locale || 'en-US');
  
  try {
    return new Intl.DateTimeFormat(localeString, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch (error) {
    // Fallback to ISO string
    return date.toISOString().split('T')[0];
  }
}

/**
 * Format number based on locale
 */
export function formatNumber(
  number: number,
  locale?: SupportedLanguage,
  options?: Intl.NumberFormatOptions
): string {
  const localeString = locale ? `${locale}-${locale.toUpperCase()}` : (Localization?.locale || 'en-US');
  
  try {
    return new Intl.NumberFormat(localeString, options).format(number);
  } catch (error) {
    // Fallback to simple formatting
    return number.toLocaleString();
  }
}

