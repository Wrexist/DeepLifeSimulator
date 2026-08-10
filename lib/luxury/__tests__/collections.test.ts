/**
 * Luxury Collections — completion sets over the existing catalog.
 *
 * The properties worth pinning are the balance guarantees, not the data: sets
 * must never pay cash, never push reputation past the ceiling the per-item path
 * already respects, and never produce an unbounded hosting multiplier. Those are
 * the three ways a "nice completion meta" turns into an economy bug.
 */

import { LUXURY_CATALOG, LUXURY_REPUTATION_CAP } from '../catalog';
import { getGuestList, quoteEvent } from '../hosting';
import {
  LUXURY_COLLECTIONS,
  MAX_COLLECTION_HOSTING_MULTIPLIER,
  getAllCollectionProgress,
  getCollectionHostingMultiplier,
  getCollectionProgress,
  getCollectionReputationBonus,
  getCompletedCollections,
  getLuxuryTitle,
  getNextCollectionTarget,
} from '../collections';

const ALL_IDS = LUXURY_CATALOG.map((i) => i.id);
const byId = (id: string) => LUXURY_COLLECTIONS.find((c) => c.id === id)!;

describe('collection definitions', () => {
  it('references only real catalog ids', () => {
    const known = new Set(ALL_IDS);
    for (const c of LUXURY_COLLECTIONS) {
      const unknown = c.itemIds.filter((id) => !known.has(id));
      expect(`${c.id}:${unknown.join(',')}`).toBe(`${c.id}:`);
    }
  });

  it('has no empty set (an empty set would grant a title for owning nothing)', () => {
    for (const c of LUXURY_COLLECTIONS) {
      expect(c.itemIds.length).toBeGreaterThan(0);
    }
  });

  it('uses unique ids and unique titles', () => {
    expect(new Set(LUXURY_COLLECTIONS.map((c) => c.id)).size).toBe(LUXURY_COLLECTIONS.length);
    expect(new Set(LUXURY_COLLECTIONS.map((c) => c.title)).size).toBe(LUXURY_COLLECTIONS.length);
  });

  it('grants no weekly cash — luxury stays a sink', () => {
    // The catalog's central rule: a trophy that pays for itself stops being a
    // trophy. Sets grant standing and hosting only, never income.
    for (const c of LUXURY_COLLECTIONS) {
      const fields = Object.keys(c);
      expect(fields).not.toContain('yield');
      expect(fields).not.toContain('weeklyCash');
      expect(fields).not.toContain('money');
    }
  });

  it('derives tier sets from the catalog rather than hardcoding them', () => {
    const ultra = LUXURY_CATALOG.filter((i) => i.tier === 'ultra').map((i) => i.id);
    expect(byId('set_ultra').itemIds.sort()).toEqual([...ultra].sort());
  });

  it('the complete set covers the whole catalog', () => {
    expect(byId('set_complete').itemIds.sort()).toEqual([...ALL_IDS].sort());
  });
});

describe('progress', () => {
  it('reports nothing complete for a player who owns nothing', () => {
    expect(getCompletedCollections([])).toEqual([]);
    expect(getCompletedCollections(undefined)).toEqual([]);
    expect(getCompletedCollections(null)).toEqual([]);
  });

  it('counts partial ownership without completing', () => {
    const entry = byId('set_entry');
    const p = getCollectionProgress(entry, [entry.itemIds[0]]);
    expect(p.owned).toBe(1);
    expect(p.complete).toBe(false);
    expect(p.missingIds).toEqual(entry.itemIds.slice(1));
  });

  it('completes a set when every item is owned', () => {
    const entry = byId('set_entry');
    const p = getCollectionProgress(entry, entry.itemIds);
    expect(p.complete).toBe(true);
    expect(p.missingIds).toEqual([]);
    expect(p.owned).toBe(p.total);
  });

  it('ignores unrelated owned ids', () => {
    const entry = byId('set_entry');
    const p = getCollectionProgress(entry, [...entry.itemIds, 'not_a_real_item']);
    expect(p.complete).toBe(true);
    expect(p.owned).toBe(p.total);
  });

  it('completes every set when the whole catalog is owned', () => {
    const all = getAllCollectionProgress(ALL_IDS);
    expect(all.every((p) => p.complete)).toBe(true);
  });
});

