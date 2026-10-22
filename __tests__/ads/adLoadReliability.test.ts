/**
 * Fullscreen ads stay loaded.
 *
 * The service loaded each format once at startup and once after every show,
 * and never again. One no-fill at boot left the rewarded slot empty for the
 * whole session, so every "Watch ad" tap fell through to the no-fill courtesy
 * grant and earned nothing. And one global circuit breaker meant the
 * misconfigured interstitial slot (a rewarded-interstitial unit, which fails
 * every load) could switch off the rewarded ad and the banner with it.
 *
 * These pin the schedule (lib/ads/loadPolicy.ts) and the service behaviour.
 */

jest.mock('@/utils/trackingTransparency', () => ({
  isTrackingAllowed: jest.fn().mockResolvedValue(false),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/services/RevenueCatService', () => ({
  revenueCatService: {
    trackAdLoaded: jest.fn().mockResolvedValue(true),
    trackAdDisplayed: jest.fn().mockResolvedValue(true),
    trackAdRevenue: jest.fn().mockResolvedValue(true),
    trackAdFailedToLoad: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('react-native-google-mobile-ads', () => {
  const initialize = jest.fn().mockResolvedValue(undefined);
  const created: { interstitials: FakeAd[]; rewarded: FakeAd[]; rewardedInterstitials: FakeAd[] } = {
    interstitials: [],
    rewarded: [],
    rewardedInterstitials: [],
  };

  function makeFakeAd(bucket: FakeAd[]): FakeAd {
    const listeners = new Map<string, Set<(payload?: unknown) => void>>();
    const ad: FakeAd = {
      addAdEventListener: (type: string, cb: (payload?: unknown) => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(cb);
        return () => {
          listeners.get(type)?.delete(cb);
        };
      },
      emit: (type: string, payload?: unknown) => {
        for (const cb of [...(listeners.get(type) ?? [])]) cb(payload);
      },
      load: jest.fn(),
      show: jest.fn().mockResolvedValue(undefined),
    };
    bucket.push(ad);
    return ad;
  }

  return {
    __created: created,
    default: () => ({ initialize }),
    AdsConsent: {
      gatherConsent: jest.fn().mockResolvedValue(undefined),
      getConsentInfo: jest.fn().mockResolvedValue({ canRequestAds: true }),
      showPrivacyOptionsForm: jest.fn().mockResolvedValue(undefined),
    },
    InterstitialAd: { createForAdRequest: () => makeFakeAd(created.interstitials) },
    RewardedAd: { createForAdRequest: () => makeFakeAd(created.rewarded) },
    RewardedInterstitialAd: { createForAdRequest: () => makeFakeAd(created.rewardedInterstitials) },
    AdEventType: { LOADED: 'loaded', ERROR: 'error', CLOSED: 'closed', OPENED: 'opened', PAID: 'paid' },
    RewardedAdEventType: { LOADED: 'rewarded_loaded', EARNED_REWARD: 'earned_reward' },
    BannerAd: () => null,
    BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'adaptive' },
    TestIds: {
      INTERSTITIAL: 'test-interstitial',
      REWARDED: 'test-rewarded',
      REWARDED_INTERSTITIAL: 'test-rewarded-interstitial',
      BANNER: 'test-banner',
    },
    RevenuePrecisions: { UNKNOWN: 0, ESTIMATED: 1, PUBLISHER_PROVIDED: 2, PRECISE: 3 },
  };
});

import {
  AD_FRESHNESS_MS,
  isAdFresh,
  isNoFillError,
  nextRetryDelayMs,
} from '@/lib/ads/loadPolicy';

interface FakeAd {
  addAdEventListener: (type: string, cb: (payload?: unknown) => void) => () => void;
  emit: (type: string, payload?: unknown) => void;
  load: jest.Mock;
  show: jest.Mock;
}

const NO_FILL = Object.assign(new Error('No fill.'), { code: 'googleMobileAds/error-code-no-fill' });
const INTERNAL = Object.assign(new Error('Internal error.'), { code: 'googleMobileAds/error-code-internal-error' });

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

/** Advance fake time and let the load promise chains drain. */
async function advance(ms: number): Promise<void> {
  jest.advanceTimersByTime(ms);
  await flush();
}

function sdk() {
  return jest.requireMock('react-native-google-mobile-ads') as {
    __created: { interstitials: FakeAd[]; rewarded: FakeAd[]; rewardedInterstitials: FakeAd[] };
  };
}

const latestRewarded = () => sdk().__created.rewarded[sdk().__created.rewarded.length - 1];
const latestInterstitial = () => sdk().__created.interstitials[sdk().__created.interstitials.length - 1];

async function boot() {
  const { adMobService } = await import('@/services/AdMobService');
  await adMobService.initialize();
  await flush();
  return adMobService;
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  jest.useFakeTimers();
  // AD_UNITS is resolved at module load; configure an interstitial unit so the
  // slot actually requests (it ships unconfigured in production).
  process.env = { ...ORIGINAL_ENV, EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS: 'test-interstitial-unit' };
});

afterEach(async () => {
  const { adMobService } = await import('@/services/AdMobService');
  adMobService.cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
  process.env = { ...ORIGINAL_ENV };
});

describe('the load schedule', () => {
  it('backs off 2, 4, 8, 16, 32, 64 seconds and then waits for a trigger', () => {
    expect([0, 1, 2, 3, 4, 5].map(nextRetryDelayMs)).toEqual([2000, 4000, 8000, 16000, 32000, 64000]);
    expect(nextRetryDelayMs(6)).toBeNull();
    expect(nextRetryDelayMs(-1)).toBeNull();
  });

  it('tells a no-fill apart from a real error', () => {
    expect(isNoFillError(NO_FILL)).toBe(true);
    expect(isNoFillError({ message: 'Request Error: No fill.' })).toBe(true);
    expect(isNoFillError(INTERNAL)).toBe(false);
    expect(isNoFillError(new Error('Load timeout'))).toBe(false);
    expect(isNoFillError(undefined)).toBe(false);
  });

  it('treats an ad as stale just before the hour', () => {
    expect(isAdFresh(1000, 1000 + AD_FRESHNESS_MS - 1)).toBe(true);
    expect(isAdFresh(1000, 1000 + AD_FRESHNESS_MS)).toBe(false);
    expect(isAdFresh(0, 5)).toBe(false);
  });
});

describe('a failed load is retried', () => {
  it('requests again after the backoff instead of leaving the slot empty all session', async () => {
    const service = await boot();
    expect(sdk().__created.rewarded).toHaveLength(1);

    latestRewarded().emit('error', NO_FILL);
    await flush();
    expect(service.isReady('rewarded')).toBe(false);

    await advance(1999);
    expect(sdk().__created.rewarded).toHaveLength(1);
    await advance(1);
    expect(sdk().__created.rewarded).toHaveLength(2);

    latestRewarded().emit('rewarded_loaded');
    await flush();
    expect(service.isReady('rewarded')).toBe(true);
  });

  it('stops after the schedule runs out, and a show request restarts it', async () => {
    const service = await boot();
    // Initial load + 6 retries, every one a no-fill.
    for (let i = 0; i < 6; i++) {
      latestRewarded().emit('error', NO_FILL);
      await flush();
      await advance(nextRetryDelayMs(i)!);
    }
    expect(sdk().__created.rewarded).toHaveLength(7);
    latestRewarded().emit('error', NO_FILL);
    await flush();
    await advance(10 * 60_000);
    expect(sdk().__created.rewarded).toHaveLength(7);

    void service.ensureLoaded('rewarded');
    await flush();
    expect(sdk().__created.rewarded).toHaveLength(8);
  });
});

describe('one slot cannot take the others down', () => {
  it('never opens the breaker on a no-fill', async () => {
    const service = await boot();
    for (let i = 0; i < 5; i++) {
      latestRewarded().emit('error', NO_FILL);
      await flush();
      await advance(nextRetryDelayMs(i)!);
    }
    latestRewarded().emit('rewarded_loaded');
    await flush();
    expect(service.isReady('rewarded')).toBe(true);
    expect(service.isAvailable()).toBe(true);
  });

  it('keeps the rewarded ad and the banner working while the interstitial slot fails', async () => {
    const service = await boot();
    latestRewarded().emit('rewarded_loaded');
    await flush();
    for (let i = 0; i < 3; i++) {
      latestInterstitial().emit('error', INTERNAL);
      await flush();
      await advance(nextRetryDelayMs(i)!);
    }
    expect(service.isAvailable()).toBe(true);
    expect(service.getBannerAdUnitId()).not.toBe('');
    expect(service.getNativeBannerAd()).not.toBeNull();
    expect(service.isReady('rewarded')).toBe(true);
  });

  it('stops requesting a slot whose breaker is open until it recovers', async () => {
    await boot();
    for (let i = 0; i < 3; i++) {
      if (i > 0) await advance(nextRetryDelayMs(i - 1)!);
      latestInterstitial().emit('error', INTERNAL);
      await flush();
    }
    // Three real errors in a row: the breaker is open and no retry is queued.
    const count = sdk().__created.interstitials.length;
    expect(count).toBe(3);
    await advance(4 * 60_000);
    expect(sdk().__created.interstitials).toHaveLength(count);
    await advance(60_000);
    expect(sdk().__created.interstitials).toHaveLength(count + 1);
  });
});

describe('a loaded ad is kept fresh', () => {
  it('reloads an ad that has gone stale', async () => {
    const service = await boot();
    latestRewarded().emit('rewarded_loaded');
    await flush();
    expect(service.isReady('rewarded')).toBe(true);

    jest.setSystemTime(Date.now() + AD_FRESHNESS_MS);
    expect(service.isReady('rewarded')).toBe(false);
    void service.ensureLoaded('rewarded');
    await flush();
    expect(sdk().__created.rewarded).toHaveLength(2);
  });

  it('refreshes on returning to the foreground', async () => {
    const { AppState } = jest.requireMock('react-native') as {
      AppState: { addEventListener: jest.Mock };
    };
    await boot();
    latestRewarded().emit('error', NO_FILL);
    await flush();
    const handler = AppState.addEventListener.mock.calls.find(([type]) => type === 'change')?.[1];
    expect(typeof handler).toBe('function');

    handler('active');
    await flush();
    expect(sdk().__created.rewarded).toHaveLength(2);
  });
});

describe('showing a rewarded ad', () => {
  it('waits briefly for a load the player has just asked for, then plays it', async () => {
    const service = await boot();
    latestRewarded().emit('error', NO_FILL);
    await flush();

    const onReward = jest.fn();
    const shown = service.showRewardedAd(onReward, { placement: 'test', waitMs: 4000 });
    await flush();
    expect(sdk().__created.rewarded).toHaveLength(2);

    const ad = latestRewarded();
    ad.emit('rewarded_loaded');
    await flush();
    ad.emit('earned_reward');
    ad.emit('closed');
    await flush();

    await expect(shown).resolves.toBe(true);
    expect(onReward).toHaveBeenCalledTimes(1);
    const { track } = jest.requireMock('@/lib/analytics') as { track: jest.Mock };
    expect(track).toHaveBeenCalledWith('ad_shown', { kind: 'rewarded', placement: 'test' });
  });

  it('gives up after the wait when nothing loads, without granting', async () => {
    const service = await boot();
    latestRewarded().emit('error', NO_FILL);
    await flush();

    const onReward = jest.fn();
    const shown = service.showRewardedAd(onReward, { waitMs: 4000 });
    await advance(4000);
    await expect(shown).resolves.toBe(false);
    expect(onReward).not.toHaveBeenCalled();
  });

  // MON-3 (2026-10 audit): a SHOWN ad closed before the reward must not read
  // as "no ad" - that is what let the orb's no-fill courtesy pay a skip.
  it('reports an ad that was shown and closed early as "dismissed", not "not-shown"', async () => {
    const service = await boot();
    const ad = latestRewarded();
    ad.emit('rewarded_loaded');
    await flush();

    const onReward = jest.fn();
    const outcome = service.showRewardedAdWithOutcome(onReward, { waitMs: 0 });
    await flush();
    ad.emit('closed');
    await flush();
    await expect(outcome).resolves.toBe('dismissed');
    expect(onReward).not.toHaveBeenCalled();
  });

  it('reports "not-shown" when nothing could be shown', async () => {
    const service = await boot();
    latestRewarded().emit('error', NO_FILL);
    await flush();
    const outcome = service.showRewardedAdWithOutcome(jest.fn(), { waitMs: 4000 });
    await advance(4000);
    await expect(outcome).resolves.toBe('not-shown');
  });

  // MON-16: a reward earned after the old 60s fallback still pays.
  it('still pays a reward earned after a minute on screen', async () => {
    const service = await boot();
    const ad = latestRewarded();
    ad.emit('rewarded_loaded');
    await flush();

    const onReward = jest.fn();
    const outcome = service.showRewardedAdWithOutcome(onReward, { waitMs: 0 });
    await flush();
    await advance(90_000);
    ad.emit('earned_reward');
    ad.emit('closed');
    await flush();
    await expect(outcome).resolves.toBe('earned');
    expect(onReward).toHaveBeenCalledTimes(1);
  });
});

describe('the rewarded interstitial (year-end break)', () => {
  const latestRI = () => sdk().__created.rewardedInterstitials[sdk().__created.rewardedInterstitials.length - 1];

  it('is not requested at boot, only when something asks for it', async () => {
    const service = await boot();
    expect(sdk().__created.rewardedInterstitials).toHaveLength(0);
    void service.ensureLoaded('rewardedInterstitial');
    await flush();
    expect(sdk().__created.rewardedInterstitials).toHaveLength(1);
  });

  it('plays, grants once on the earned reward, and records the placement', async () => {
    const service = await boot();
    void service.ensureLoaded('rewardedInterstitial');
    await flush();
    latestRI().emit('rewarded_loaded');
    await flush();
    expect(service.isReady('rewardedInterstitial')).toBe(true);

    const onReward = jest.fn();
    const shown = service.showRewardedInterstitialAd(onReward, { placement: 'year_end' });
    await flush();
    latestRI().emit('earned_reward');
    latestRI().emit('closed');
    await expect(shown).resolves.toBe(true);
    expect(onReward).toHaveBeenCalledTimes(1);
    const { track } = jest.requireMock('@/lib/analytics') as { track: jest.Mock };
    expect(track).toHaveBeenCalledWith('ad_shown', { kind: 'rewarded_interstitial', placement: 'year_end' });
    expect(service.isReady('rewardedInterstitial')).toBe(false);
  });

  it('refuses to show when nothing is loaded, rather than waiting', async () => {
    const service = await boot();
    const onReward = jest.fn();
    await expect(service.showRewardedInterstitialAd(onReward)).resolves.toBe(false);
    expect(onReward).not.toHaveBeenCalled();
  });

  it('is refreshed on foreground once it has been wanted', async () => {
    const { AppState } = jest.requireMock('react-native') as {
      AppState: { addEventListener: jest.Mock };
    };
    const service = await boot();
    const handler = AppState.addEventListener.mock.calls.find(([type]) => type === 'change')?.[1];
    handler('active');
    await flush();
    expect(sdk().__created.rewardedInterstitials).toHaveLength(0);

    void service.ensureLoaded('rewardedInterstitial');
    await flush();
    latestRI().emit('error', NO_FILL);
    await flush();
    handler('active');
    await flush();
    expect(sdk().__created.rewardedInterstitials).toHaveLength(2);
  });
});
