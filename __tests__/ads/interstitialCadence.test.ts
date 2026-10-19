/**
 * The plain interstitial is the year-end FALLBACK, paced by the same decision
 * as the rewarded break (`decideYearEndBreak`). Before the ad audit of
 * 2026-10-19 it checked only the grace and a 3-minute floor, so a working
 * interstitial unit would have shown at every boundary past the session cap,
 * and to payers.
 */
import {
  maybeShowInterstitialForWeek,
  __resetInterstitialCadence,
} from '@/lib/ads/interstitial';
import { YEAR_END_BREAK } from '@/lib/ads/yearEndBreak';

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('@/lib/config/featureFlags', () => ({
  isFeatureEnabled: (flag: string) => flag === 'adMob',
}));

const showInterstitialAd = jest.fn().mockResolvedValue(true);
const isReady = jest.fn(() => true);
jest.mock('@/services/AdMobService', () => ({
  adMobService: { showInterstitialAd, isReady },
}));

// The shared ad session, controllable per test.
const session = { startedAt: 0, lastFullscreenAt: 0, lastRewardedAt: 0, yearEndOffered: 0 };
jest.mock('@/lib/ads/adSession', () => ({
  adSessionSnapshot: () => ({ ...session }),
  noteYearEndOffered: () => {
    session.yearEndOffered++;
  },
}));

// WEEKS_PER_YEAR = 52 → grace ends at 104 weeks; boundaries are multiples of 52.
const BOUNDARY = 104; // first year boundary past the 2-year grace
const NOW = 10 * 60 * 1000; // ten minutes into the session: past the warm-up
const GAP = YEAR_END_BREAK.minGapMs;

beforeEach(() => {
  __resetInterstitialCadence();
  showInterstitialAd.mockClear();
  showInterstitialAd.mockResolvedValue(true);
  isReady.mockReturnValue(true);
  Object.assign(session, { startedAt: 0, lastFullscreenAt: 0, lastRewardedAt: 0, yearEndOffered: 0 });
});

describe('maybeShowInterstitialForWeek', () => {
  it('shows at a year boundary once the grace period has passed', async () => {
    await expect(maybeShowInterstitialForWeek(BOUNDARY, { now: NOW })).resolves.toBe(true);
    expect(showInterstitialAd).toHaveBeenCalledTimes(1);
  });

  it('does not show when ads are removed', async () => {
    await expect(maybeShowInterstitialForWeek(BOUNDARY, { adsRemoved: true, now: NOW })).resolves.toBe(false);
    expect(showInterstitialAd).not.toHaveBeenCalled();
  });

  it('does not show while a blocking popup is up', async () => {
    await expect(maybeShowInterstitialForWeek(BOUNDARY, { blocked: true, now: NOW })).resolves.toBe(false);
    expect(showInterstitialAd).not.toHaveBeenCalled();
  });

  it('does not show off a year boundary', async () => {
    await expect(maybeShowInterstitialForWeek(BOUNDARY + 1, { now: NOW })).resolves.toBe(false);
    expect(showInterstitialAd).not.toHaveBeenCalled();
  });

  it('does not show during the early-game grace period', async () => {
    // 52 is a year boundary but inside the 2-year grace window.
    await expect(maybeShowInterstitialForWeek(52, { now: NOW })).resolves.toBe(false);
    expect(showInterstitialAd).not.toHaveBeenCalled();
  });

  it('never shows to a paying player', async () => {
    await expect(maybeShowInterstitialForWeek(BOUNDARY, { isPayer: true, now: NOW })).resolves.toBe(false);
    expect(showInterstitialAd).not.toHaveBeenCalled();
  });

  it('never shows in the first minutes of a session', async () => {
    await expect(maybeShowInterstitialForWeek(BOUNDARY, { now: 60 * 1000 })).resolves.toBe(false);
    expect(showInterstitialAd).not.toHaveBeenCalled();
  });

  it('waits out the cooldown after a rewarded ad the player chose', async () => {
    session.lastRewardedAt = NOW - 60 * 1000;
    await expect(maybeShowInterstitialForWeek(BOUNDARY, { now: NOW })).resolves.toBe(false);
    expect(showInterstitialAd).not.toHaveBeenCalled();
  });

  it('enforces the floor between fullscreen ads across consecutive boundaries', async () => {
    await expect(maybeShowInterstitialForWeek(BOUNDARY, { now: NOW })).resolves.toBe(true);
    // The very next boundary arrives immediately (rapid advancing) → floored.
    await expect(maybeShowInterstitialForWeek(BOUNDARY + 52, { now: NOW + 1_000 })).resolves.toBe(false);
    // After the floor it can show again.
    await expect(maybeShowInterstitialForWeek(BOUNDARY + 104, { now: NOW + GAP + 1 })).resolves.toBe(true);
    expect(showInterstitialAd).toHaveBeenCalledTimes(2);
  });

  it('shares the per-session cap with the rewarded break', async () => {
    session.yearEndOffered = YEAR_END_BREAK.maxPerSession;
    await expect(maybeShowInterstitialForWeek(BOUNDARY, { now: NOW })).resolves.toBe(false);
    expect(showInterstitialAd).not.toHaveBeenCalled();
  });

  it('does not try when no interstitial is loaded', async () => {
    isReady.mockReturnValue(false);
    await expect(maybeShowInterstitialForWeek(BOUNDARY, { now: NOW })).resolves.toBe(false);
    expect(showInterstitialAd).not.toHaveBeenCalled();
  });

  it('does not arm the floor when no ad was shown', async () => {
    showInterstitialAd.mockResolvedValueOnce(false); // no-fill
    await expect(maybeShowInterstitialForWeek(BOUNDARY, { now: NOW })).resolves.toBe(false);
    // Floor was NOT armed, so the next eligible boundary can still show.
    await expect(maybeShowInterstitialForWeek(BOUNDARY + 52, { now: NOW + 1_000 })).resolves.toBe(true);
    expect(showInterstitialAd).toHaveBeenCalledTimes(2);
  });

  it('a no-fill does not use up the session cap', async () => {
    session.yearEndOffered = YEAR_END_BREAK.maxPerSession - 1;
    showInterstitialAd.mockResolvedValueOnce(false); // no-fill
    await expect(maybeShowInterstitialForWeek(BOUNDARY, { now: NOW })).resolves.toBe(false);
    expect(session.yearEndOffered).toBe(YEAR_END_BREAK.maxPerSession - 1);
    await expect(maybeShowInterstitialForWeek(BOUNDARY + 52, { now: NOW + 1_000 })).resolves.toBe(true);
    expect(session.yearEndOffered).toBe(YEAR_END_BREAK.maxPerSession);
  });

  it('swallows errors from showInterstitialAd and returns false', async () => {
    showInterstitialAd.mockRejectedValueOnce(new Error('Ad network down'));
    await expect(maybeShowInterstitialForWeek(BOUNDARY, { now: NOW })).resolves.toBe(false);
    expect(showInterstitialAd).toHaveBeenCalledTimes(1);
  });
});
