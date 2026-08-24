/**
 * AdMob Service — Error-Isolated Implementation
 *
 * Uses lazy-loading of the native module to prevent TurboModule crashes.
 * All ad operations are wrapped in try/catch with a circuit breaker:
 * after MAX_CONSECUTIVE_FAILURES failures the service disables itself for
 * the remainder of the session so a broken ad SDK can never crash the app.
 *
 * Production config (already wired — this is reference, not a TODO):
 *  - `resolveAdUnitId()` returns real ad-unit IDs in release builds and Google
 *    TEST IDs only under `__DEV__`, so test ads can never reach production.
 *  - App IDs come from app.config.js (`admobIosAppId` / `admobAndroidAppId`),
 *    overridable via EXPO_PUBLIC_ADMOB_{IOS,ANDROID}_APP_ID.
 */

import { Platform } from 'react-native';
import { logger } from '@/utils/logger';
import { isTrackingAllowed } from '@/utils/trackingTransparency';
import { track } from '@/lib/analytics';
import { revenueCatService } from '@/services/RevenueCatService';
import {
  RC_MEDIATOR_ADMOB,
  buildAdRevenuePayload,
  newImpressionId,
  type AdMobPaidEvent,
  type RcAdFormat,
} from '@/lib/ads/adRevenueTracking';

const log = logger.scope('AdMob');

/** Narrow an unknown thrown value to a log-friendly message. */
function errMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The only surface of an AdMob ad object the revenue listener needs. Structural
 * rather than `any` so a rename in the ad SDK fails the type-check here instead
 * of silently detaching revenue reporting.
 */
