/**
 * A purchase belongs to the PLAYER, not to the character.
 *
 * Both prestige paths rebuild the game state from `initialGameState`, including
 * `settings: { ...initialGameState.settings }` — and every purchased entitlement
 * flag lives on `settings`. So prestiging silently erased up to ~$150 of real
 * money: Remove Ads came back, lifetime premium vanished, the nine gem-bought
 * "forever" gold upgrades were gone, unspent youth pills disappeared.
 *
 * The death → "continue as your heir" flow goes through the same builder and is
 * NOT gated on having prestiged, so an ordinary player who simply lost a
 * character could lose their purchases with no warning.
 *
 * The DeepLife+ claim stamps re-arming was the same bug pointing the other way:
 * a printer. Prestige, re-claim the 500-gem welcome bonus, repeat.
 *
 * 2026-07-30 audit MON-1 / MON-2 / MON-3 / MON-12 / ECON-R1-01 / ECON-R1-02.
 */
import { executePrestige, continueAsChild } from '@/lib/prestige/prestigeExecution';
import {
  PURCHASED_SETTINGS_KEYS,
  PURCHASED_STATE_KEYS,
  carryAccountLevelEntitlements,
} from '@/lib/prestige/accountEntitlements';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

/** Every gem-bought permanent upgrade. */
const ALL_GOLD_UPGRADES = {
  multiplier: true,
  energy_boost: true,
  happiness_boost: true,
  fitness_boost: true,
  skill_mastery: true,
  time_machine: true,
  immortality: true,
  tycoon: true,
  chronomaster: true,
};

/** A player who has bought essentially everything, at the prestige threshold. */
function bigSpender(overrides: Partial<GameState> = {}): GameState {
  const base = createTestGameState();
  return createTestGameState({
    weeksLived: 2000,
    stats: { ...base.stats, money: 500_000_000, gems: 4_000 },
    settings: {
      ...base.settings,
      adsRemoved: true,
      adsRemovedDate: '2026-01-01T00:00:00.000Z',
      lifetimePremium: true,
      everythingUnlocked: true,
      unlimitedYouthPills: true,
      moneyMultiplier: true,
      hasRevivalPack: true,
      premiumCreditCard: true,
      financialPlanning: true,
      businessBanking: true,
      privateBanking: true,
      deepLifePlusActivated: true,
      deepLifePlusWelcomeClaimed: true,
      deepLifePlusGemClaimDays: 12,
    } as never,
    goldUpgrades: ALL_GOLD_UPGRADES,
    perks: { workBoost: true, mindset: true, fastLearner: true, goodCredit: true, unlockAllPerks: true },
    youthPills: 7,
    family: {
      ...base.family,
      children: [{ id: 'heir-1', name: 'Ada', age: 20, gender: 'female' }],
    } as never,
    ...overrides,
  });
}

const settingsOf = (s: GameState) => (s.settings ?? {}) as unknown as Record<string, unknown>;
const stateOf = (s: GameState) => s as unknown as Record<string, unknown>;

describe('the entitlement manifest covers what purchases actually write', () => {
  it('lists every settings flag the IAP benefit applier sets', () => {
    // If a new purchasable flag is added without adding it here, it dies at the
    // next prestige — so this list is the contract, and it must be complete.
    for (const key of [
      'adsRemoved',
      'lifetimePremium',
      'everythingUnlocked',
      'unlimitedYouthPills',
      'moneyMultiplier',
      'hasRevivalPack',
      'premiumCreditCard',
      'financialPlanning',
      'businessBanking',
      'privateBanking',
      'deepLifePlusActivated',
    ]) {
      expect(PURCHASED_SETTINGS_KEYS as readonly string[]).toContain(key);
    }
  });

  it('carries the DeepLife+ claim stamps, which is what closed the gem printer', () => {
    for (const key of ['deepLifePlusWelcomeClaimed', 'deepLifePlusLastGemClaim', 'deepLifePlusGemClaimDays']) {
      expect(PURCHASED_SETTINGS_KEYS as readonly string[]).toContain(key);
    }
  });

  it('carries the top-level purchased collections', () => {
    expect(PURCHASED_STATE_KEYS as readonly string[]).toEqual(
      expect.arrayContaining(['goldUpgrades', 'perks', 'youthPills']),
    );
  });
});

