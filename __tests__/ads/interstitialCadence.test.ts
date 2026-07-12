/**
 * Frequency-cap / breakpoint logic for the interstitial helper.
 */
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('@/lib/config/featureFlags', () => ({
  isFeatureEnabled: (flag: string) => flag === 'adMob',
}));

const showInterstitialAd = jest.fn().mockResolvedValue(true);
jest.mock('@/services/AdMobService', () => ({
  adMobService: { showInterstitialAd },
}));

import {
  maybeShowInterstitialForWeek,
  __resetInterstitialCadence,
} from '@/lib/ads/interstitial';

// WEEKS_PER_YEAR = 52 → grace ends at 104 weeks; boundaries are multiples of 52.
const BOUNDARY = 104; // first year boundary past the 2-year grace

beforeEach(() => {
  __resetInterstitialCadence();
  showInterstitialAd.mockClear();
});

describe('maybeShowInterstitialForWeek', () => {
  it('shows at a year boundary once the grace period has passed', async () => {
    await expect(maybeShowInterstitialForWeek(BOUNDARY, {})).resolves.toBe(true);
    expect(showInterstitialAd).toHaveBeenCalledTimes(1);
  });

  it('does not show when ads are removed', async () => {
    await expect(
      maybeShowInterstitialForWeek(BOUNDARY, { adsRemoved: true }),
    ).resolves.toBe(false);
    expect(showInterstitialAd).not.toHaveBeenCalled();
  });

  it('does not show while a blocking popup is up', async () => {
    await expect(
      maybeShowInterstitialForWeek(BOUNDARY, { blocked: true }),
    ).resolves.toBe(false);
    expect(showInterstitialAd).not.toHaveBeenCalled();
  });

  it('does not show off a year boundary', async () => {
    await expect(maybeShowInterstitialForWeek(BOUNDARY + 1, {})).resolves.toBe(false);
    expect(showInterstitialAd).not.toHaveBeenCalled();
  });

  it('does not show during the early-game grace period', async () => {
    // 52 is a year boundary but inside the 2-year grace window.
    await expect(maybeShowInterstitialForWeek(52, {})).resolves.toBe(false);
    expect(showInterstitialAd).not.toHaveBeenCalled();
  });

  it('enforces the real-time frequency cap across consecutive boundaries', async () => {
    await expect(maybeShowInterstitialForWeek(BOUNDARY, {})).resolves.toBe(true);
    // The very next boundary arrives immediately (rapid advancing) → capped.
    await expect(maybeShowInterstitialForWeek(BOUNDARY + 52, {})).resolves.toBe(false);
    expect(showInterstitialAd).toHaveBeenCalledTimes(1);
  });
});
