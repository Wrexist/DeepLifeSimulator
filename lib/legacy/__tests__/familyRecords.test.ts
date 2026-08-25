/**
 * Family records - the derived self-competition board (2026-08-25 round 2).
 *
 * Derived-only over previousLives + the live life; deliberately NOT read from
 * `prestige.lifetimeStats.maxNetWorth`, which updates only at executePrestige
 * and under-reports for players who die rather than prestige.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { familyRecords } from '@/lib/legacy/records';

function withLives(lives: unknown[], overrides: Parameters<typeof createTestGameState>[0] = {}): GameState {
  return createTestGameState({ previousLives: lives as never, ...overrides });
}

const life = (over: Record<string, unknown> = {}) => ({
  generation: 1,
  netWorth: 100_000,
  ageAtDeath: 70,
  timestamp: 1,
  ...over,
});

describe('familyRecords', () => {
  it('is empty on a first life - a board of zeros is noise', () => {
    expect(familyRecords(createTestGameState({ previousLives: [] }))).toEqual([]);
    expect(familyRecords(createTestGameState({ previousLives: undefined }))).toEqual([]);
    expect(familyRecords(null)).toEqual([]);
  });

  it('finds the best finished life per metric and names the holder', () => {
    const state = withLives([
      life({ generation: 1, name: 'Ada', netWorth: 500_000, lifeQualityScore: 40 }),
      life({ generation: 2, name: 'Brook', netWorth: 4_200_000, lifeQualityScore: 72, companiesOwned: 3 }),
    ]);
    const rows = familyRecords(state);
    const richest = rows.find((r) => r.id === 'richest');
    expect(richest?.best).toBe(4_200_000);
    expect(richest?.bestHolder).toBe('Gen 2 · Brook');
    const quality = rows.find((r) => r.id === 'quality');
    expect(quality?.best).toBe(72);
  });

  it('flags when the LIVE life has already passed a record', () => {
    const state = withLives(
      [life({ netWorth: 1_000 })],
      { stats: { money: 50_000 } },
    );
    const richest = familyRecords(state).find((r) => r.id === 'richest');
    expect(richest?.currentLeads).toBe(true);
  });

  it('omits rows whose record is zero and survives malformed entries', () => {
    const state = withLives([
      null,
      life({ netWorth: Number.NaN, ageAtDeath: 60, companiesOwned: 0 }),
    ]);
    const rows = familyRecords(state);
    expect(rows.find((r) => r.id === 'companies')).toBeUndefined();
    expect(rows.find((r) => r.id === 'longest')?.best).toBe(60);
  });

  it('never throws on a malformed state', () => {
    expect(() => familyRecords({ previousLives: [{}] } as unknown as GameState)).not.toThrow();
  });
});
