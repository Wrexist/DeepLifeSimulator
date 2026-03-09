/**
 * AdMob Service — Error-Isolated Implementation
 *
 * Uses lazy-loading of the native module to prevent TurboModule crashes.
 * All ad operations are wrapped in try/catch with a circuit breaker:
 * after MAX_CONSECUTIVE_FAILURES failures the service disables itself for
 * the remainder of the session so a broken ad SDK can never crash the app.
 *
 * To configure for production:
 * 1. Replace the test ad unit IDs in AD_UNITS below with your real AdMob IDs
 * 2. Set your App IDs in app.config.js react-native-google-mobile-ads plugin
 * 3. Run `npx expo prebuild` to regenerate native projects
 */

import { Platform } from 'react-native';
import { logger } from '@/utils/logger';

const log = logger.scope('AdMob');

// ---------------------------------------------------------------------------
// Lazy-loaded native modules — never require at module load time
// ---------------------------------------------------------------------------
let mobileAds: any = null;
let NativeInterstitialAd: any = null;
let NativeRewardedAd: any = null;
let NativeAdEventType: any = null;
let NativeRewardedAdEventType: any = null;
let NativeBannerAd: any = null;
let NativeBannerAdSize: any = null;
let NativeTestIds: any = null;

let moduleLoaded = false;
let moduleLoadAttempted = false;

