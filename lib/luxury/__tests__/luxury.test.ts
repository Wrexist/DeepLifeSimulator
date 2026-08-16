/**
 * Luxury & Collectibles — unit tests.
 * Covers catalog integrity, purchase affordability/deduction (incl. double-tap
 * atomicity), sell refund, weekly upkeep + benefit, net-worth contribution, and
 * the un-orphaned `luxury_life` completion predicate.
 */

import type { GameState } from '@/contexts/game/types';
import {
  LUXURY_CATALOG,
  LUXURY_RESALE_FRACTION,
  LUXURY_LIFE_MIN_ITEMS,
  LUXURY_LIFE_VALUE_THRESHOLD,
  getLuxuryResaleValue,
  getTotalLuxuryResaleValue,
  getTotalLuxuryUpkeep,
  getOwnedLuxuryItems,
  isLuxuryLifeComplete,
  canAffordLuxuryItem,
} from '@/lib/luxury';
import { purchaseLuxuryItem, sellLuxuryItem } from '@/contexts/game/actions/LuxuryActions';
import { applyLuxuryItemsForWeek } from '@/contexts/game/actions/weekly/applyLuxuryItems';
import { netWorth } from '@/lib/progress/achievements';
import type { WeekContext } from '@/contexts/game/actions/weekly/weekContext';
import { createTestGameState, type TestGameStateOverrides } from '@/__tests__/helpers/createTestGameState';

// --- test helpers -----------------------------------------------------------

/** Minimal React-setState-like store so we can exercise the real actions. */
function makeStore(initial: GameState) {
  let state = initial;
  const setGameState = (updater: any) => {
    state = typeof updater === 'function' ? updater(state) : updater;
  };
  return { get: () => state, setGameState };
}

function baseState(over: TestGameStateOverrides = {}): GameState {
  // Stats are merged rather than replaced so a caller naming only `money` still
  // gets this file's pinned baseline (reputation 10, happiness 50, …) instead of
  // initialState's defaults — the behaviour the hand-built literal had.
  const { stats, ...rest } = over;
  return createTestGameState({
    luxuryItems: [],
    ...rest,
    stats: { money: 0, happiness: 50, energy: 50, fitness: 50, health: 50, reputation: 10, gems: 0, ...(stats ?? {}) },
  });
}

function makeCtx(stats: Partial<GameState['stats']>): WeekContext {
  return {
    newStats: {
      money: 0, happiness: 0, energy: 0, fitness: 0, health: 0, reputation: 0, gems: 0,
      ...stats,
    },
    notifications: [],
    preRolls: {} as any,
    nextWeeksLived: 1,
  };
}

// --- catalog integrity ------------------------------------------------------

describe('luxury catalog integrity', () => {
  it('has ~12 items spanning $250k to $500M with valid, unique fields', () => {
    expect(LUXURY_CATALOG.length).toBeGreaterThanOrEqual(10);
    expect(LUXURY_CATALOG.length).toBeLessThanOrEqual(14);
    expect(LUXURY_CATALOG[0].price).toBe(250_000);
    expect(LUXURY_CATALOG[LUXURY_CATALOG.length - 1].price).toBe(500_000_000);

    const ids = new Set<string>();
    const validTiers = new Set(['entry', 'premium', 'elite', 'ultra']);
    for (const item of LUXURY_CATALOG) {
      expect(typeof item.id).toBe('string');
      expect(item.id.length).toBeGreaterThan(0);
      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);

      expect(item.name.length).toBeGreaterThan(0);
      expect(item.emoji.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
      expect(validTiers.has(item.tier)).toBe(true);

      expect(item.price).toBeGreaterThan(0);
      expect(Number.isFinite(item.price)).toBe(true);
      // Upkeep is small (< 1% of price / week) but non-zero.
      expect(item.weeklyUpkeep).toBeGreaterThan(0);
      expect(item.weeklyUpkeep).toBeLessThan(item.price * 0.01);
      // Benefits modest.
      expect(item.happiness).toBeGreaterThanOrEqual(0);
      expect(item.happiness).toBeLessThanOrEqual(10);
      expect(item.prestige).toBeGreaterThan(0);
      expect(item.prestige).toBeLessThanOrEqual(20);
    }
  });

  it('prices are strictly ascending (a clear escalation ladder)', () => {
    for (let i = 1; i < LUXURY_CATALOG.length; i++) {
      expect(LUXURY_CATALOG[i].price).toBeGreaterThan(LUXURY_CATALOG[i - 1].price);
    }
  });

  it('resale value is the configured fraction of price', () => {
    const item = LUXURY_CATALOG[0];
    expect(getLuxuryResaleValue(item)).toBe(Math.floor(item.price * LUXURY_RESALE_FRACTION));
  });
});

