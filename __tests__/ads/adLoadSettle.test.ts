/**
 * Fullscreen ad loads settle exactly once.
 *
 * The load promise has three possible outcomes — LOADED, ERROR, and a 15s
 * timeout — and the timeout used to reject while leaving both event listeners
 * attached. That is silent damage rather than a crash:
 *
 *  - a late LOADED still ran its handler, marking the service ready for an ad
 *    the caller had already given up on;
 *  - by then `this.interstitial` may point at a NEWER ad object, so the state
 *    (and the RevenueCat tracking event) is attributed to a different
 *    impression than the one that actually loaded;
 *  - the timeout itself was never reported as a failed load, leaving a hole in
 *    the fill data exactly where inventory is worst.
 *
 * These lock the single-settle contract for both fullscreen formats.
 */

jest.mock('@/utils/trackingTransparency', () => ({
  isTrackingAllowed: jest.fn().mockResolvedValue(false),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const mockTrackAdLoaded = jest.fn().mockResolvedValue(true);
const mockTrackAdDisplayed = jest.fn().mockResolvedValue(true);
const mockTrackAdRevenue = jest.fn().mockResolvedValue(true);
const mockTrackAdFailedToLoad = jest.fn().mockResolvedValue(true);
jest.mock('@/services/RevenueCatService', () => ({
  revenueCatService: {
    trackAdLoaded: (...args: unknown[]) => mockTrackAdLoaded(...args),
    trackAdDisplayed: (...args: unknown[]) => mockTrackAdDisplayed(...args),
    trackAdRevenue: (...args: unknown[]) => mockTrackAdRevenue(...args),
    trackAdFailedToLoad: (...args: unknown[]) => mockTrackAdFailedToLoad(...args),
  },
}));

jest.mock('react-native-google-mobile-ads', () => {
  const initialize = jest.fn().mockResolvedValue(undefined);
  const created: { interstitials: FakeAd[]; rewarded: FakeAd[] } = {
    interstitials: [],
    rewarded: [],
  };

  function makeFakeAd(bucket: FakeAd[]): FakeAd {
    const listeners = new Map<string, Set<(payload?: unknown) => void>>();
    const ad: FakeAd = {
      detachCount: 0,
      listenerCount: () => {
        let n = 0;
        for (const set of listeners.values()) n += set.size;
        return n;
      },
      addAdEventListener: (type: string, cb: (payload?: unknown) => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(cb);
        return () => {
          ad.detachCount++;
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
    __initialize: initialize,
    AdsConsent: {
      gatherConsent: jest.fn().mockResolvedValue(undefined),
      getConsentInfo: jest.fn().mockResolvedValue({ canRequestAds: true }),
      showPrivacyOptionsForm: jest.fn().mockResolvedValue(undefined),
    },
    InterstitialAd: { createForAdRequest: () => makeFakeAd(created.interstitials) },
    RewardedAd: { createForAdRequest: () => makeFakeAd(created.rewarded) },
    AdEventType: { LOADED: 'loaded', ERROR: 'error', CLOSED: 'closed', OPENED: 'opened', PAID: 'paid' },
    RewardedAdEventType: { LOADED: 'rewarded_loaded', EARNED_REWARD: 'earned_reward' },
    BannerAd: null,
    BannerAdSize: {},
    TestIds: { INTERSTITIAL: 'test-interstitial', REWARDED: 'test-rewarded', BANNER: 'test-banner' },
    RevenuePrecisions: { UNKNOWN: 0, ESTIMATED: 1, PUBLISHER_PROVIDED: 2, PRECISE: 3 },
  };
});

interface FakeAd {
  detachCount: number;
  listenerCount: () => number;
  addAdEventListener: (type: string, cb: (payload?: unknown) => void) => () => void;
  emit: (type: string, payload?: unknown) => void;
  load: jest.Mock;
  show: jest.Mock;
}

const LOAD_TIMEOUT_MS = 15000;

/** Let queued microtasks drain (the load promise chains a few deep). */
async function flush(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

/**
 * Fresh service + fresh SDK mock. `initialize()` kicks off a background preload
 * of both fullscreen formats, which is the load we then drive.
 */
async function bootService(): Promise<{
  service: typeof import('@/services/AdMobService').adMobService;
  interstitial: FakeAd;
  rewarded: FakeAd;
}> {
  const { adMobService } = await import('@/services/AdMobService');
  await adMobService.initialize();
  await flush();
  const sdk = jest.requireMock('react-native-google-mobile-ads') as {
    __created: { interstitials: FakeAd[]; rewarded: FakeAd[] };
  };
  return {
    service: adMobService,
    interstitial: sdk.__created.interstitials[0],
    rewarded: sdk.__created.rewarded[0],
  };
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  jest.useFakeTimers();
  // `__DEV__` is false under Jest, and the standard interstitial slot ships
  // deliberately unconfigured in production (see PROD_INTERSTITIAL_IOS), so
  // without this the interstitial load short-circuits and never creates an ad.
  // AD_UNITS is resolved at module load, hence set before the import.
  process.env = { ...ORIGINAL_ENV, EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS: 'test-interstitial-unit' };
});

afterEach(() => {
  jest.useRealTimers();
  process.env = { ...ORIGINAL_ENV };
});

describe('interstitial load settles once', () => {
  it('detaches both listeners on timeout, so a late LOADED cannot mark the service ready', async () => {
    const { service, interstitial } = await bootService();
    expect(interstitial.listenerCount()).toBeGreaterThan(0);

    jest.advanceTimersByTime(LOAD_TIMEOUT_MS);
    await flush();

    // The load listeners are gone — only the long-lived PAID listener may remain.
    expect(interstitial.detachCount).toBeGreaterThanOrEqual(2);

    // The ad arrives late, after the caller gave up.
    interstitial.emit('loaded');
    await flush();

    expect(service.getState().isInterstitialLoaded).toBe(false);
    expect(mockTrackAdLoaded).not.toHaveBeenCalled();
  });

  it('reports the timeout as a failed load rather than leaving a silent gap', async () => {
    await bootService();

    jest.advanceTimersByTime(LOAD_TIMEOUT_MS);
    await flush();

    expect(mockTrackAdFailedToLoad).toHaveBeenCalledWith(
      expect.objectContaining({ mediatorName: 'AdMob', adFormat: 'interstitial' }),
    );
  });

  it('resolves on LOADED, detaching the load listeners and reporting fill exactly once', async () => {
    const { service, interstitial } = await bootService();

    interstitial.emit('loaded');
    await flush();

    expect(service.getState().isInterstitialLoaded).toBe(true);
    expect(mockTrackAdLoaded).toHaveBeenCalledTimes(1);

    // A duplicate LOADED from the SDK must not re-report the same impression.
    interstitial.emit('loaded');
    await flush();
    expect(mockTrackAdLoaded).toHaveBeenCalledTimes(1);

    // ...and the timeout that never fired must not report a failure afterwards.
    jest.advanceTimersByTime(LOAD_TIMEOUT_MS);
    await flush();
    expect(mockTrackAdFailedToLoad).not.toHaveBeenCalledWith(
      expect.objectContaining({ adFormat: 'interstitial' }),
    );
  });
});

describe('rewarded load settles once', () => {
  it('detaches both listeners on timeout, so a late LOADED cannot mark the service ready', async () => {
    const { service, rewarded } = await bootService();

    jest.advanceTimersByTime(LOAD_TIMEOUT_MS);
    await flush();

    rewarded.emit('rewarded_loaded');
    await flush();

    expect(service.getState().isRewardedLoaded).toBe(false);
    expect(mockTrackAdLoaded).not.toHaveBeenCalledWith(
      expect.objectContaining({ adFormat: 'rewarded' }),
    );
  });

  it('resolves on LOADED and reports fill exactly once', async () => {
    const { service, rewarded } = await bootService();

    rewarded.emit('rewarded_loaded');
    await flush();

    expect(service.getState().isRewardedLoaded).toBe(true);
    expect(mockTrackAdLoaded).toHaveBeenCalledWith(
      expect.objectContaining({ adFormat: 'rewarded', mediatorName: 'AdMob' }),
    );
  });
});

describe('impression-level revenue', () => {
  it('forwards an AdMob paid event to RevenueCat in micros', async () => {
    const { interstitial } = await bootService();

    interstitial.emit('loaded');
    await flush();
    interstitial.emit('paid', { value: 0.0042, currency: 'USD', precision: 3 });
    await flush();

    expect(mockTrackAdRevenue).toHaveBeenCalledWith(
      expect.objectContaining({
        adFormat: 'interstitial',
        revenueMicros: 4200,
        currency: 'USD',
        precision: 'exact',
      }),
    );
  });

  it('drops a paid event whose currency is missing', async () => {
    const { interstitial } = await bootService();

    interstitial.emit('loaded');
    await flush();
    interstitial.emit('paid', { value: 0.0042, currency: '', precision: 3 });
    await flush();

    expect(mockTrackAdRevenue).not.toHaveBeenCalled();
  });
});

interface ConsentSdkFixture {
  __initialize: jest.Mock;
  __created: { interstitials: FakeAd[]; rewarded: FakeAd[] };
  AdsConsent: {
    gatherConsent: jest.Mock;
    getConsentInfo: jest.Mock;
    showPrivacyOptionsForm: jest.Mock;
  };
}

function consentSdk(): ConsentSdkFixture {
  return jest.requireMock('react-native-google-mobile-ads') as ConsentSdkFixture;
}

describe('regional ad privacy request boundary', () => {
  it('waits for consent before native initialization and shares concurrent startup', async () => {
    const sdk = consentSdk();
    let finish!: () => void;
    sdk.AdsConsent.gatherConsent.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    const { adMobService: service } = await import('@/services/AdMobService');
    const first = service.initialize();
    expect(service.initialize()).toBe(first);
    await flush();
    expect(sdk.AdsConsent.gatherConsent).toHaveBeenCalledTimes(1);
    expect(sdk.__initialize).not.toHaveBeenCalled();
    expect(sdk.__created.interstitials).toHaveLength(0);
    expect(service.getNativeBannerAd()).toBeNull();
    finish();
    await first;
    expect(sdk.__initialize).toHaveBeenCalledTimes(1);
    expect(sdk.__created.interstitials).toHaveLength(1);
    expect(service.adRequestOptions()).toEqual({ requestNonPersonalizedAds: true });
    service.cleanup();
  });

  it.each([false, undefined])('does not initialize or request ads when canRequestAds is %s', async allowed => {
    const sdk = consentSdk();
    sdk.AdsConsent.getConsentInfo.mockResolvedValue({ canRequestAds: allowed });
    const { adMobService: service } = await import('@/services/AdMobService');
    await service.initialize();
    expect(sdk.__initialize).not.toHaveBeenCalled();
    expect(sdk.__created.rewarded).toHaveLength(0);
    expect(service.isAvailable()).toBe(false);
  });

  it.each([false, true])('on a consent update error uses only the SDK current permission (%s)', async allowed => {
    const sdk = consentSdk();
    sdk.AdsConsent.gatherConsent.mockRejectedValue(new Error('offline'));
    sdk.AdsConsent.getConsentInfo.mockResolvedValue({ canRequestAds: allowed });
    const { adMobService: service } = await import('@/services/AdMobService');
    await service.initialize();
    expect(sdk.__initialize).toHaveBeenCalledTimes(allowed ? 1 : 0);
    expect(service.isAvailable()).toBe(allowed);
    service.cleanup();
  });

  it('fails closed when the SDK cannot read consent', async () => {
    const sdk = consentSdk();
    sdk.AdsConsent.getConsentInfo.mockRejectedValue(new Error('native read failed'));
    const { adMobService: service } = await import('@/services/AdMobService');
    await service.initialize();
    expect(sdk.__initialize).not.toHaveBeenCalled();
    expect(service.getState().isLoading).toBe(false);
  });

  it('cancels cached loads and blocks reinitialization while privacy choices are open', async () => {
    const { service, interstitial, rewarded } = await bootService();
    const sdk = consentSdk();
    sdk.AdsConsent.getConsentInfo.mockResolvedValue({ canRequestAds: true, privacyOptionsRequirementStatus: 'REQUIRED' });
    let finish!: () => void;
    sdk.AdsConsent.showPrivacyOptionsForm.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    const change = service.openPrivacyOptions();
    await flush();
    expect(service.isAvailable()).toBe(false);
    expect(interstitial.listenerCount()).toBe(0);
    expect(rewarded.listenerCount()).toBe(0);
    await service.initialize();
    expect(sdk.__initialize).toHaveBeenCalledTimes(1);
    interstitial.emit('loaded');
    rewarded.emit('rewarded_loaded');
    expect(service.getState().isInterstitialLoaded).toBe(false);
    expect(service.getState().isRewardedLoaded).toBe(false);
    expect(await service.showInterstitialAd()).toBe(false);
    sdk.AdsConsent.getConsentInfo.mockResolvedValue({ canRequestAds: false, privacyOptionsRequirementStatus: 'REQUIRED' });
    finish();
    expect(await change).toBe('saved');
    expect(service.isAvailable()).toBe(false);
    expect(sdk.__created.interstitials).toHaveLength(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('creates fresh requests only after privacy choices permit them', async () => {
    const { service } = await bootService();
    const sdk = consentSdk();
    sdk.AdsConsent.getConsentInfo.mockResolvedValue({ canRequestAds: true, privacyOptionsRequirementStatus: 'REQUIRED' });
    expect(await service.openPrivacyOptions()).toBe('saved');
    expect(sdk.AdsConsent.showPrivacyOptionsForm).toHaveBeenCalledTimes(1);
    expect(sdk.__created.interstitials).toHaveLength(2);
    expect(service.isAvailable()).toBe(true);
    service.cleanup();
  });

  it.each(['UNKNOWN', 'NOT_REQUIRED'])('does not claim unknown privacy options are saved: %s', async status => {
    const sdk = consentSdk();
    sdk.AdsConsent.getConsentInfo.mockResolvedValue({ canRequestAds: false, privacyOptionsRequirementStatus: status });
    const { adMobService: service } = await import('@/services/AdMobService');
    expect(await service.openPrivacyOptions()).toBe(status === 'NOT_REQUIRED' ? 'not-required' : 'unavailable');
    expect(sdk.AdsConsent.showPrivacyOptionsForm).not.toHaveBeenCalled();
  });
});