function loadModule(): boolean {
  if (moduleLoaded) return true;
  if (moduleLoadAttempted) return false;
  moduleLoadAttempted = true;

  if (Platform.OS === 'web') return false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-google-mobile-ads');
    mobileAds = mod.default;
    NativeInterstitialAd = mod.InterstitialAd;
    NativeRewardedAd = mod.RewardedAd;
    NativeAdEventType = mod.AdEventType;
    NativeRewardedAdEventType = mod.RewardedAdEventType;
    NativeBannerAd = mod.BannerAd;
    NativeBannerAdSize = mod.BannerAdSize;
    NativeTestIds = mod.TestIds;
    moduleLoaded = true;
    return true;
  } catch (error: any) {
    log.warn('react-native-google-mobile-ads not available:', error?.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Circuit breaker — disables ads after repeated failures
// ---------------------------------------------------------------------------
const MAX_CONSECUTIVE_FAILURES = 3;
let failureCount = 0;
let circuitOpen = false;

// D-1: Auto-recovery timer resets circuit after 5 minutes
const CIRCUIT_RECOVERY_MS = 5 * 60 * 1000;
let circuitRecoveryTimer: ReturnType<typeof setTimeout> | null = null;

function recordFailure() {
  failureCount++;
  if (failureCount >= MAX_CONSECUTIVE_FAILURES) {
    circuitOpen = true;
    log.warn('Circuit breaker tripped — ads disabled temporarily');
    // D-1: Schedule auto-recovery instead of permanent disable
    if (!circuitRecoveryTimer) {
      circuitRecoveryTimer = setTimeout(() => {
        circuitOpen = false;
        failureCount = 0;
        circuitRecoveryTimer = null;
        log.info('Circuit breaker auto-recovered — ads re-enabled');
      }, CIRCUIT_RECOVERY_MS);
    }
  }
}

function recordSuccess() {
  failureCount = 0;
  // Cancel recovery timer on success
  if (circuitRecoveryTimer) {
    clearTimeout(circuitRecoveryTimer);
    circuitRecoveryTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Ad unit IDs — loaded from env vars, falls back to Google test IDs in dev
// ---------------------------------------------------------------------------
const TEST_BANNER_IOS = 'ca-app-pub-3940256099942544/2934735716';
const TEST_BANNER_ANDROID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_INTERSTITIAL_IOS = 'ca-app-pub-3940256099942544/4411468910';
const TEST_INTERSTITIAL_ANDROID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_REWARDED_IOS = 'ca-app-pub-3940256099942544/1712485313';
const TEST_REWARDED_ANDROID = 'ca-app-pub-3940256099942544/5224354917';

const AD_UNITS = {
  BANNER: Platform.select({
    ios: process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS || TEST_BANNER_IOS,
    android: process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID || TEST_BANNER_ANDROID,
  }) || '',
  INTERSTITIAL: Platform.select({
    ios: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS || TEST_INTERSTITIAL_IOS,
    android: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID || TEST_INTERSTITIAL_ANDROID,
  }) || '',
  REWARDED: Platform.select({
    ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS || TEST_REWARDED_IOS,
    android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID || TEST_REWARDED_ANDROID,
  }) || '',
};

// ---------------------------------------------------------------------------
// Public state type
// ---------------------------------------------------------------------------
export interface AdMobState {
  isLoading: boolean;
  isInitialized: boolean;
  isInterstitialLoaded: boolean;
  isRewardedLoaded: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Service implementation
// ---------------------------------------------------------------------------
class AdMobServiceImpl {
  private state: AdMobState = {
    isLoading: false,
    isInitialized: false,
    isInterstitialLoaded: false,
    isRewardedLoaded: false,
    error: null,
  };

  private listeners: Array<(state: AdMobState) => void> = [];
  private interstitial: any = null;
  private rewarded: any = null;

  // --- Listener management ---

  addListener(listener: (state: AdMobState) => void) {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getState(): AdMobState {
    return { ...this.state };
  }

  private setState(updates: Partial<AdMobState>) {
    this.state = { ...this.state, ...updates };
    for (const l of this.listeners) {
      try { l(this.getState()); } catch (_) { /* never crash on listener error */ }
    }
  }

  // --- Initialization ---

  async initialize(): Promise<void> {
    if (circuitOpen || this.state.isInitialized) return;

    if (!loadModule() || !mobileAds) {
      this.setState({ error: 'Ad module not available' });
      return;
    }

    try {
      this.setState({ isLoading: true });
      await mobileAds().initialize();
      this.setState({ isInitialized: true, isLoading: false, error: null });
      recordSuccess();
      log.info('Initialized successfully');

      // Pre-load ads in background
      void this.loadInterstitialAd();
      void this.loadRewardedAd();
    } catch (error: any) {
      recordFailure();
      log.error('Initialization failed:', error?.message);
      this.setState({ isLoading: false, error: error?.message || 'Init failed' });
    }
  }

  // --- Interstitial ---

  async loadInterstitialAd(): Promise<void> {
    if (circuitOpen || !this.state.isInitialized || !NativeInterstitialAd || !NativeAdEventType) return;

    try {
      const adUnitId = __DEV__ && NativeTestIds ? NativeTestIds.INTERSTITIAL : AD_UNITS.INTERSTITIAL;
      this.interstitial = NativeInterstitialAd.createForAdRequest(adUnitId);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Load timeout')), 15000);

        const unsubLoaded = this.interstitial.addAdEventListener(NativeAdEventType.LOADED, () => {
          clearTimeout(timeout);
          unsubLoaded();
          unsubError();
          this.setState({ isInterstitialLoaded: true });
          recordSuccess();
          resolve();
        });

        const unsubError = this.interstitial.addAdEventListener(NativeAdEventType.ERROR, (err: any) => {
          clearTimeout(timeout);
          unsubLoaded();
          unsubError();
          reject(err);
        });

        this.interstitial.load();
      });
    } catch (error: any) {
      recordFailure();
      log.warn('Interstitial load failed:', error?.message);
      this.setState({ isInterstitialLoaded: false });
    }
  }

  async showInterstitialAd(): Promise<boolean> {
    if (circuitOpen || !this.state.isInterstitialLoaded || !this.interstitial) return false;

    try {
      await this.interstitial.show();
      this.setState({ isInterstitialLoaded: false });
      recordSuccess();
      // Pre-load next one
      void this.loadInterstitialAd();
      return true;
    } catch (error: any) {
      recordFailure();
      log.warn('Interstitial show failed:', error?.message);
      this.setState({ isInterstitialLoaded: false });
      return false;
    }
  }

  // --- Rewarded ---

  async loadRewardedAd(): Promise<void> {
    if (circuitOpen || !this.state.isInitialized || !NativeRewardedAd) return;

    try {
      const adUnitId = __DEV__ && NativeTestIds ? NativeTestIds.REWARDED : AD_UNITS.REWARDED;
      this.rewarded = NativeRewardedAd.createForAdRequest(adUnitId);

      // Determine the correct event type constants — RewardedAd may use its own enum
      const loadedEvent = NativeRewardedAdEventType?.LOADED || NativeAdEventType?.LOADED;
      const errorEvent = NativeAdEventType?.ERROR;

      if (!loadedEvent || !errorEvent) {
        log.warn('Ad event types not available');
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Load timeout')), 15000);

        const unsubLoaded = this.rewarded.addAdEventListener(loadedEvent, () => {
          clearTimeout(timeout);
          unsubLoaded();
          unsubError();
          this.setState({ isRewardedLoaded: true });
          recordSuccess();
          resolve();
        });

        const unsubError = this.rewarded.addAdEventListener(errorEvent, (err: any) => {
          clearTimeout(timeout);
          unsubLoaded();
          unsubError();
          reject(err);
        });

        this.rewarded.load();
      });
    } catch (error: any) {
      recordFailure();
      log.warn('Rewarded ad load failed:', error?.message);
      this.setState({ isRewardedLoaded: false });
    }
  }

  async showRewardedAd(onReward: () => void): Promise<boolean> {
    if (circuitOpen || !this.state.isRewardedLoaded || !this.rewarded) return false;

    try {
      let rewarded = false;

      const rewardEvent = NativeRewardedAdEventType?.EARNED_REWARD;
      let unsubReward: (() => void) | undefined;
      if (rewardEvent) {
        unsubReward = this.rewarded.addAdEventListener(rewardEvent, () => {
          rewarded = true;
        });
      }

      await this.rewarded.show();
      unsubReward?.();
      this.setState({ isRewardedLoaded: false });
      recordSuccess();

      if (rewarded) {
        try { onReward(); } catch (_) { /* never crash on reward callback error */ }
      }

      // Pre-load next one
      void this.loadRewardedAd();
      return rewarded;
    } catch (error: any) {
      recordFailure();
      log.warn('Rewarded show failed:', error?.message);
      this.setState({ isRewardedLoaded: false });
      return false;
    }
  }

  // --- Banner helpers (used by BannerAd component) ---

  /** Returns the native BannerAd React component, or null if unavailable */
  getNativeBannerAd(): any {
    return circuitOpen ? null : NativeBannerAd;
  }

  /** Returns the BannerAdSize constants, or null if unavailable */
  getBannerAdSize(): any {
    return circuitOpen ? null : NativeBannerAdSize;
  }

  /** Returns the banner ad unit ID for the current platform */
  getBannerAdUnitId(): string {
    if (circuitOpen) return '';
    if (__DEV__ && NativeTestIds) return NativeTestIds.BANNER;
    return AD_UNITS.BANNER;
  }

  /** Returns true if ads are available and not circuit-broken */
  isAvailable(): boolean {
    return !circuitOpen && moduleLoaded && this.state.isInitialized;
  }

  // --- Cleanup ---

  cleanup(): void {
    try {
      this.interstitial = null;
      this.rewarded = null;
      this.setState({ isInterstitialLoaded: false, isRewardedLoaded: false });
    } catch (_) {
      // Never crash on cleanup
    }
  }
}

export const adMobService = new AdMobServiceImpl();