describe.each([
  ['prestige reset', (s: GameState) => executePrestige(s, 'reset')],
  ['prestige as child', (s: GameState) => executePrestige(s, 'child', 'heir-1')],
  ['the ungated death -> continue as heir flow', (s: GameState) => continueAsChild(s, 'heir-1')],
])('a purchase survives %s', (_label, run) => {
  it('keeps every purchased settings flag', () => {
    const before = bigSpender();
    const after = run(before);
    const s = settingsOf(after);

    expect(s.adsRemoved).toBe(true);
    expect(s.lifetimePremium).toBe(true);
    expect(s.everythingUnlocked).toBe(true);
    expect(s.unlimitedYouthPills).toBe(true);
    expect(s.moneyMultiplier).toBe(true);
    expect(s.hasRevivalPack).toBe(true);
    expect(s.premiumCreditCard).toBe(true);
    expect(s.financialPlanning).toBe(true);
    expect(s.businessBanking).toBe(true);
    expect(s.privateBanking).toBe(true);
    expect(s.deepLifePlusActivated).toBe(true);
    expect(s.adsRemovedDate).toBe('2026-01-01T00:00:00.000Z');
  });

  it('keeps all nine gem-bought gold upgrades', () => {
    const after = run(bigSpender());
    expect(stateOf(after).goldUpgrades).toMatchObject(ALL_GOLD_UPGRADES);
  });

  it('keeps purchased perks and unspent youth pills', () => {
    const after = run(bigSpender());

    expect(stateOf(after).perks).toMatchObject({ unlockAllPerks: true, workBoost: true });
    // Unspent consumable inventory the player paid for.
    expect(stateOf(after).youthPills).toBe(7);
  });

  it('does NOT re-arm the DeepLife+ claim stamps — that was a gem printer', () => {
    const after = run(bigSpender());
    const s = settingsOf(after);

    // Re-arming these let a player prestige, re-claim the 500-gem welcome bonus
    // and the 250-gem daily, and repeat indefinitely.
    expect(s.deepLifePlusWelcomeClaimed).toBe(true);
    expect(s.deepLifePlusGemClaimDays).toBe(12);
  });

  it('still resets the per-CHARACTER things prestige exists to reset', () => {
    const after = run(bigSpender());

    // The whole point of prestige: money and the life start over.
    expect(after.stats.money).toBeLessThan(500_000_000);
    expect(after.weeksLived).toBeLessThan(2000);
  });

  it('does not invent entitlements a free player never bought', () => {
    const freePlayer = createTestGameState({
      weeksLived: 2000,
      stats: { ...createTestGameState().stats, money: 500_000_000, gems: 100 },
      family: {
        ...createTestGameState().family,
        children: [{ id: 'heir-1', name: 'Ada', age: 20, gender: 'female' }],
      } as never,
    });

    const s = settingsOf(run(freePlayer));

    expect(s.adsRemoved).not.toBe(true);
    expect(s.lifetimePremium).not.toBe(true);
    expect(stateOf(run(freePlayer)).youthPills ?? 0).toBe(0);
  });
});

describe('carryAccountLevelEntitlements in isolation', () => {
  it('leaves an absent flag absent rather than writing undefined', () => {
    // A key set to `undefined` breaks a `'key' in settings` check, which is a
    // different bug wearing the same clothes.
    const old = createTestGameState();
    const fresh = createTestGameState();

    carryAccountLevelEntitlements(old, fresh);

    expect('adsRemoved' in settingsOf(fresh) && settingsOf(fresh).adsRemoved === undefined).toBe(false);
  });

  it('does not alias the old state, so the new life cannot mutate the dead one', () => {
    const old = bigSpender();
    const fresh = createTestGameState();

    carryAccountLevelEntitlements(old, fresh);
    (stateOf(fresh).goldUpgrades as Record<string, boolean>).multiplier = false;

    expect((stateOf(old).goldUpgrades as Record<string, boolean>).multiplier).toBe(true);
  });

  it('survives a garbage or missing settings object on either side', () => {
    const old = createTestGameState({ settings: undefined as never });
    const fresh = createTestGameState({ settings: undefined as never });

    expect(() => carryAccountLevelEntitlements(old, fresh)).not.toThrow();
  });

  it('never writes through into the settings object it was handed', () => {
    // This function mutates `newState` by design — that is how it drops into
    // the existing builder style. But it must not write into the settings
    // OBJECT it received, because both builders happen to pass a fresh
    // `{ ...initialGameState.settings }` and one future caller passing a
    // shallow `{ ...initialGameState }` would be handing over the singleton's
    // own settings object. One player's purchases would then be stamped onto
    // the template every later new game is built from — permanently, in
    // memory, with no save involved.
    //
    // Nobody has made that mistake; this makes it unmakeable.
    const old = bigSpender();
    const shared = createTestGameState().settings;
    const fresh = createTestGameState();
    fresh.settings = shared; // the aliasing a careless caller would create

    carryAccountLevelEntitlements(old, fresh);

    expect(settingsOf(fresh).adsRemoved).toBe(true); // the copy still happened
    expect('adsRemoved' in shared && shared.adsRemoved === true).toBe(false);
  });
});
