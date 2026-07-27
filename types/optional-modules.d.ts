// Type declarations for optional dependencies
// These modules may not be installed, so we declare them as optional

// CRITICAL: AdMob type declarations COMMENTED OUT
// AdMob native module causes TurboModule crashes - completely disabled
// DO NOT UNCOMMENT until AdMob native crash is resolved
/*
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
*/

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

/**
 * `react-test-renderer` ships no types and `@types/react-test-renderer` is not
 * installed, so importing it is an implicit-any error under `noImplicitAny`.
 *
 * Declared here rather than added as a dependency: React 19 deprecates this
 * renderer, so pulling in types for it would be committing to a package the
 * ecosystem is moving off. Only `create` is used, by the morph-slider
 * accessibility test, and it is used for its tree output alone.
 */
declare module 'react-test-renderer' {
  export interface ReactTestInstance {
    props: Record<string, unknown>;
    type: unknown;
    children: (ReactTestInstance | string)[];
    findAll(predicate: (node: ReactTestInstance) => boolean): ReactTestInstance[];
    find(predicate: (node: ReactTestInstance) => boolean): ReactTestInstance;
  }
  export interface ReactTestRenderer {
    root: ReactTestInstance;
    toJSON(): unknown;
    unmount(): void;
  }
  export function create(element: unknown): ReactTestRenderer;
  export function act(callback: () => void | Promise<void>): Promise<void>;
}
