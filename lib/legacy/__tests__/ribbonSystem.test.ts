/**
 * Ribbon system — earned-log growth bounds.
 *
 * The `earned` array is an append-only, one-entry-per-life log that persists
 * across every prestige. These tests pin the two guards that keep it from
 * growing without bound (hard cap, drop-oldest) or double-counting a single
 * death (exact-duplicate suppression), while proving that genuinely distinct
 * cross-life repeats of the same ribbon are preserved.
 */
import type { GameState } from '@/contexts/game/types';
import { createTestGameState, type TestGameStateOverrides } from '@/__tests__/helpers/createTestGameState';
import {
  addRibbonToCollection,
  classifyLife,
  MAX_EARNED_RIBBONS,
  RIBBONS,
  type RibbonDefinition,
} from '@/lib/legacy/ribbonSystem';

function freshState(overrides: TestGameStateOverrides = {}): GameState {
  return createTestGameState(overrides);
}

const ordinary = RIBBONS.find((r) => r.id === 'ribbon_ordinary') as RibbonDefinition;
const centenarian = RIBBONS.find((r) => r.id === 'ribbon_centenarian') as RibbonDefinition;

describe('ribbonSystem - addRibbonToCollection', () => {
  it('appends one entry per life and records the ribbon id in discoveredIds', () => {
    const state = freshState({ generationNumber: 1 });
    const collection = addRibbonToCollection(undefined, ordinary, state);
    expect(collection.earned).toHaveLength(1);
    expect(collection.earned[0].ribbonId).toBe('ribbon_ordinary');
    expect(collection.discoveredIds).toContain('ribbon_ordinary');
  });

  it('preserves meaningful cross-life repeats of the same ribbon', () => {
    let collection = addRibbonToCollection(undefined, ordinary, freshState({ generationNumber: 1 }));
    collection = addRibbonToCollection(collection, ordinary, freshState({ generationNumber: 2 }));
    collection = addRibbonToCollection(collection, ordinary, freshState({ generationNumber: 3 }));
    // Same ribbon across three distinct lives → three log entries.
    expect(collection.earned).toHaveLength(3);
    expect(collection.earned.map((e) => e.generation)).toEqual([1, 2, 3]);
    // But the discovered set collapses the id.
    expect(collection.discoveredIds).toEqual(['ribbon_ordinary']);
  });

  it('suppresses an exact-duplicate re-award of the most recent entry', () => {
    const state = freshState({ generationNumber: 5 });
    const first = addRibbonToCollection(undefined, ordinary, state);
    const firstEntry = first.earned[0];
    // Re-run with an existing collection whose last entry is byte-identical to
    // what this call would produce (same generation/age/name/timestamp) — the
    // reducer-double-invoke case. It must NOT append a second copy.
    const preloaded: GameState['ribbonCollection'] = {
      earned: [{ ...firstEntry }],
      discoveredIds: ['ribbon_ordinary'],
    };
    const dedup = jest
      .spyOn(Date, 'now')
      .mockReturnValue(firstEntry.earnedTimestamp);
    try {
      const second = addRibbonToCollection(preloaded, ordinary, state);
      expect(second.earned).toHaveLength(1);
    } finally {
      dedup.mockRestore();
    }
  });

  it('caps the earned log at MAX_EARNED_RIBBONS, dropping oldest first', () => {
    let collection: GameState['ribbonCollection'] = { earned: [], discoveredIds: [] };
    const total = MAX_EARNED_RIBBONS + 50;
    for (let gen = 0; gen < total; gen++) {
      collection = addRibbonToCollection(collection, ordinary, freshState({ generationNumber: gen }));
    }
    expect(collection.earned).toHaveLength(MAX_EARNED_RIBBONS);
    // Oldest 50 generations were dropped; the first retained is generation 50.
    expect(collection.earned[0].generation).toBe(total - MAX_EARNED_RIBBONS);
    // Newest preserved.
    expect(collection.earned[collection.earned.length - 1].generation).toBe(total - 1);
  });

  it('tolerates a malformed collection without throwing', () => {
    // A collection missing the arrays (CloudSync merge / hand-edit) must not crash.
    // DELIBERATE-CORRUPTION: the garbage shape IS the fixture — a save that
    // arrived without the arrays is exactly what this test proves survivable,
    // and no valid value can express it.
    const malformed = { foo: 'bar' } as unknown as GameState['ribbonCollection'];
    const state = freshState({ generationNumber: 1 });
    expect(() => addRibbonToCollection(malformed, centenarian, state)).not.toThrow();
    const result = addRibbonToCollection(malformed, centenarian, state);
    expect(result.earned).toHaveLength(1);
    expect(result.discoveredIds).toContain('ribbon_centenarian');
  });
});

describe('ribbonSystem - classifyLife', () => {
  it('always returns a ribbon (ordinary fallback matches every life)', () => {
    const ribbon = classifyLife(freshState());
    expect(ribbon).toBeTruthy();
    expect(typeof ribbon.id).toBe('string');
  });
});
