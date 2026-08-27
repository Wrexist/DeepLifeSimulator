/**
 * A fresh start keeps what the player OWNS.
 *
 * "Start New Life" deletes the slot and rebuilds from onboarding, which
 * spreads `initialGameState` - so gems, purchase flags, gold upgrades, perks,
 * youth pills and the unspent Revival Pack charge all came back as template
 * defaults. Prestige and the heir path carry them; the fresh start was the one
 * transition that burned them, and the confirm dialog disclosed it rather than
 * fixing it.
 *
 * The three properties that matter here, and why:
 *  - ONE-SHOT. Gems live in the save, one balance per slot. A record that
 *    survives being read is a gem duplicator.
 *  - `perks` UNION. The builder has already written the player's onboarding
 *    picks; a straight copy of the purchased perks would discard them.
 *  - `gems` REPLACE, never add - adding re-mints any starting grant on every
 *    fresh start.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import {
  extractNewLifeCarryOver,
  applyNewLifeCarryOver,
  stashNewLifeCarryOver,
  consumeNewLifeCarryOver,
  clearNewLifeCarryOver,
} from '@/utils/newLifeCarryOver';
import { PURCHASED_STATE_KEYS } from '@/lib/prestige/accountEntitlements';
import { safeSetItem, safeGetItem } from '@/utils/safeStorage';

/**
 * The global AsyncStorage mock (jest.setup.js) is a no-op whose `getItem`
 * always resolves null, which would make every round-trip below vacuously
 * "work" by returning nothing. These cases are about persistence, so they need
 * a store that actually stores.
 */
jest.mock('@react-native-async-storage/async-storage', () => {
  const mockStore = new Map<string, string>();
  const api = {
    setItem: jest.fn((k: string, v: string) => {
      mockStore.set(k, v);
      return Promise.resolve();
    }),
    getItem: jest.fn((k: string) => Promise.resolve(mockStore.has(k) ? mockStore.get(k)! : null)),
    removeItem: jest.fn((k: string) => {
      mockStore.delete(k);
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      mockStore.clear();
      return Promise.resolve();
    }),
    getAllKeys: jest.fn(() => Promise.resolve([...mockStore.keys()])),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    multiRemove: jest.fn(() => Promise.resolve()),
  };
  return { __esModule: true, default: api, ...api };
});

/** A player who has spent real money and has gems in hand. */
const bigSpender = () => {
  const s: any = createTestGameState();
  s.stats.gems = 750;
  s.settings = {
    ...s.settings,
    adsRemoved: true,
    lifetimePremium: true,
    hasRevivalPack: true,
    privateBanking: true,
    deepLifePlusActivated: true,
  };
  s.goldUpgrades = { ...(s.goldUpgrades ?? {}), multiplier: true, time_machine: true };
  s.perks = { ...(s.perks ?? {}), workBoost: true, fastLearner: true };
  s.youthPills = 3;
  s.revivalPack = true;
  return s;
};

/** What onboarding hands back: template defaults + this life's perk picks. */
const freshlyBuilt = () => {
  const s: any = createTestGameState();
  s.stats.gems = 0;
  s.settings = { ...s.settings, adsRemoved: false, lifetimePremium: false, hasRevivalPack: false };
  s.goldUpgrades = {};
  s.perks = { lucky_charm: true, iron_will: true }; // chosen during onboarding
  s.youthPills = 0;
  s.revivalPack = false;
  return s;
};

