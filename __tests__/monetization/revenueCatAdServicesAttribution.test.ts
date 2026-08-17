/**
 * Apple Ads (App Store Ads) attribution — AdServices token collection.
 *
 * `RevenueCatService.configure()` must ask the SDK to collect Apple's AdServices
 * attribution token on iOS. That token is the only thing joining an Apple Ads
 * install to the revenue it later produces; without it Apple Ads reports
 * installs, RevenueCat reports revenue, and no keyword-level ROAS exists.
 * See marketing/apple-ads/05-measurement-and-roi.md.
 *
 * The call must also be incapable of harming a purchase flow: missing on an
 * older SDK, rejecting, or throwing all have to leave configure() successful.
 *
 * Each test re-imports the service so the singleton and the lazily-required
 * native module start fresh.
 */

import type { isFeatureEnabled } from '@/lib/config/featureFlags';

// Hoist-safe: `mock*`-prefixed names are allowed inside a jest.mock factory, so
// the test can drive the flag directly instead of require()-ing the real module
// back out at runtime. Typed from the real signature so a change to
// isFeatureEnabled fails here at compile time rather than silently drifting.
const mockIsFeatureEnabled = jest.fn<
  ReturnType<typeof isFeatureEnabled>,
  Parameters<typeof isFeatureEnabled>
>(() => true);
jest.mock('@/lib/config/featureFlags', () => ({
  isFeatureEnabled: mockIsFeatureEnabled,
}));

const ORIGINAL_ENV = { ...process.env };


function mockPurchases(overrides: Record<string, any> = {}) {
  const mod = {
    configure: jest.fn(),
    enableAdServicesAttributionTokenCollection: jest.fn().mockResolvedValue(undefined),
    getCustomerInfo: jest.fn().mockResolvedValue({ entitlements: { active: {} } }),
    ...overrides,
  };
  jest.doMock('react-native-purchases', () => mod);
  return mod;
}


async function freshService(platform: 'ios' | 'android' = 'ios'): Promise<any> {
  jest.doMock('react-native', () => ({
    Platform: {
      OS: platform,

      select: (spec: Record<string, any>) => spec[platform] ?? spec.default,
    },
  }));
  const mod = await import('@/services/RevenueCatService');
  return mod.revenueCatService;
}

/** Let the fire-and-forget promise chain inside configure() settle. */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, EXPO_PUBLIC_RC_IOS_KEY: 'appl_test_key' };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('RevenueCatService — AdServices attribution', () => {
  it('enables AdServices token collection on iOS after configure', async () => {
    const P = mockPurchases();
    const service = await freshService('ios');

    expect(await service.configure()).toBe(true);
    await flush();

    expect(P.enableAdServicesAttributionTokenCollection).toHaveBeenCalledTimes(1);
  });

  it('enables it only once across repeated configure() calls', async () => {
    const P = mockPurchases();
    const service = await freshService('ios');

    await service.configure();
    await service.configure();
    await service.configure();
    await flush();

    // configure() short-circuits on `this.configured`, so the token collection
    // must not be re-armed on every subsequent call.
    expect(P.enableAdServicesAttributionTokenCollection).toHaveBeenCalledTimes(1);
  });

  it('does not call it on Android (AdServices is an Apple framework)', async () => {
    process.env.EXPO_PUBLIC_RC_ANDROID_KEY = 'goog_test_key';
    const P = mockPurchases();
    const service = await freshService('android');

    expect(await service.configure()).toBe(true);
    await flush();

    expect(P.enableAdServicesAttributionTokenCollection).not.toHaveBeenCalled();
  });

  it('still configures successfully when the SDK lacks the method', async () => {
    const P = mockPurchases({ enableAdServicesAttributionTokenCollection: undefined });
    const service = await freshService('ios');

    expect(await service.configure()).toBe(true);
    await flush();
    expect(P.configure).toHaveBeenCalledTimes(1);
  });

  it('still configures successfully when token collection rejects', async () => {
    const P = mockPurchases({
      enableAdServicesAttributionTokenCollection: jest
        .fn()
        .mockRejectedValue(new Error('AdServices unavailable')),
    });
    const service = await freshService('ios');

    expect(await service.configure()).toBe(true);
    await flush();

    expect(P.enableAdServicesAttributionTokenCollection).toHaveBeenCalledTimes(1);
    // A rejected attribution promise must not surface as an unhandled rejection
    // or flip the service into an unconfigured state.
    expect(await service.configure()).toBe(true);
  });

  it('still configures successfully when token collection throws synchronously', async () => {
    const P = mockPurchases({
      enableAdServicesAttributionTokenCollection: jest.fn(() => {
        throw new Error('native module missing');
      }),
    });
    const service = await freshService('ios');

    expect(await service.configure()).toBe(true);
    await flush();
    expect(P.enableAdServicesAttributionTokenCollection).toHaveBeenCalledTimes(1);
  });

  it('does not touch the SDK at all when RevenueCat is disabled', async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const P = mockPurchases();
    const service = await freshService('ios');

    expect(await service.configure()).toBe(false);
    await flush();

    expect(P.configure).not.toHaveBeenCalled();
    expect(P.enableAdServicesAttributionTokenCollection).not.toHaveBeenCalled();

    mockIsFeatureEnabled.mockReturnValue(true);
  });
});
