import { createTestGameState } from '../helpers/createTestGameState';
import { executePrestige } from '@/lib/prestige/prestigeExecution';

/**
 * The Legacy Pass is SEASONAL (account-level), not per-life. Prestige rebuilds
 * GameState from initialGameState, so without explicit preservation a prestige
 * would silently wipe the player's battle-pass progress. These tests lock that in.
 */
describe('Legacy Pass survives prestige', () => {
  const withProgress = () =>
    createTestGameState({
      // Large bank balance so net worth clears the prestige threshold.
      bankSavings: 5_000_000_000,
      legacyPass: {
        seasonId: 'season-3',
        xp: 740,
        premiumOwned: true,
        claimedFreeTiers: [1, 2, 3],
        claimedPremiumTiers: [1],
        ownedCosmetics: ['legacy_theme_s_10'],
      },
    });

  it('preserves pass progress on the reset path', () => {
    const after = executePrestige(withProgress(), 'reset');
    expect(after.legacyPass).toEqual({
      seasonId: 'season-3',
      xp: 740,
      premiumOwned: true,
      claimedFreeTiers: [1, 2, 3],
      claimedPremiumTiers: [1],
      ownedCosmetics: ['legacy_theme_s_10'],
    });
  });

  it('does not share the same object reference (no cross-life mutation)', () => {
    const before = withProgress();
    const after = executePrestige(before, 'reset');
    expect(after.legacyPass).not.toBe(before.legacyPass);
  });
});