interface PaidCapableAd {
  addAdEventListener?: (
    type: string,
    listener: (event: AdMobPaidEvent) => void,
  ) => (() => void) | void;
}

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
// AdMob's numeric precision enum, forwarded to the RevenueCat precision mapper
// so it never has to hardcode an ordinal the SDK could renumber.
let NativeRevenuePrecisions: any = null;

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
    NativeRevenuePrecisions = mod.RevenuePrecisions ?? null;
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
    log.warn('Circuit breaker tripped - ads disabled temporarily');
    // D-1: Schedule auto-recovery instead of permanent disable
    if (!circuitRecoveryTimer) {
      circuitRecoveryTimer = setTimeout(() => {
        circuitOpen = false;
        failureCount = 0;
        circuitRecoveryTimer = null;
        log.info('Circuit breaker auto-recovered - ads re-enabled');
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
// Ad unit IDs — resolved with a three-tier priority (see resolveAdUnitId):
//   1. The EXPO_PUBLIC_ADMOB_* env var / EAS secret, if set (always wins).
//   2. In DEV builds only, the Google TEST id (so dev/test builds show ads).
//   3. In a PRODUCTION build, the committed real production default for that
//      slot — or '' (no ad) if none exists.
// A production build NEVER falls back to a Google TEST id: serving test ads in
// production is a policy violation (store rejection) and earns $0.
//
// Ad unit IDs are PUBLIC identifiers (they ship inside the app binary and are
// trivially extractable), not secrets, so the real iOS units are committed
// below as production defaults. This guarantees a release iOS build serves real
// ads even if the EXPO_PUBLIC_ADMOB_* secrets are never configured, while still
// letting a secret override per build. scripts/preflight-check.js validates
// any configured values and warns on unconfigured slots.
// ---------------------------------------------------------------------------
const TEST_BANNER_IOS = 'ca-app-pub-3940256099942544/2934735716';
const TEST_BANNER_ANDROID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_INTERSTITIAL_IOS = 'ca-app-pub-3940256099942544/4411468910';
const TEST_INTERSTITIAL_ANDROID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_REWARDED_IOS = 'ca-app-pub-3940256099942544/1712485313';
const TEST_REWARDED_ANDROID = 'ca-app-pub-3940256099942544/5224354917';

// Real production ad unit IDs for the iOS AdMob app (pub-2286247955186424).
// Committed as defaults so a release build monetizes without depending on
// secrets being wired. Env vars still take precedence.
const PROD_BANNER_IOS = 'ca-app-pub-2286247955186424/8520540300'; // "Banner"
const PROD_REWARDED_IOS = 'ca-app-pub-2286247955186424/7390605700'; // "Awarded" (Rewarded)
// The AdMob "Ad-win" unit (…/2329850711) is a *rewarded interstitial* — a
// distinct format that cannot be served through the standard InterstitialAd
// class this app uses (lib/ads/interstitial.ts). The standard interstitial slot
// is left unconfigured (safe no-op) until a real standard Interstitial unit
// exists; set EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS to enable it.
const PROD_INTERSTITIAL_IOS = '';

/**
 * Resolve an ad unit ID with three-tier priority:
 *   1. `envValue` (trimmed) if non-empty — the configured env var / EAS secret.
 *   2. `devFallbackTestId` when `isDev` — Google TEST id, DEV builds only.
 *   3. `prodFallbackId` otherwise — the committed real production default
 *      (or '' for slots without one).
 * A production build never returns a Google TEST id. Exported for testing.
 */
export function resolveAdUnitId(
  envValue: string | undefined,
  devFallbackTestId: string,
  isDev: boolean,
  prodFallbackId = '',
): string {
  // Trim so a whitespace-only env value falls through to the fallback instead of
  // issuing an invalid ad request.
  const normalized = typeof envValue === 'string' ? envValue.trim() : '';
  if (normalized) return normalized;
  return isDev ? devFallbackTestId : prodFallbackId;
}

const AD_UNITS = {
  BANNER: Platform.select({
    ios: resolveAdUnitId(process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS, TEST_BANNER_IOS, __DEV__, PROD_BANNER_IOS),
    android: resolveAdUnitId(process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID, TEST_BANNER_ANDROID, __DEV__),
  }) || '',
  INTERSTITIAL: Platform.select({
    ios: resolveAdUnitId(process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS, TEST_INTERSTITIAL_IOS, __DEV__, PROD_INTERSTITIAL_IOS),
    android: resolveAdUnitId(process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID, TEST_INTERSTITIAL_ANDROID, __DEV__),
  }) || '',
  REWARDED: Platform.select({
    ios: resolveAdUnitId(process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS, TEST_REWARDED_IOS, __DEV__, PROD_REWARDED_IOS),
    android: resolveAdUnitId(process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID, TEST_REWARDED_ANDROID, __DEV__),
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

  private listeners: ((state: AdMobState) => void)[] = [];
  private interstitial: any = null;
  private rewarded: any = null;
  // P0-5: gate personalized ads on ATT / consent. Defaults to false
  // (non-personalized — the GDPR + Apple 5.1.2 safe default) until the cached
  // tracking status resolves after init.
  private trackingAllowed = false;

  // RevenueCat correlates an impression's events by a single id, so one is
  // minted per ad REQUEST and reused across that ad's loaded → displayed →
  // paid lifecycle. Banners are the exception (see trackBannerRevenue).
  private interstitialImpressionId = '';
  private rewardedImpressionId = '';
  // The unit the currently-loaded ad was requested against — `AD_UNITS` alone
  // isn't enough, since __DEV__ swaps in Google's TEST ids at request time.
  private interstitialAdUnitId = '';
  private rewardedAdUnitId = '';
  // Detach handles for the PAID listeners. Each load builds a fresh ad object,
  // so without these the previous object's native listener outlives it.
  private detachInterstitialRevenue: (() => void) | null = null;
  private detachRewardedRevenue: (() => void) | null = null;

  /** Drop a previously attached PAID listener. Never throws. */
  private detach(unsub: (() => void) | null): null {
    try {
      unsub?.();
    } catch {
      // A detach that fails must not block the next ad load.
    }
    return null;
  }

  /** P0-5: request options — non-personalized ads unless ATT/consent is granted. */
  adRequestOptions(): { requestNonPersonalizedAds: boolean } {
    return { requestNonPersonalizedAds: !this.trackingAllowed };
  }

  // --- RevenueCat ad revenue reporting -------------------------------------
  // Every method here is fire-and-forget and fully swallowed. These run inside
  // the ad SDK's own callbacks during playback, so a throw or an unhandled
  // rejection would cost a reward or wedge an ad — no analytics event is worth
  // that. They also no-op entirely unless the `revenueCat` flag is on.

  /**
   * Subscribe an ad object to AdMob's impression-level revenue event and
   * forward it to RevenueCat. Returns an unsubscribe function (a no-op when the
   * PAID event isn't supported by this SDK build).
   *
   * Impression-level ad revenue must ALSO be enabled in the AdMob dashboard —
   * it is off by default and account-gated. Without it this listener simply
   * never fires, which is why a silent no-op here is the correct behavior
   * rather than a warning on every ad.
   */
  private attachRevenueListener(
    ad: PaidCapableAd | null,
    adFormat: RcAdFormat,
    adUnitId: string,
    impressionId: string,
  ): () => void {
    const paidEvent = NativeAdEventType?.PAID;
    if (!paidEvent || typeof ad?.addAdEventListener !== 'function') return () => {};
    try {
      const unsub = ad.addAdEventListener(paidEvent, (event: AdMobPaidEvent) => {
        this.reportRevenue(event, adFormat, adUnitId, impressionId);
      });
      return typeof unsub === 'function' ? unsub : () => {};
    } catch (error) {
      log.warn('PAID listener attach failed', { error: errMessage(error) });
      return () => {};
    }
  }

  /** Map an AdMob paid event onto RevenueCat and send it. Never throws. */
  private reportRevenue(
    event: AdMobPaidEvent,
    adFormat: RcAdFormat,
    adUnitId: string,
    impressionId: string,
  ): void {
    try {
      const payload = buildAdRevenuePayload(
        event,
        { adFormat, adUnitId, impressionId },
        NativeRevenuePrecisions,
      );
      // Null means the event could not be represented honestly (unusable
      // amount, missing unit/impression) — drop it rather than post a figure
      // that would be wrong on a revenue dashboard.
      if (!payload) return;
      void revenueCatService.trackAdRevenue(payload);
    } catch (error) {
      log.warn('Ad revenue report failed', { error: errMessage(error) });
    }
  }

  /** Report an ad lifecycle event (fill / display) to RevenueCat. Never throws. */
  private reportLifecycle(
    kind: 'loaded' | 'displayed',
    adFormat: RcAdFormat,
    adUnitId: string,
    impressionId: string,
  ): void {
    if (!adUnitId || !impressionId) return;
    try {
      const payload = { mediatorName: RC_MEDIATOR_ADMOB, adFormat, adUnitId, impressionId };
      void (kind === 'loaded'
        ? revenueCatService.trackAdLoaded(payload)
        : revenueCatService.trackAdDisplayed(payload));
    } catch (error) {
      log.warn('Ad lifecycle report failed', { error: errMessage(error) });
    }
  }

  /** Report a failed ad load (no-fill / error) to RevenueCat. Never throws. */
  private reportFailedToLoad(adFormat: RcAdFormat, adUnitId: string, error: unknown): void {
    if (!adUnitId) return;
    try {
      const source = (error ?? {}) as { code?: unknown; mediatorErrorCode?: unknown };
      const raw = source.code ?? source.mediatorErrorCode;
      void revenueCatService.trackAdFailedToLoad({
        mediatorName: RC_MEDIATOR_ADMOB,
        adFormat,
        adUnitId,
        mediatorErrorCode: typeof raw === 'number' ? raw : null,
      });
    } catch (err) {
      log.warn('Ad failure report failed', { error: errMessage(err) });
    }
  }

  /**
   * Report banner revenue. Unlike fullscreen formats the banner mints a FRESH
   * impression id per paid event: AdMob auto-refreshes banners in place with no
   * event we can observe, so there is no request boundary to anchor an id to —
   * and one paid event is exactly one impression, which is the thing the id
   * identifies. Called by `components/BannerAd.tsx` via its `onPaid` prop.
   */
  trackBannerRevenue(adUnitId: string, event: AdMobPaidEvent): void {
    this.reportRevenue(event, 'banner', adUnitId, newImpressionId());
  }

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

      // P0-5: cache ATT/consent so ad requests can synchronously request
      // non-personalized ads when tracking isn't allowed (iOS ATT denied / EU).
      void isTrackingAllowed()
        .then((allowed) => {
          this.trackingAllowed = allowed;
        })
        .catch(() => {
          this.trackingAllowed = false; // fail closed → non-personalized
        });

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
      if (!adUnitId) {
        // Production build with no configured interstitial unit (EXPO_PUBLIC_ADMOB_*
        // unset). Skip rather than request an empty unit / serve a test ad.
        log.warn('No interstitial ad unit ID configured - skipping load');
        return;
      }
      this.interstitial = NativeInterstitialAd.createForAdRequest(adUnitId, this.adRequestOptions());
      // One impression id per request, carried through loaded → displayed → paid.
      const impressionId = newImpressionId();
      this.interstitialImpressionId = impressionId;
      this.interstitialAdUnitId = adUnitId;
      this.detachInterstitialRevenue = this.detach(this.detachInterstitialRevenue);
      this.detachInterstitialRevenue = this.attachRevenueListener(
        this.interstitial,
        'interstitial',
        adUnitId,
        impressionId,
      );

      await new Promise<void>((resolve, reject) => {
        // ONE exit path for all three outcomes. A load TIMEOUT used to reject
        // while leaving both listeners attached, so a late LOADED still ran its
        // handler — marking the service ready for an ad that had been abandoned,
        // and (once this ad object was replaced by the next load) attributing
        // that state and its tracking event to a stale impression.
        let settled = false;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        let unsubLoaded: (() => void) | undefined;
        let unsubError: (() => void) | undefined;

        const settle = (outcome: () => void): void => {
          if (settled) return;
          settled = true;
          if (timeout) clearTimeout(timeout);
          unsubLoaded?.();
          unsubError?.();
          outcome();
        };

        timeout = setTimeout(
          () =>
            settle(() => {
              const err = new Error('Load timeout');
              // A timeout IS a failed load — report it as one rather than
              // leaving a silent gap in the fill data.
              this.reportFailedToLoad('interstitial', adUnitId, err);
              reject(err);
            }),
          15000,
        );

        unsubLoaded = this.interstitial.addAdEventListener(NativeAdEventType.LOADED, () =>
          settle(() => {
            this.setState({ isInterstitialLoaded: true });
            recordSuccess();
            this.reportLifecycle('loaded', 'interstitial', adUnitId, impressionId);
            resolve();
          }),
        );

        unsubError = this.interstitial.addAdEventListener(NativeAdEventType.ERROR, (err: any) =>
          settle(() => {
            this.reportFailedToLoad('interstitial', adUnitId, err);
            reject(err);
          }),
        );

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
      track('ad_shown', { kind: 'interstitial' });
      this.reportLifecycle(
        'displayed',
        'interstitial',
        this.interstitialAdUnitId,
        this.interstitialImpressionId,
      );
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
      if (!adUnitId) {
        log.warn('No rewarded ad unit ID configured - skipping load');
        return;
      }
      this.rewarded = NativeRewardedAd.createForAdRequest(adUnitId, this.adRequestOptions());
      // One impression id per request, carried through loaded → displayed → paid.
      const impressionId = newImpressionId();
      this.rewardedImpressionId = impressionId;
      this.rewardedAdUnitId = adUnitId;
      this.detachRewardedRevenue = this.detach(this.detachRewardedRevenue);
      this.detachRewardedRevenue = this.attachRevenueListener(
        this.rewarded,
        'rewarded',
        adUnitId,
        impressionId,
      );

      // Determine the correct event type constants — RewardedAd may use its own enum
      const loadedEvent = NativeRewardedAdEventType?.LOADED || NativeAdEventType?.LOADED;
      const errorEvent = NativeAdEventType?.ERROR;

      if (!loadedEvent || !errorEvent) {
        log.warn('Ad event types not available');
        return;
      }

      await new Promise<void>((resolve, reject) => {
        // Same single-settle contract as the interstitial load above.
        let settled = false;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        let unsubLoaded: (() => void) | undefined;
        let unsubError: (() => void) | undefined;

        const settle = (outcome: () => void): void => {
          if (settled) return;
          settled = true;
          if (timeout) clearTimeout(timeout);
          unsubLoaded?.();
          unsubError?.();
          outcome();
        };

        timeout = setTimeout(
          () =>
            settle(() => {
              const err = new Error('Load timeout');
              this.reportFailedToLoad('rewarded', adUnitId, err);
              reject(err);
            }),
          15000,
        );

        unsubLoaded = this.rewarded.addAdEventListener(loadedEvent, () =>
          settle(() => {
            this.setState({ isRewardedLoaded: true });
            recordSuccess();
            this.reportLifecycle('loaded', 'rewarded', adUnitId, impressionId);
            resolve();
          }),
        );

        unsubError = this.rewarded.addAdEventListener(errorEvent, (err: any) =>
          settle(() => {
            this.reportFailedToLoad('rewarded', adUnitId, err);
            reject(err);
          }),
        );

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

    const ad = this.rewarded;
    let rewarded = false;
    let unsubReward: (() => void) | undefined;
    let unsubClosed: (() => void) | undefined;
    let closeFallback: ReturnType<typeof setTimeout> | undefined;

    try {
      const rewardEvent = NativeRewardedAdEventType?.EARNED_REWARD;
      const closedEvent = NativeAdEventType?.CLOSED;

      if (rewardEvent) {
        unsubReward = ad.addAdEventListener(rewardEvent, () => {
          rewarded = true;
          track('ad_rewarded', { kind: 'rewarded' });
        });
      }

      // P2-16: resolve when the ad CLOSES, not when show() resolves. EARNED_REWARD
      // can arrive around close time, so reading `rewarded` immediately after
      // show() could drop a legitimately-earned reward. A timeout fallback ensures
      // we never hang if no CLOSED event is delivered.
      const closed = new Promise<void>((resolve) => {
        if (closedEvent) {
          unsubClosed = ad.addAdEventListener(closedEvent, () => resolve());
        }
        closeFallback = setTimeout(resolve, 60000);
      });

      await ad.show();
      track('ad_shown', { kind: 'rewarded' });
      this.reportLifecycle('displayed', 'rewarded', this.rewardedAdUnitId, this.rewardedImpressionId);
      await closed;

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
    } finally {
      if (closeFallback) clearTimeout(closeFallback);
      unsubReward?.();
      unsubClosed?.();
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
      this.detachInterstitialRevenue = this.detach(this.detachInterstitialRevenue);
      this.detachRewardedRevenue = this.detach(this.detachRewardedRevenue);
      this.interstitial = null;
      this.rewarded = null;
      // Drop the impression ids with the ads they belonged to, so a later event
      // can never be attributed to a torn-down impression.
      this.interstitialImpressionId = '';
      this.rewardedImpressionId = '';
      this.interstitialAdUnitId = '';
      this.rewardedAdUnitId = '';
      this.setState({ isInterstitialLoaded: false, isRewardedLoaded: false });
    } catch (_) {
      // Never crash on cleanup
    }
  }
}

export const adMobService = new AdMobServiceImpl();