// --- purchase ---------------------------------------------------------------

describe('purchaseLuxuryItem', () => {
  it('deducts exactly the price from stats.money and grants the item', () => {
    const store = makeStore(baseState({ stats: { money: 300_000 } }));
    const res = purchaseLuxuryItem(store.get(), store.setGameState, 'rare_watch_collection');
    expect(res.success).toBe(true);
    expect(store.get().stats.money).toBe(50_000); // 300k - 250k
    expect(store.get().luxuryItems).toContain('rare_watch_collection');
  });

  it('rejects when unaffordable — no deduction, no grant', () => {
    const store = makeStore(baseState({ stats: { money: 100_000 } }));
    const res = purchaseLuxuryItem(store.get(), store.setGameState, 'rare_watch_collection');
    expect(res.success).toBe(false);
    expect(store.get().stats.money).toBe(100_000);
    expect(store.get().luxuryItems || []).not.toContain('rare_watch_collection');
  });

  it('rejects a duplicate purchase of an already-owned item', () => {
    const store = makeStore(baseState({ stats: { money: 1_000_000 } }));
    purchaseLuxuryItem(store.get(), store.setGameState, 'rare_watch_collection');
    const moneyAfterFirst = store.get().stats.money;
    const res = purchaseLuxuryItem(store.get(), store.setGameState, 'rare_watch_collection');
    expect(res.success).toBe(false);
    expect(store.get().stats.money).toBe(moneyAfterFirst); // not charged twice
    expect(store.get().luxuryItems!.filter((id) => id === 'rare_watch_collection')).toHaveLength(1);
  });

  it('is atomic against a double-tap using a stale snapshot (charges once)', () => {
    const store = makeStore(baseState({ stats: { money: 300_000 } }));
    const stale = store.get(); // both taps read this pre-update snapshot
    purchaseLuxuryItem(stale, store.setGameState, 'rare_watch_collection');
    purchaseLuxuryItem(stale, store.setGameState, 'rare_watch_collection');
    expect(store.get().stats.money).toBe(50_000); // charged once, not to -200k
    expect(store.get().luxuryItems!.filter((id) => id === 'rare_watch_collection')).toHaveLength(1);
  });
});

// --- sell -------------------------------------------------------------------

describe('sellLuxuryItem', () => {
  it('refunds the resale fraction and removes the item', () => {
    const store = makeStore(baseState({ stats: { money: 0 }, luxuryItems: ['rare_watch_collection'] }));
    const res = sellLuxuryItem(store.get(), store.setGameState, 'rare_watch_collection');
    expect(res.success).toBe(true);
    expect(store.get().stats.money).toBe(Math.floor(250_000 * LUXURY_RESALE_FRACTION)); // 150k
    expect(store.get().luxuryItems).not.toContain('rare_watch_collection');
  });

  it('buy→sell loses value (a sink, never a farm)', () => {
    const store = makeStore(baseState({ stats: { money: 250_000 } }));
    purchaseLuxuryItem(store.get(), store.setGameState, 'rare_watch_collection');
    sellLuxuryItem(store.get(), store.setGameState, 'rare_watch_collection');
    expect(store.get().stats.money).toBeLessThan(250_000); // round-trip is lossy
  });
});

// --- weekly upkeep + benefit ------------------------------------------------

