/**
 * rewardedAd — outcome plumbing.
 *
 * Locks two invariants:
 *  1. A no-fill courtesy grant (ads ON, no inventory, grantOnNoFill honored) is
 *     reported as a DISTINCT `granted-no-fill` outcome — never conflated with the
 *     ads-removed `granted-direct` path. Surfaces (the reward orb) rely on this to
 *     rate-limit the no-ad courtesy grant so it can't become a repeatable faucet.
 *  2. display == grant: `grant` runs exactly once on every granted outcome and
 *     never on a true no-fill / error.
 */
import {
  isGranted,
  isNoFillGrant,
  runRewardedAd,
  type RewardedAdOutcome,
} from '@/lib/ads/rewardedAd';

// adMob ON for these tests so `adsAvailable` is true (Platform.OS is 'ios' via
// jest.setup) — this is the branch that can hit no-fill.
jest.mock('@/lib/config/featureFlags', () => ({
  isFeatureEnabled: (flag: string) => flag === 'adMob',
}));

const mockShowRewardedAd = jest.fn();
jest.mock('@/services/AdMobService', () => ({
  adMobService: {
    showRewardedAd: (...args: unknown[]) => mockShowRewardedAd(...args),
  },
}));

const ALL_OUTCOMES: RewardedAdOutcome[] = [
  'granted-ad',
  'granted-direct',
  'granted-no-fill',
  'no-fill',
  'error',
];

describe('rewardedAd outcome helpers', () => {
  it('isGranted is true for every granted variant, false otherwise', () => {
    expect(isGranted('granted-ad')).toBe(true);
    expect(isGranted('granted-direct')).toBe(true);
    expect(isGranted('granted-no-fill')).toBe(true);
    expect(isGranted('no-fill')).toBe(false);
    expect(isGranted('error')).toBe(false);
  });

  it('isNoFillGrant is true ONLY for the no-fill courtesy grant', () => {
    expect(isNoFillGrant('granted-no-fill')).toBe(true);
    ALL_OUTCOMES.filter((o) => o !== 'granted-no-fill').forEach((o) =>
      expect(isNoFillGrant(o)).toBe(false),
    );
  });
});

describe('runRewardedAd - grant path is distinguishable and display == grant', () => {
  beforeEach(() => mockShowRewardedAd.mockReset());

  it('grantOnNoFill on a no-fill honours the reward as granted-no-fill (grant once)', async () => {
    mockShowRewardedAd.mockResolvedValue(false); // no inventory to serve
    const grant = jest.fn();
    const outcome = await runRewardedAd(grant, { grantOnNoFill: true });
    expect(outcome).toBe('granted-no-fill');
    expect(isNoFillGrant(outcome)).toBe(true);
    expect(isGranted(outcome)).toBe(true);
    expect(grant).toHaveBeenCalledTimes(1); // display == grant preserved
  });

  it('without grantOnNoFill a no-fill does NOT grant', async () => {
    mockShowRewardedAd.mockResolvedValue(false);
    const grant = jest.fn();
    const outcome = await runRewardedAd(grant, {});
    expect(outcome).toBe('no-fill');
    expect(grant).not.toHaveBeenCalled();
  });

  it('a real ad that fills is granted-ad (NOT no-fill) and grants once', async () => {
    mockShowRewardedAd.mockImplementation(async (g: () => void) => {
      g();
      return true;
    });
    const grant = jest.fn();
    const outcome = await runRewardedAd(grant, { grantOnNoFill: true });
    expect(outcome).toBe('granted-ad');
    expect(isNoFillGrant(outcome)).toBe(false);
    expect(grant).toHaveBeenCalledTimes(1);
  });

  it('a thrown ad error with grantOnNoFill is honoured as granted-no-fill', async () => {
    mockShowRewardedAd.mockRejectedValue(new Error('sdk boom'));
    const grant = jest.fn();
    const outcome = await runRewardedAd(grant, { grantOnNoFill: true });
    expect(outcome).toBe('granted-no-fill');
    expect(grant).toHaveBeenCalledTimes(1);
  });

  it('ads-removed grants directly with no ad shown (paid perk, not no-fill)', async () => {
    const grant = jest.fn();
    const outcome = await runRewardedAd(grant, { adsRemoved: true, grantOnNoFill: true });
    expect(outcome).toBe('granted-direct');
    expect(isNoFillGrant(outcome)).toBe(false);
    expect(grant).toHaveBeenCalledTimes(1);
    expect(mockShowRewardedAd).not.toHaveBeenCalled();
  });
});