describe('extract + apply', () => {
  it('carries gems, purchase flags, upgrades, pills and the revive charge', () => {
    const applied: any = applyNewLifeCarryOver(extractNewLifeCarryOver(bigSpender()), freshlyBuilt());

    expect(applied.stats.gems).toBe(750);
    expect(applied.settings.adsRemoved).toBe(true);
    expect(applied.settings.lifetimePremium).toBe(true);
    expect(applied.settings.privateBanking).toBe(true);
    expect(applied.settings.deepLifePlusActivated).toBe(true);
    expect(applied.goldUpgrades.multiplier).toBe(true);
    expect(applied.goldUpgrades.time_machine).toBe(true);
    expect(applied.youthPills).toBe(3);
    expect(applied.revivalPack).toBe(true);
  });

  it('UNIONS perks - the onboarding picks survive alongside the purchased ones', () => {
    const applied: any = applyNewLifeCarryOver(extractNewLifeCarryOver(bigSpender()), freshlyBuilt());
    // Purchased.
    expect(applied.perks.workBoost).toBe(true);
    expect(applied.perks.fastLearner).toBe(true);
    // Chosen this life - a straight copy would have dropped these.
    expect(applied.perks.lucky_charm).toBe(true);
    expect(applied.perks.iron_will).toBe(true);
  });

  it('REPLACES gems rather than adding, so a fresh start cannot mint them', () => {
    const built: any = freshlyBuilt();
    built.stats.gems = 100; // pretend the template ever grants a starting balance
    const applied: any = applyNewLifeCarryOver(extractNewLifeCarryOver(bigSpender()), built);
    expect(applied.stats.gems).toBe(750);
  });

  it('does NOT carry the dynasty - that reset is the point of a fresh start', () => {
    const old: any = bigSpender();
    old.legacyPoints = 4200;
    old.prestige = { ...(old.prestige ?? {}), totalPrestiges: 7 };
    old.ribbonCollection = { discoveredIds: ['a', 'b', 'c'] };
    const carry: any = extractNewLifeCarryOver(old);
    expect(carry.legacyPoints).toBeUndefined();
    expect(carry.prestige).toBeUndefined();
    expect(carry.ribbonCollection).toBeUndefined();
  });

  it('is a no-op for an ordinary new game (nothing pending)', () => {
    const built = freshlyBuilt();
    const applied: any = applyNewLifeCarryOver(null, built);
    expect(applied.stats.gems).toBe(0);
    expect(applied.settings.lifetimePremium).toBe(false);
    expect(applied.perks).toEqual({ lucky_charm: true, iron_will: true });
  });

  it('leaves an absent purchase flag absent rather than writing undefined', () => {
    const plain: any = createTestGameState();
    plain.settings = { ...plain.settings };
    delete plain.settings.lifetimePremium;
    const carry = extractNewLifeCarryOver(plain);
    expect('lifetimePremium' in carry.settings).toBe(false);
  });

  it('the unspent revive charge is on the shared purchase list, not just here', () => {
    // It has to carry across prestige and the heir path too - this pins that
    // the fix landed in the single source of truth.
    expect(PURCHASED_STATE_KEYS as readonly string[]).toContain('revivalPack');
  });
});

describe('stash / consume round trip', () => {
  beforeEach(async () => {
    await clearNewLifeCarryOver();
  });

  it('round-trips through storage', async () => {
    expect(await stashNewLifeCarryOver(bigSpender())).toBe(true);
    const carry = await consumeNewLifeCarryOver();
    expect(carry).not.toBeNull();
    expect(carry!.stats.gems).toBe(750);
    expect(carry!.settings.lifetimePremium).toBe(true);
  });

  it('is ONE-SHOT: a second consume returns nothing (no gem duplication)', async () => {
    await stashNewLifeCarryOver(bigSpender());
    expect(await consumeNewLifeCarryOver()).not.toBeNull();
    expect(await consumeNewLifeCarryOver()).toBeNull();
  });

  it('returns null when nothing is pending', async () => {
    expect(await consumeNewLifeCarryOver()).toBeNull();
  });

  it('a second fresh start replaces the pending record rather than stacking', async () => {
    await stashNewLifeCarryOver(bigSpender());
    const poorer: any = createTestGameState();
    poorer.stats.gems = 5;
    await stashNewLifeCarryOver(poorer);
    const carry = await consumeNewLifeCarryOver();
    expect(carry!.stats.gems).toBe(5);
  });

  it('rejects a tampered record instead of granting what it claims', async () => {
    // A hand-written record - no valid envelope. Granting on this would make
    // the file a state-injection vector (gems + Lifetime Premium on demand).
    await safeSetItem(
      'new_life_carry_over_v1',
      JSON.stringify({ stats: { gems: 999999 }, settings: { lifetimePremium: true } }),
    );
    expect(await consumeNewLifeCarryOver()).toBeNull();
  });

  it('drops a rejected record too, so it cannot be retried', async () => {
    await safeSetItem('new_life_carry_over_v1', 'not-an-envelope');
    await consumeNewLifeCarryOver();
    expect(await safeGetItem('new_life_carry_over_v1')).toBeNull();
  });
});
