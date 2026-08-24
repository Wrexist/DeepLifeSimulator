/**
 * RevenueCat ad tracking — the guards around `Purchases.adTracker`.
 *
 * These methods are called from AdMob's own event listeners while an ad is
 * playing, which makes their failure modes unusually expensive:
 *
 *  1. Every `adTracker` method calls `throwIfNotConfigured()` inside the SDK, so
 *     a track call on an unconfigured Purchases instance REJECTS. The ad path
 *     may never have touched RevenueCat before (a player who watches rewarded
 *     ads but never opens the paywall), so the service must configure first.
 *  2. A rejection or throw must never escape — an unhandled rejection inside an
 *     ad callback costs a reward or wedges the ad, and no analytics event is
 *     worth that.
 *  3. With the flag off, or on an SDK with no tracker, it must no-op silently
 *     rather than warn on every impression.
 *
 * Each test re-imports the service so the singleton and the lazily-required
 * native module start fresh.
 */
import type { isFeatureEnabled } from '@/lib/config/featureFlags';
import type { RcAdRevenuePayload } from '@/lib/ads/adRevenueTracking';

const mockIsFeatureEnabled = jest.fn<
  ReturnType<typeof isFeatureEnabled>,
  Parameters<typeof isFeatureEnabled>
>(() => true);
jest.mock('@/lib/config/featureFlags', () => ({
  isFeatureEnabled: mockIsFeatureEnabled,
}));

const ORIGINAL_ENV = { ...process.env };

const PAYLOAD: RcAdRevenuePayload = {
  mediatorName: 'AdMob',
  adFormat: 'rewarded',
  adUnitId: 'ca-app-pub-2286247955186424/7390605700',
  impressionId: 'imp-1',
  revenueMicros: 4200,
  currency: 'USD',
  precision: 'exact',
};

function mockPurchases(overrides: Record<string, any> = {}) {
  const adTracker = {
    trackAdRevenue: jest.fn().mockResolvedValue(undefined),
    trackAdLoaded: jest.fn().mockResolvedValue(undefined),
    trackAdDisplayed: jest.fn().mockResolvedValue(undefined),
    trackAdFailedToLoad: jest.fn().mockResolvedValue(undefined),
    ...(overrides.adTracker ?? {}),
  };
  const mod = {
    configure: jest.fn(),
    enableAdServicesAttributionTokenCollection: jest.fn().mockResolvedValue(undefined),
    getCustomerInfo: jest.fn().mockResolvedValue({ entitlements: { active: {} } }),
    ...overrides,
    adTracker: overrides.adTracker === null ? undefined : adTracker,
  };
  jest.doMock('react-native-purchases', () => mod);
  return { mod, adTracker };
}

async function freshService(): Promise<any> {
  jest.doMock('react-native', () => ({
    Platform: {
      OS: 'ios',
      select: (spec: Record<string, any>) => spec.ios ?? spec.default,
    },
  }));
  const mod = await import('@/services/RevenueCatService');
  return mod.revenueCatService;
}

beforeEach(() => {
  jest.resetModules();
  mockIsFeatureEnabled.mockReturnValue(true);
  process.env = { ...ORIGINAL_ENV, EXPO_PUBLIC_RC_IOS_KEY: 'appl_test_key' };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.clearAllMocks();
});

describe('RevenueCatService ad tracking', () => {
  it('configures the SDK before tracking, so the ad path cannot hit throwIfNotConfigured', async () => {
    const { mod, adTracker } = mockPurchases();
    const service = await freshService();

    // Nothing has touched RevenueCat yet — this is the rewarded-ad-only player.
    await expect(service.trackAdRevenue(PAYLOAD)).resolves.toBe(true);

    expect(mod.configure).toHaveBeenCalledTimes(1);
    expect(adTracker.trackAdRevenue).toHaveBeenCalledWith(PAYLOAD);
  });

  it('forwards each lifecycle event to its matching tracker method', async () => {
    const { adTracker } = mockPurchases();
    const service = await freshService();

    const event = {
      mediatorName: 'AdMob',
      adFormat: 'interstitial',
      adUnitId: 'unit',
      impressionId: 'imp-2',
    };
    await service.trackAdLoaded(event);
    await service.trackAdDisplayed(event);
    await service.trackAdFailedToLoad({
      mediatorName: 'AdMob',
      adFormat: 'interstitial',
      adUnitId: 'unit',
      mediatorErrorCode: 3,
    });

    expect(adTracker.trackAdLoaded).toHaveBeenCalledWith(event);
    expect(adTracker.trackAdDisplayed).toHaveBeenCalledWith(event);
    expect(adTracker.trackAdFailedToLoad).toHaveBeenCalledWith(
      expect.objectContaining({ mediatorErrorCode: 3 }),
    );
    // Revenue is a separate event — a lifecycle call must never imply one.
    expect(adTracker.trackAdRevenue).not.toHaveBeenCalled();
  });

  it('resolves false instead of rejecting when the tracker rejects', async () => {
    mockPurchases({
      adTracker: { trackAdRevenue: jest.fn().mockRejectedValue(new Error('not configured')) },
    });
    const service = await freshService();

    await expect(service.trackAdRevenue(PAYLOAD)).resolves.toBe(false);
  });

  it('resolves false instead of rejecting when the tracker throws synchronously', async () => {
    mockPurchases({
      adTracker: {
        trackAdRevenue: jest.fn(() => {
          throw new Error('native bridge missing');
        }),
      },
    });
    const service = await freshService();

    await expect(service.trackAdRevenue(PAYLOAD)).resolves.toBe(false);
  });

  it('no-ops when the RevenueCat flag is off - ads can run without RC configured', async () => {
    const { mod, adTracker } = mockPurchases();
    mockIsFeatureEnabled.mockReturnValue(false);
    const service = await freshService();

    await expect(service.trackAdRevenue(PAYLOAD)).resolves.toBe(false);
    expect(mod.configure).not.toHaveBeenCalled();
    expect(adTracker.trackAdRevenue).not.toHaveBeenCalled();
    expect(service.supportsAdTracking()).toBe(false);
  });

  it('no-ops on an SDK build with no adTracker rather than throwing', async () => {
    mockPurchases({ adTracker: null });
    const service = await freshService();

    expect(service.supportsAdTracking()).toBe(false);
    await expect(service.trackAdRevenue(PAYLOAD)).resolves.toBe(false);
  });

  it('reports ad-tracking support when the flag, key and tracker are all present', async () => {
    mockPurchases();
    const service = await freshService();

    expect(service.supportsAdTracking()).toBe(true);
  });
});