describe('applyLuxuryItemsForWeek', () => {
  it('deducts total upkeep from money and adds happiness', () => {
    const ctx = makeCtx({ money: 100_000, happiness: 50, reputation: 3 });
    const { upkeep, yield: produced } = applyLuxuryItemsForWeek(['luxury_yacht'], ctx); // upkeep 20k, hap 3, prestige 7
    expect(upkeep).toBe(getTotalLuxuryUpkeep(['luxury_yacht']));
    // The yacht charters when the player isn't aboard, so the week is
    // upkeep MINUS that income — still a net cost, just not the full sticker.
    expect(produced).toBeGreaterThan(0);
    expect(produced).toBeLessThan(upkeep);
    expect(ctx.newStats.money).toBe(100_000 + produced - upkeep);
    expect(ctx.newStats.happiness).toBe(53);
  });

  it('nudges reputation toward the prestige soft target but never past it', () => {
    const ctx = makeCtx({ money: 100_000, reputation: 3 });
    applyLuxuryItemsForWeek(['luxury_yacht'], ctx); // prestige 7 → target 7, rep 3 < 7
    expect(ctx.newStats.reputation).toBe(4); // +1 step
  });

  it('never lowers reputation already above the soft target', () => {
    const ctx = makeCtx({ money: 100_000, reputation: 80 });
    applyLuxuryItemsForWeek(['luxury_yacht'], ctx); // target 7, rep 80 → unchanged
    expect(ctx.newStats.reputation).toBe(80);
  });

  it('money floors at 0 and is a no-op with nothing owned', () => {
    // Broke week: yield is credited before upkeep is charged, so an insolvent
    // player nets ZERO rather than pocketing the charter income for free.
    const ctx = makeCtx({ money: 1_000 });
    applyLuxuryItemsForWeek(['luxury_yacht'], ctx); // upkeep 20k > 1k cash + 11k yield
    expect(ctx.newStats.money).toBe(0);

    const ctx2 = makeCtx({ money: 5_000, happiness: 40 });
    const res = applyLuxuryItemsForWeek([], ctx2);
    expect(res.upkeep).toBe(0);
    expect(ctx2.newStats.money).toBe(5_000);
    expect(ctx2.newStats.happiness).toBe(40);
  });
});

// --- net worth --------------------------------------------------------------

describe('net worth contribution', () => {
  it('owned luxury adds its resale value to net worth', () => {
    const withLux = baseState({ stats: { money: 1_000_000 }, luxuryItems: ['sports_team_stake'] });
    const resale = getTotalLuxuryResaleValue(['sports_team_stake']); // 0.6 * 500M = 300M
    expect(netWorth(withLux)).toBe(1_000_000 + resale);

    const noLux = baseState({ stats: { money: 1_000_000 }, luxuryItems: [] });
    expect(netWorth(noLux)).toBe(1_000_000);
  });

  it('resale value counted is less than money paid (buying luxury is a sink)', () => {
    const item = LUXURY_CATALOG.find((i) => i.id === 'sports_team_stake')!;
    expect(getLuxuryResaleValue(item)).toBeLessThan(item.price);
  });
});

// --- luxury_life completion (un-orphaned goal) ------------------------------

describe('isLuxuryLifeComplete', () => {
  it('is false for old/empty saves (null-safe)', () => {
    expect(isLuxuryLifeComplete(undefined)).toBe(false);
    expect(isLuxuryLifeComplete([])).toBe(false);
  });

  it(`completes at ${LUXURY_LIFE_MIN_ITEMS} owned items`, () => {
    const ids = LUXURY_CATALOG.slice(0, LUXURY_LIFE_MIN_ITEMS).map((i) => i.id);
    expect(isLuxuryLifeComplete(ids)).toBe(true);
    expect(isLuxuryLifeComplete(ids.slice(0, LUXURY_LIFE_MIN_ITEMS - 1))).toBe(false);
  });

  it('completes on a single high-value trophy (value threshold path)', () => {
    // One $500M item is well past the value threshold.
    expect(isLuxuryLifeComplete(['sports_team_stake'])).toBe(true);
  });

  it('demands a real collection, not an errand', () => {
    // Audit C3: the bar used to be 3 items or $25M — about 2% of the catalog's
    // total value, reachable with the two cheapest items plus one more.
    const catalogValue = LUXURY_CATALOG.reduce((sum, i) => sum + i.price, 0);
    expect(LUXURY_LIFE_MIN_ITEMS).toBeGreaterThanOrEqual(LUXURY_CATALOG.length / 2);
    expect(LUXURY_LIFE_VALUE_THRESHOLD / catalogValue).toBeGreaterThan(0.1);

    // The cheapest half of the catalog must not clear the VALUE path by itself,
    // or the item-count path would be meaningless.
    const cheapHalf = [...LUXURY_CATALOG]
      .sort((a, b) => a.price - b.price)
      .slice(0, LUXURY_LIFE_MIN_ITEMS - 1)
      .map((i) => i.id);
    expect(isLuxuryLifeComplete(cheapHalf)).toBe(false);
  });

  it('ignores unknown ids and duplicates', () => {
    expect(getOwnedLuxuryItems(['nope', 'nope', 'rare_watch_collection', 'rare_watch_collection']))
      .toHaveLength(1);
    expect(canAffordLuxuryItem(249_999, 'rare_watch_collection')).toBe(false);
    expect(canAffordLuxuryItem(250_000, 'rare_watch_collection')).toBe(true);
  });
});