describe('title', () => {
  it('is undefined until a set is complete', () => {
    expect(getLuxuryTitle([])).toBeUndefined();
    expect(getLuxuryTitle([ALL_IDS[0]])).toBeUndefined();
  });

  it('is the highest-value completed set', () => {
    expect(getLuxuryTitle(byId('set_entry').itemIds)).toBe('Collector');
    expect(getLuxuryTitle(ALL_IDS)).toBe('Curator of the Age');
  });
});

describe('reputation bonus', () => {
  it('is zero with nothing complete', () => {
    expect(getCollectionReputationBonus([])).toBe(0);
  });

  it('adds across completed sets', () => {
    const entry = byId('set_entry');
    expect(getCollectionReputationBonus(entry.itemIds)).toBe(entry.reputationBonus);
  });

  it('never exceeds the ceiling the per-item path already respects', () => {
    // The guarantee that matters: owning everything completes all seven sets, and
    // the sum of their bonuses must still not rail past LUXURY_REPUTATION_CAP.
    const raw = LUXURY_COLLECTIONS.reduce((s, c) => s + c.reputationBonus, 0);
    expect(getCollectionReputationBonus(ALL_IDS)).toBe(Math.min(raw, LUXURY_REPUTATION_CAP));
    expect(getCollectionReputationBonus(ALL_IDS)).toBeLessThanOrEqual(LUXURY_REPUTATION_CAP);
  });
});

describe('hosting multiplier', () => {
  it('is exactly 1 with nothing complete — no silent change for most players', () => {
    expect(getCollectionHostingMultiplier([])).toBe(1);
  });

  it('compounds across completed sets', () => {
    const entry = byId('set_entry');
    expect(getCollectionHostingMultiplier(entry.itemIds)).toBeCloseTo(entry.hostingMultiplier, 5);
  });

  it('is bounded even when every set is complete', () => {
    const full = getCollectionHostingMultiplier(ALL_IDS);
    expect(full).toBeLessThanOrEqual(MAX_COLLECTION_HOSTING_MULTIPLIER);
    // And the cap actually binds here — otherwise the test proves nothing.
    const uncapped = LUXURY_COLLECTIONS.reduce((m, c) => m * c.hostingMultiplier, 1);
    expect(uncapped).toBeGreaterThan(MAX_COLLECTION_HOSTING_MULTIPLIER);
    expect(full).toBe(MAX_COLLECTION_HOSTING_MULTIPLIER);
  });
});

describe('hosting integration', () => {
  // The set bonus raises the HOST'S STANDING, which is a different concept from
  // the guest list (whose +60% ceiling is its own documented invariant). Folding
  // it into `guests.multiplier` broke that invariant, so it lands on the payoff
  // in quoteEvent instead. These pin the separation.
  const stateWith = (ids: string[]) => ({ luxuryItems: ids }) as never;

  it('leaves the guest-list multiplier alone', () => {
    const complete = getGuestList(stateWith(ALL_IDS));
    expect(complete.multiplier).toBeLessThanOrEqual(1.6);
  });

  // Real ids: 'private_island' is a venue, 'gala' is a tier. An early-return
  // escape hatch here would let these pass while asserting nothing, so the
  // quotes are asserted non-null instead.
  const quote = (ids: string[]) => {
    const q = quoteEvent(stateWith(ids), 'private_island', 'gala');
    expect(q).not.toBeNull();
    return q!;
  };

  it('raises the payoff of an event for a complete collection', () => {
    const bare = quote(['private_island']);
    const full = quote(ALL_IDS);

    expect(full.reputation).toBeGreaterThan(bare.reputation);
    expect(full.happiness).toBeGreaterThan(bare.happiness);
  });

  it('does not make entertaining more expensive', () => {
    // Completing a collection must never read as a punishment.
    expect(quote(ALL_IDS).cost).toBe(quote(['private_island']).cost);
  });
});

describe('next target', () => {
  it('points at the cheapest real progress available', () => {
    const next = getNextCollectionTarget([]);
    expect(next).toBeDefined();
    const fewest = Math.min(...LUXURY_COLLECTIONS.map((c) => c.itemIds.length));
    expect(next!.missingIds.length).toBe(fewest);
  });

  it('is undefined once everything is owned', () => {
    expect(getNextCollectionTarget(ALL_IDS)).toBeUndefined();
  });

  it('advances as the player buys', () => {
    const entry = byId('set_entry');
    const next = getNextCollectionTarget(entry.itemIds.slice(0, 1));
    expect(next!.missingIds.length).toBeGreaterThan(0);
    // The set they are one item away from must not still read as the target
    // once it is finished.
    expect(getNextCollectionTarget(entry.itemIds)?.collection.id).not.toBe('set_entry');
  });
});
