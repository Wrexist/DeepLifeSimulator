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

import { AppState, Platform } from 'react-native';
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
import { noteFullscreenShown } from '@/lib/ads/adSession';
import {
  AD_SHOW_WAIT_MS,
  isAdFresh,
  isNoFillError,
  nextRetryDelayMs,
  type FullscreenAdFormat,
} from '@/lib/ads/loadPolicy';

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
let NativeRewardedInterstitialAd: any = null;
let NativeAdEventType: any = null;
let NativeRewardedAdEventType: any = null;
let NativeBannerAd: any = null;
let NativeBannerAdSize: any = null;
let NativeTestIds: any = null;
// AdMob's numeric precision enum, forwarded to the RevenueCat precision mapper
// so it never has to hardcode an ordinal the SDK could renumber.
let NativeRevenuePrecisions: any = null;
let NativeConsent: typeof import('react-native-google-mobile-ads').AdsConsent | null = null;

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
    NativeRewardedInterstitialAd = mod.RewardedInterstitialAd ?? null;
    NativeAdEventType = mod.AdEventType;
    NativeRewardedAdEventType = mod.RewardedAdEventType;
    NativeBannerAd = mod.BannerAd;
    NativeBannerAdSize = mod.BannerAdSize;
    NativeTestIds = mod.TestIds;
    NativeRevenuePrecisions = mod.RevenuePrecisions ?? null;
    NativeConsent = mod.AdsConsent ?? null;
    moduleLoaded = true;
    return true;
  } catch (error: any) {
    log.warn('react-native-google-mobile-ads not available:', error?.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Circuit breakers - one per concern, so one bad slot cannot silence the rest
// ---------------------------------------------------------------------------
// There used to be ONE breaker for everything. The interstitial slot is
// configured with a unit of the wrong format (a rewarded interstitial), so its
// loads fail every time, and three of those in a row switched off the rewarded
// ad and the banner too. A no-fill also counted, though it is the network
// saying "nothing to serve", not a fault. Each concern now has its own breaker,
// and only real errors (see `isNoFillError`) trip it.
const MAX_CONSECUTIVE_FAILURES = 3;
// D-1: Auto-recovery resets a breaker after 5 minutes
const CIRCUIT_RECOVERY_MS = 5 * 60 * 1000;

type BreakerKey = 'init' | FullscreenAdFormat;

/** What a rewarded show actually did. See `showRewardedAdWithOutcome`. */
export type RewardedShowOutcome = 'earned' | 'dismissed' | 'not-shown';

/**
 * Last-resort resolve for a rewarded ad whose CLOSED event never arrives. It
 * was 60s, which a long video + end card (or a paused ad) can outlast; the
 * reward listener was then torn down while the ad was still up. (MON-16)
 */
const REWARDED_CLOSE_FALLBACK_MS = 180_000;

interface Breaker {
  failures: number;
  open: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

const newBreaker = (): Breaker => ({ failures: 0, open: false, timer: null });

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
const TEST_REWARDED_INTERSTITIAL_IOS = 'ca-app-pub-3940256099942544/6978759866';
const TEST_REWARDED_INTERSTITIAL_ANDROID = 'ca-app-pub-3940256099942544/5354046379';

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
// That same "Ad-win" unit IS the right format for the year-end break
// (lib/ads/yearEndBreak.ts), which is a rewarded interstitial.
const PROD_REWARDED_INTERSTITIAL_IOS = 'ca-app-pub-2286247955186424/2329850711';

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
  REWARDED_INTERSTITIAL: Platform.select({
    ios: resolveAdUnitId(
      process.env.EXPO_PUBLIC_ADMOB_REWARDED_INTERSTITIAL_IOS,
      TEST_REWARDED_INTERSTITIAL_IOS,
      __DEV__,
      PROD_REWARDED_INTERSTITIAL_IOS,
    ),
    android: resolveAdUnitId(
      process.env.EXPO_PUBLIC_ADMOB_REWARDED_INTERSTITIAL_ANDROID,
      TEST_REWARDED_INTERSTITIAL_ANDROID,
      __DEV__,
    ),
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
  isRewardedInterstitialLoaded: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Service implementation
// ---------------------------------------------------------------------------
class AdMobServiceImpl {
  private initializing: Promise<void> | null = null;
  private changingPrivacy = false;
  private cancelInterstitialLoad: (() => void) | null = null;
  private cancelRewardedLoad: (() => void) | null = null;
  private cancelRewardedInterstitialLoad: (() => void) | null = null;
  private state: AdMobState = {
    isLoading: false,
    isInitialized: false,
    isInterstitialLoaded: false,
    isRewardedLoaded: false,
    isRewardedInterstitialLoaded: false,
    error: null,
  };

  private listeners: ((state: AdMobState) => void)[] = [];
  private breakers: Record<BreakerKey, Breaker> = {
    init: newBreaker(),
    interstitial: newBreaker(),
    rewarded: newBreaker(),
    rewardedInterstitial: newBreaker(),
  };
  // Load scheduling per fullscreen format (lib/ads/loadPolicy.ts).
  private loadedAt: Record<FullscreenAdFormat, number> = { interstitial: 0, rewarded: 0, rewardedInterstitial: 0 };
  private retryAttempt: Record<FullscreenAdFormat, number> = { interstitial: 0, rewarded: 0, rewardedInterstitial: 0 };
  private retryTimer: Record<FullscreenAdFormat, ReturnType<typeof setTimeout> | null> = {
    interstitial: null,
    rewarded: null,
    rewardedInterstitial: null,
  };
  private inFlight: Record<FullscreenAdFormat, Promise<void> | null> = {
    interstitial: null,
    rewarded: null,
    rewardedInterstitial: null,
  };
  // Formats something has asked for. The rewarded interstitial is only wanted
  // near a year-end boundary, so it is not preloaded at boot or on every
  // foreground - an unused request is a wasted impression opportunity.
  private wanted: Record<FullscreenAdFormat, boolean> = {
    interstitial: true,
    rewarded: true,
    rewardedInterstitial: false,
  };
  private appStateSub: { remove: () => void } | null = null;
  private interstitial: any = null;
  private rewarded: any = null;
  private rewardedInterstitial: any = null;
  // ATT separately limits personalization. Regional request permission comes
  // from UMP before SDK initialization; non-personalized ads still need it.
  private trackingAllowed = false;

  // RevenueCat correlates an impression's events by a single id, so one is
  // minted per ad REQUEST and reused across that ad's loaded → displayed →
  // paid lifecycle. Banners are the exception (see trackBannerRevenue).
  private interstitialImpressionId = '';
  private rewardedImpressionId = '';
  private rewardedInterstitialImpressionId = '';
  // The unit the currently-loaded ad was requested against — `AD_UNITS` alone
  // isn't enough, since __DEV__ swaps in Google's TEST ids at request time.
  private interstitialAdUnitId = '';
  private rewardedAdUnitId = '';
  private rewardedInterstitialAdUnitId = '';
  // Detach handles for the PAID listeners. Each load builds a fresh ad object,
  // so without these the previous object's native listener outlives it.
  private detachInterstitialRevenue: (() => void) | null = null;
  private detachRewardedRevenue: (() => void) | null = null;
  private detachRewardedInterstitialRevenue: (() => void) | null = null;

  /** Drop a previously attached PAID listener. Never throws. */
  private detach(unsub: (() => void) | null): null {
    try {
      unsub?.();
    } catch {
      // A detach that fails must not block the next ad load.
    }
    return null;
  }

  private breakerOpen(key: BreakerKey): boolean {
    return this.breakers[key].open;
  }

  private recordFailure(key: BreakerKey): void {
    const b = this.breakers[key];
    b.failures++;
    if (b.failures < MAX_CONSECUTIVE_FAILURES || b.open) return;
    b.open = true;
    log.warn('Circuit breaker tripped - temporarily disabled', { key });
    if (b.timer) return;
    b.timer = setTimeout(() => {
      b.open = false;
      b.failures = 0;
      b.timer = null;
      log.info('Circuit breaker auto-recovered', { key });
      if (key !== 'init') void this.ensureLoaded(key);
    }, CIRCUIT_RECOVERY_MS);
  }

  private recordSuccess(key: BreakerKey): void {
    const b = this.breakers[key];
    b.failures = 0;
    if (b.timer) {
      clearTimeout(b.timer);
      b.timer = null;
    }
    b.open = false;
  }

  private clearRetry(format: FullscreenAdFormat): void {
    const t = this.retryTimer[format];
    if (t) clearTimeout(t);
    this.retryTimer[format] = null;
  }

  /** A load succeeded: the ad is fresh from now, and the retry schedule resets. */
  private onLoaded(format: FullscreenAdFormat): void {
    this.loadedAt[format] = Date.now();
    this.retryAttempt[format] = 0;
    this.clearRetry(format);
    this.recordSuccess(format);
  }

  /**
   * A load failed. A real error counts toward the breaker; a no-fill does not.
   * Either way the next attempt is scheduled on the backoff until the schedule
   * runs out - then the next trigger (foreground, a show request) restarts it.
   */
  private onLoadFailed(format: FullscreenAdFormat, error: unknown): void {
    this.loadedAt[format] = 0;
    if (!isNoFillError(error)) this.recordFailure(format);
    if (this.breakerOpen(format) || this.changingPrivacy || !this.state.isInitialized) return;
    const delay = nextRetryDelayMs(this.retryAttempt[format]);
    if (delay === null) return;
    this.retryAttempt[format]++;
    this.clearRetry(format);
    this.retryTimer[format] = setTimeout(() => {
      this.retryTimer[format] = null;
      void this.load(format);
    }, delay);
  }

  private load(format: FullscreenAdFormat): Promise<void> {
    if (format === 'rewarded') return this.loadRewardedAd();
    if (format === 'rewardedInterstitial') return this.loadRewardedInterstitialAd();
    return this.loadInterstitialAd();
  }

  /** True when a fullscreen ad of this format is loaded and not yet stale. */
  isReady(format: FullscreenAdFormat): boolean {
    const loaded = format === 'rewarded'
      ? this.state.isRewardedLoaded
      : format === 'rewardedInterstitial'
        ? this.state.isRewardedInterstitialLoaded
        : this.state.isInterstitialLoaded;
    const ad = format === 'rewarded'
      ? this.rewarded
      : format === 'rewardedInterstitial'
        ? this.rewardedInterstitial
        : this.interstitial;
    return loaded && !!ad && isAdFresh(this.loadedAt[format], Date.now());
  }

  /**
   * Make sure an ad of this format is loaded or loading. Resolves when the
   * in-flight load settles (immediately when one is already fresh). A call is a
   * TRIGGER: it restarts a retry schedule that had run out. Never throws.
   */
  ensureLoaded(format: FullscreenAdFormat): Promise<void> {
    this.wanted[format] = true;
    if (!this.state.isInitialized || this.changingPrivacy || this.breakerOpen(format)) {
      return Promise.resolve();
    }
    if (this.isReady(format)) return Promise.resolve();
    const pending = this.inFlight[format];
    if (pending) return pending;
    this.clearRetry(format);
    this.retryAttempt[format] = 0;
    return this.load(format);
  }

  /**
   * Reload whatever is missing or stale whenever the app comes back to the
   * foreground. Players background a game for hours; an ad loaded before that
   * has expired, and a schedule that ran out offline should try again now.
   */
  private attachForegroundRefresh(): void {
    if (this.appStateSub) return;
    try {
      const sub = AppState?.addEventListener?.('change', (next: string) => {
        if (next !== 'active') return;
        (['rewarded', 'interstitial', 'rewardedInterstitial'] as const).forEach((format) => {
          if (this.wanted[format]) void this.ensureLoaded(format);
        });
      });
      this.appStateSub = sub && typeof sub.remove === 'function' ? sub : null;
    } catch (error) {
      log.warn('Foreground refresh unavailable', { error: errMessage(error) });
    }
  }

  /** ATT is an additional restriction; UMP manages regional consent signals. */
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
    // The id is minted INSIDE the guard on purpose. It used to be passed as an
    // argument, and an argument is evaluated before the callee is entered - so
    // `reportRevenue`'s try/catch, and `BannerAd`'s comment that this is "fully
    // swallowed inside the service", covered everything except the one call that
    // could actually throw. When `newImpressionId` did throw (see its note - it
    // used uuid, which has no `crypto.getRandomValues` on Hermes), the error
    // escaped through the banner's `onPaid` callback into the render tree and the
    // player got a full-screen "App Initialization Error" from an ANALYTICS
    // failure. AdMob refreshes banners in place, so it fired again on every
    // refresh. The mint no longer throws; this makes the promise true regardless.
    try {
      const impressionId = newImpressionId();
      // AdMob's paid callback represents an impression, including zero-value
      // impressions. RevenueCat tracks display and revenue separately. Reuse
      // the id so banner refreshes contribute to both metrics without minting
      // an unrelated impression for the revenue event.
      this.reportLifecycle('displayed', 'banner', adUnitId, impressionId);
      this.reportRevenue(event, 'banner', adUnitId, impressionId);
    } catch (error) {
      log.warn('Banner revenue report failed', { error: errMessage(error) });
    }
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

  initialize(): Promise<void> {
    if (this.changingPrivacy) return Promise.resolve();
    if (!this.initializing) {
      this.initializing = this.initializeAfterConsent().finally(() => {
        this.initializing = null;
      });
    }
    return this.initializing;
  }

  private async initializeAfterConsent(): Promise<void> {
    if (this.breakerOpen('init') || this.state.isInitialized) return;

    if (!loadModule() || !mobileAds) {
      this.setState({ error: 'Ad module not available' });
      return;
    }

    try {
      this.setState({ isLoading: true });
      if (!NativeConsent) throw new Error('Ad privacy module not available');
      try {
        await NativeConsent.gatherConsent();
      } catch (error) {
        // UMP may retain a valid choice from the preceding session. Only its
        // current canRequestAds result can authorize a request after an error.
        log.warn('Ad privacy update failed', { error: errMessage(error) });
      }
      const { canRequestAds } = await NativeConsent.getConsentInfo();
      if (canRequestAds !== true) {
        this.setState({ isLoading: false, error: 'Ad privacy choice required' });
        return;
      }
      this.trackingAllowed = await isTrackingAllowed().catch(() => false);
      await mobileAds().initialize();
      this.setState({ isInitialized: true, isLoading: false, error: null });
      this.recordSuccess('init');
      log.info('Initialized successfully');

      // Pre-load ads in background, and keep them loaded from here on.
      void this.ensureLoaded('interstitial');
      void this.ensureLoaded('rewarded');
      this.attachForegroundRefresh();
    } catch (error: any) {
      this.recordFailure('init');
      log.error('Initialization failed:', error?.message);
      this.setState({ isLoading: false, error: error?.message || 'Init failed' });
    }
  }

  /** Stop cached requests before changing privacy; UMP owns the regional choice. */
  async openPrivacyOptions(): Promise<'saved' | 'not-required' | 'unavailable'> {
    if (this.changingPrivacy) return 'unavailable';
    this.changingPrivacy = true;
    try {
      if (this.initializing) await this.initializing;
      if (!loadModule() || !NativeConsent) return 'unavailable';
      const info = await NativeConsent.getConsentInfo();
      if (info.privacyOptionsRequirementStatus === 'NOT_REQUIRED') return 'not-required';
      if (info.privacyOptionsRequirementStatus !== 'REQUIRED') return 'unavailable';
      this.setState({ isInitialized: false });
      this.cleanup();
      await NativeConsent.showPrivacyOptionsForm();
      this.changingPrivacy = false;
      await this.initialize();
      return 'saved';
    } catch (error) {
      log.warn('Ad privacy options failed', { error: errMessage(error) });
      return 'unavailable';
    } finally {
      this.changingPrivacy = false;
    }
  }

  // --- Interstitial ---

  loadInterstitialAd(): Promise<void> {
    const pending = this.inFlight.interstitial;
    if (pending) return pending;
    const run = this.loadInterstitialAdOnce().finally(() => {
      this.inFlight.interstitial = null;
    });
    this.inFlight.interstitial = run;
    return run;
  }

  private async loadInterstitialAdOnce(): Promise<void> {
    if (this.breakerOpen('interstitial') || !this.state.isInitialized || !NativeInterstitialAd || !NativeAdEventType) return;

    try {
      const adUnitId = __DEV__ && NativeTestIds ? NativeTestIds.INTERSTITIAL : AD_UNITS.INTERSTITIAL;
      if (!adUnitId) {
        // Production build with no configured interstitial unit (EXPO_PUBLIC_ADMOB_*
        // unset). Skip rather than request an empty unit / serve a test ad.
        log.warn('No interstitial ad unit ID configured - skipping load');
        return;
      }
      this.interstitial = NativeInterstitialAd.createForAdRequest(adUnitId, this.adRequestOptions());
      // The previous ad object (if any) is replaced, so its loaded state is gone.
      this.loadedAt.interstitial = 0;
      if (this.state.isInterstitialLoaded) this.setState({ isInterstitialLoaded: false });
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

        this.cancelInterstitialLoad = () => settle(resolve);

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
            this.onLoaded('interstitial');
            this.setState({ isInterstitialLoaded: true });
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
      log.warn('Interstitial load failed:', error?.message);
      this.setState({ isInterstitialLoaded: false });
      this.onLoadFailed('interstitial', error);
    }
  }

  async showInterstitialAd(placement = 'interstitial'): Promise<boolean> {
    if (!this.isAvailable()) return false;
    if (!this.isReady('interstitial')) {
      // Not worth holding a natural break open for a load: start one for the
      // next break and skip this one.
      void this.ensureLoaded('interstitial');
      return false;
    }

    try {
      await this.interstitial.show();
      track('ad_shown', { kind: 'interstitial', placement });
      noteFullscreenShown('interstitial');
      this.reportLifecycle(
        'displayed',
        'interstitial',
        this.interstitialAdUnitId,
        this.interstitialImpressionId,
      );
      this.setState({ isInterstitialLoaded: false });
      this.loadedAt.interstitial = 0;
      this.recordSuccess('interstitial');
      // Pre-load next one
      void this.ensureLoaded('interstitial');
      return true;
    } catch (error: any) {
      this.recordFailure('interstitial');
      log.warn('Interstitial show failed:', error?.message);
      this.setState({ isInterstitialLoaded: false });
      this.loadedAt.interstitial = 0;
      void this.ensureLoaded('interstitial');
      return false;
    }
  }

  // --- Rewarded ---

  loadRewardedAd(): Promise<void> {
    const pending = this.inFlight.rewarded;
    if (pending) return pending;
    const run = this.loadRewardedAdOnce().finally(() => {
      this.inFlight.rewarded = null;
    });
    this.inFlight.rewarded = run;
    return run;
  }

  private async loadRewardedAdOnce(): Promise<void> {
    if (this.breakerOpen('rewarded') || !this.state.isInitialized || !NativeRewardedAd) return;

    try {
      const adUnitId = __DEV__ && NativeTestIds ? NativeTestIds.REWARDED : AD_UNITS.REWARDED;
      if (!adUnitId) {
        log.warn('No rewarded ad unit ID configured - skipping load');
        return;
      }
      this.rewarded = NativeRewardedAd.createForAdRequest(adUnitId, this.adRequestOptions());
      // The previous ad object (if any) is replaced, so its loaded state is gone.
      this.loadedAt.rewarded = 0;
      if (this.state.isRewardedLoaded) this.setState({ isRewardedLoaded: false });
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

        this.cancelRewardedLoad = () => settle(resolve);

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
            this.onLoaded('rewarded');
            this.setState({ isRewardedLoaded: true });
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
      log.warn('Rewarded ad load failed:', error?.message);
      this.setState({ isRewardedLoaded: false });
      this.onLoadFailed('rewarded', error);
    }
  }

  /**
   * Show a rewarded ad. When none is ready, a load is started and the call
   * waits up to `waitMs` for it - the player has just asked for this ad, so a
   * short wait beats a no-fill. `placement` names the surface in analytics.
   */
  async showRewardedAd(
    onReward: () => void,
    opts: { placement?: string; waitMs?: number } = {},
  ): Promise<boolean> {
    return (await this.showRewardedAdWithOutcome(onReward, opts)) === 'earned';
  }

  /**
   * Same as {@link showRewardedAd}, but tells a skipped ad apart from no ad:
   *   - 'earned'    the ad was shown and EARNED_REWARD fired (onReward ran)
   *   - 'dismissed' the ad was shown and closed without the reward
   *   - 'not-shown' nothing was shown (no inventory, load/show failure)
   * Only 'not-shown' is a no-fill. A boolean collapsed 'dismissed' into it, so
   * the reward orb's no-fill courtesy paid a player who closed the ad at once.
   * (2026-10 audit MON-3)
   */
  async showRewardedAdWithOutcome(
    onReward: () => void,
    opts: { placement?: string; waitMs?: number } = {},
  ): Promise<RewardedShowOutcome> {
    if (!this.isAvailable()) return 'not-shown';
    const placement = opts.placement ?? 'rewarded';
    if (!this.isReady('rewarded')) {
      const pending = this.ensureLoaded('rewarded');
      const waitMs = opts.waitMs ?? AD_SHOW_WAIT_MS;
      if (waitMs > 0) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
          pending,
          new Promise<void>((resolve) => {
            timer = setTimeout(resolve, waitMs);
          }),
        ]);
        if (timer) clearTimeout(timer);
      }
      if (!this.isReady('rewarded') || !this.isAvailable()) return 'not-shown';
    }

    const ad = this.rewarded;
    let rewarded = false;
    let displayed = false;
    let unsubReward: (() => void) | undefined;
    let unsubClosed: (() => void) | undefined;
    let closeFallback: ReturnType<typeof setTimeout> | undefined;

    try {
      const rewardEvent = NativeRewardedAdEventType?.EARNED_REWARD;
      const closedEvent = NativeAdEventType?.CLOSED;

      if (rewardEvent) {
        unsubReward = ad.addAdEventListener(rewardEvent, () => {
          rewarded = true;
          track('ad_rewarded', { kind: 'rewarded', placement });
        });
      }

      // P2-16: resolve when the ad CLOSES, not when show() resolves. EARNED_REWARD
      // can arrive around close time, so reading `rewarded` immediately after
      // show() could drop a legitimately-earned reward. A timeout fallback ensures
      // we never hang if no CLOSED event is delivered. It is generous on purpose
      // (MON-16): a rewarded unit can run well past a minute (video + end card or
      // playable, or a paused/backgrounded ad), and resolving early unsubscribed
      // the reward listener while the ad was still on screen.
      const closed = new Promise<void>((resolve) => {
        if (closedEvent) {
          unsubClosed = ad.addAdEventListener(closedEvent, () => resolve());
        }
        closeFallback = setTimeout(resolve, REWARDED_CLOSE_FALLBACK_MS);
      });

      await ad.show();
      displayed = true;
      track('ad_shown', { kind: 'rewarded', placement });
      noteFullscreenShown('rewarded');
      this.reportLifecycle('displayed', 'rewarded', this.rewardedAdUnitId, this.rewardedImpressionId);
      await closed;

      this.setState({ isRewardedLoaded: false });
      this.loadedAt.rewarded = 0;
      this.recordSuccess('rewarded');

      if (rewarded) {
        try { onReward(); } catch (_) { /* never crash on reward callback error */ }
      }

      // Pre-load next one
      void this.ensureLoaded('rewarded');
      return rewarded ? 'earned' : 'dismissed';
    } catch (error: any) {
      this.recordFailure('rewarded');
      log.warn('Rewarded show failed:', error?.message);
      this.setState({ isRewardedLoaded: false });
      this.loadedAt.rewarded = 0;
      void this.ensureLoaded('rewarded');
      return displayed ? 'dismissed' : 'not-shown';
    } finally {
      if (closeFallback) clearTimeout(closeFallback);
      unsubReward?.();
      unsubClosed?.();
    }
  }

  // --- Rewarded interstitial (the year-end break) ---
  //
  // Same event surface as the rewarded ad (RewardedAdEventType LOADED /
  // EARNED_REWARD), served by its own class. Kept as its own slot rather than
  // folded into the rewarded one so a year-end request never spends the ad a
  // player is about to ask the orb for.

  loadRewardedInterstitialAd(): Promise<void> {
    const pending = this.inFlight.rewardedInterstitial;
    if (pending) return pending;
    const run = this.loadRewardedInterstitialAdOnce().finally(() => {
      this.inFlight.rewardedInterstitial = null;
    });
    this.inFlight.rewardedInterstitial = run;
    return run;
  }

  private async loadRewardedInterstitialAdOnce(): Promise<void> {
    if (
      this.breakerOpen('rewardedInterstitial') ||
      !this.state.isInitialized ||
      !NativeRewardedInterstitialAd
    ) return;

    try {
      const adUnitId = __DEV__ && NativeTestIds?.REWARDED_INTERSTITIAL
        ? NativeTestIds.REWARDED_INTERSTITIAL
        : AD_UNITS.REWARDED_INTERSTITIAL;
      if (!adUnitId) {
        log.warn('No rewarded interstitial ad unit ID configured - skipping load');
        return;
      }
      const loadedEvent = NativeRewardedAdEventType?.LOADED || NativeAdEventType?.LOADED;
      const errorEvent = NativeAdEventType?.ERROR;
      if (!loadedEvent || !errorEvent) return;

      this.rewardedInterstitial = NativeRewardedInterstitialAd.createForAdRequest(adUnitId, this.adRequestOptions());
      this.loadedAt.rewardedInterstitial = 0;
      if (this.state.isRewardedInterstitialLoaded) this.setState({ isRewardedInterstitialLoaded: false });
      const impressionId = newImpressionId();
      this.rewardedInterstitialImpressionId = impressionId;
      this.rewardedInterstitialAdUnitId = adUnitId;
      this.detachRewardedInterstitialRevenue = this.detach(this.detachRewardedInterstitialRevenue);
      this.detachRewardedInterstitialRevenue = this.attachRevenueListener(
        this.rewardedInterstitial,
        'rewarded_interstitial',
        adUnitId,
        impressionId,
      );

      await new Promise<void>((resolve, reject) => {
        // Same single-settle contract as the other fullscreen loads.
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
        this.cancelRewardedInterstitialLoad = () => settle(resolve);
        timeout = setTimeout(
          () =>
            settle(() => {
              const err = new Error('Load timeout');
              this.reportFailedToLoad('rewarded_interstitial', adUnitId, err);
              reject(err);
            }),
          15000,
        );
        unsubLoaded = this.rewardedInterstitial.addAdEventListener(loadedEvent, () =>
          settle(() => {
            this.onLoaded('rewardedInterstitial');
            this.setState({ isRewardedInterstitialLoaded: true });
            this.reportLifecycle('loaded', 'rewarded_interstitial', adUnitId, impressionId);
            resolve();
          }),
        );
        unsubError = this.rewardedInterstitial.addAdEventListener(errorEvent, (err: any) =>
          settle(() => {
            this.reportFailedToLoad('rewarded_interstitial', adUnitId, err);
            reject(err);
          }),
        );
        this.rewardedInterstitial.load();
      });
    } catch (error: any) {
      log.warn('Rewarded interstitial load failed:', error?.message);
      this.setState({ isRewardedInterstitialLoaded: false });
      this.onLoadFailed('rewardedInterstitial', error);
    }
  }

  /**
   * Show the loaded rewarded interstitial. Never waits for a load: the intro
   * card is only offered once one is ready (lib/ads/yearEndBreak.ts). Resolves
   * true only when the reward was earned; `onReward` runs at most once.
   */
  async showRewardedInterstitialAd(
    onReward: () => void,
    opts: { placement?: string } = {},
  ): Promise<boolean> {
    if (!this.isAvailable() || !this.isReady('rewardedInterstitial')) return false;
    const placement = opts.placement ?? 'rewarded_interstitial';
    const ad = this.rewardedInterstitial;
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
          track('ad_rewarded', { kind: 'rewarded_interstitial', placement });
        });
      }
      const closed = new Promise<void>((resolve) => {
        if (closedEvent) {
          unsubClosed = ad.addAdEventListener(closedEvent, () => resolve());
        }
        closeFallback = setTimeout(resolve, 60000);
      });

      await ad.show();
      track('ad_shown', { kind: 'rewarded_interstitial', placement });
      noteFullscreenShown('rewardedInterstitial');
      this.reportLifecycle(
        'displayed',
        'rewarded_interstitial',
        this.rewardedInterstitialAdUnitId,
        this.rewardedInterstitialImpressionId,
      );
      await closed;

      this.setState({ isRewardedInterstitialLoaded: false });
      this.loadedAt.rewardedInterstitial = 0;
      this.recordSuccess('rewardedInterstitial');
      if (rewarded) {
        try { onReward(); } catch (_) { /* never crash on reward callback error */ }
      }
      return rewarded;
    } catch (error: any) {
      this.recordFailure('rewardedInterstitial');
      log.warn('Rewarded interstitial show failed:', error?.message);
      this.setState({ isRewardedInterstitialLoaded: false });
      this.loadedAt.rewardedInterstitial = 0;
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
    return this.isAvailable() ? NativeBannerAd : null;
  }

  /** Returns the BannerAdSize constants, or null if unavailable */
  getBannerAdSize(): any {
    return this.isAvailable() ? NativeBannerAdSize : null;
  }

  /** Returns the banner ad unit ID for the current platform */
  getBannerAdUnitId(): string {
    if (!this.isAvailable()) return '';
    if (__DEV__ && NativeTestIds) return NativeTestIds.BANNER;
    return AD_UNITS.BANNER;
  }

  /**
   * True when the SDK is loaded and initialized and initialization is not
   * circuit-broken. A fullscreen format's own breaker does not affect this:
   * a failing interstitial slot must not take the banner down with it.
   */
  isAvailable(): boolean {
    return !this.breakerOpen('init') && moduleLoaded && this.state.isInitialized;
  }

  // --- Cleanup ---

  cleanup(): void {
    try {
      this.cancelInterstitialLoad?.();
      this.cancelRewardedLoad?.();
      this.cancelInterstitialLoad = null;
      this.cancelRewardedLoad = null;
      this.cancelRewardedInterstitialLoad?.();
      this.cancelRewardedInterstitialLoad = null;
      this.clearRetry('interstitial');
      this.clearRetry('rewarded');
      this.clearRetry('rewardedInterstitial');
      this.retryAttempt = { interstitial: 0, rewarded: 0, rewardedInterstitial: 0 };
      this.loadedAt = { interstitial: 0, rewarded: 0, rewardedInterstitial: 0 };
      this.detachRewardedInterstitialRevenue = this.detach(this.detachRewardedInterstitialRevenue);
      this.rewardedInterstitial = null;
      this.rewardedInterstitialImpressionId = '';
      this.rewardedInterstitialAdUnitId = '';
      this.appStateSub?.remove();
      this.appStateSub = null;
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
      this.setState({ isInterstitialLoaded: false, isRewardedLoaded: false, isRewardedInterstitialLoaded: false });
    } catch (_) {
      // Never crash on cleanup
    }
  }
}

export const adMobService = new AdMobServiceImpl();
