// Type declarations for optional dependencies
// These modules may not be installed, so we declare them as optional

declare module 'react-native-google-mobile-ads' {
  export const BannerAd: any;
  export const InterstitialAd: any;
  export const RewardedAd: any;
  export const BannerAdSize: any;
  export const TestIds: any;
  export const AdEventType: any;
  export const RewardedAdEventType: any;
  const defaultExport: any;
  export default defaultExport;
}

declare module '@react-native-firebase/analytics' {
  const defaultExport: any;
  export default defaultExport;
}

declare module 'i18n-js' {
  export class I18n {
    constructor(translations?: any, options?: any);
    t(key: string, options?: any): string;
    locale: string;
    [key: string]: any;
  }
}

declare module 'expo-localization' {
  export const locale: string;
  export const locales: string[];
  export const timezone: string;
  export const isoCurrencyCodes: string[];
  export const region: string | null;
  export function getLocales(): {
    languageCode: string;
    scriptCode?: string;
    countryCode: string;
    languageTag: string;
    isRTL: boolean;
  }[];
  export function getCalendars(): string[];
  export function getCurrencies(): string[];
}

