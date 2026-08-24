/**
 * The shared life record (2026-08-24 gameplay audit).
 *
 * `previousLives` entries carried seven fields while LegacyTimeline rendered
 * nine more that nothing wrote, and the death screen computed a life-quality
 * score and a ribbon and then discarded both. `buildLifeRecord` is the one
 * builder both prestige paths call; these tests pin what it captures, that it
 * degrades per-field instead of throwing at the worst possible moment, and
 * that the real `executePrestige` path actually stamps the rich record.
 */
import { hasRememberedLives } from '@/utils/lifeArchive';
import { buildLifeRecord } from '../lifeRecord';
import { executePrestige } from '@/lib/prestige/prestigeExecution';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

function livedInState(): GameState {
  const s = createTestGameState({
    weeksLived: 1040,
    generationNumber: 2,
    stats: { health: 64, happiness: 71, energy: 50, fitness: 40, money: 2_000_000, reputation: 80, gems: 10 },
    family: {
      ...createTestGameState().family,
      spouse: { id: 'sp1', name: 'Riley Stone', type: 'spouse', relationshipScore: 90, personality: 'warm', age: 40 } as never,
      children: [{ id: 'c1', name: 'Ash', age: 8 } as never, { id: 'c2', name: 'Bay', age: 5 } as never],
    },
    companies: [{ id: 'co1', name: 'Stoneworks', type: 'factory', weeklyIncome: 1500, level: 1 } as never],
    realEstate: [
      { id: 're1', name: 'House', price: 300_000, owned: true } as never,
      { id: 're2', name: 'Flat', price: 150_000, owned: false } as never,
    ],
    eventLog: [
      { id: 'e1', description: 'Won a massive contract.', choice: 'accept', week: 2, year: 2030, weeksLived: 500, category: 'general', effects: { money: 60_000 } } as never,
      { id: 'e2', description: 'A quiet week.', choice: 'ok', week: 3, year: 2030, weeksLived: 600, category: 'general', effects: { money: 5 } } as never,
    ],
  });
  s.lifetimeStatistics = {
    ...s.lifetimeStatistics,
    careerHistory: [
      { job: 'chef', weeks: 156, earnings: 40_000, startWeek: 0, endWeek: 156, title: 'Head Chef' },
      { job: 'ceo', weeks: 26, earnings: 90_000, startWeek: 200 },
    ],
  } as GameState['lifetimeStatistics'];
  return s;
}

describe('buildLifeRecord', () => {
  it('captures the base seven fields', () => {
    const record = buildLifeRecord(livedInState());
    expect(record.generation).toBe(2);
    expect(record.netWorth).toBeGreaterThan(0);
    expect(record.weeksLivedAtEnd).toBe(1040);
    expect(typeof record.timestamp).toBe('number');
    expect(Array.isArray(record.summaryAchievements)).toBe(true);
  });

  it('captures the fields LegacyTimeline always rendered and never received', () => {
    const record = buildLifeRecord(livedInState());
    expect(record.spouseName).toBe('Riley Stone');
    expect(record.totalChildren).toBe(2);
    expect(record.companiesOwned).toBe(1);
    expect(record.propertiesOwned).toBe(1); // the sold flat is excluded
    expect(record.totalWeeksWorked).toBe(182);
    expect(record.careerHistory).toEqual(['Head Chef — 3 yrs', 'ceo — 26 wks']);
    expect(record.memorableEvents).toEqual(['Won a massive contract.']);
    expect(record.happiness).toBe(71);
    expect(record.health).toBe(64);
  });

  it('stamps what the death screen used to compute and discard', () => {
    const record = buildLifeRecord(livedInState());
    expect(typeof record.lifeQualityScore).toBe('number');
    expect(record.lifeQualityScore).toBeGreaterThanOrEqual(0);
    expect(record.lifeQualityScore).toBeLessThanOrEqual(100);
    expect(typeof record.lifeQualityVerdict).toBe('string');
    expect(typeof record.ribbonId).toBe('string');
    expect(typeof record.ribbonName).toBe('string');
  });

  it('degrades per-field on a bare state instead of throwing', () => {
    const bare = createTestGameState();
    const record = buildLifeRecord(bare);
    expect(record.generation).toBe(1);
    expect(record.careerHistory).toBeUndefined();
    expect(record.spouseName).toBeUndefined();
    expect(record.memorableEvents).toBeUndefined();
    // The quality/ribbon pair still resolves — both are total functions.
    expect(typeof record.lifeQualityScore).toBe('number');
  });

  it('falls back to the relationships list for a spouse the family record lacks', () => {
    const s = livedInState();
    s.family = { ...s.family, spouse: undefined } as GameState['family'];
    s.relationships = [
      { id: 'r1', name: 'Sam Vale', type: 'spouse', relationshipScore: 88, personality: '', age: 39 } as never,
    ];
    expect(buildLifeRecord(s).spouseName).toBe('Sam Vale');
  });
});

describe('the real prestige path stamps the rich record', () => {
  it('reset-path previousLives gains a full record for the life that ended', () => {
    const state = livedInState();
    state.stats.money = 100_000_000; // clear every prestige threshold
    const next = executePrestige(state, 'reset');
    const lives = next.previousLives ?? [];
    expect(lives.length).toBeGreaterThan(0);
    const last = lives[lives.length - 1];
    expect(last.generation).toBe(2);
    expect(last.spouseName).toBe('Riley Stone');
    expect(last.careerHistory?.length).toBeGreaterThan(0);
    expect(typeof last.lifeQualityScore).toBe('number');
    expect(typeof last.ribbonName).toBe('string');
  });
});

describe('hasRememberedLives — the gate that made the archive reachable', () => {
  /**
   * The Legacy Timeline row was gated on `previousLives.length > 0`, and a
   * heirless death is exactly the case that leaves `previousLives` EMPTY while
   * filling the archive — so the archive's only surface was unreachable for
   * the players it exists for. Found by playing to a death in the running app.
   */
  it('opens for an archive-only player (the heirless death case)', () => {
    expect(hasRememberedLives([], 3)).toBe(true);
    expect(hasRememberedLives(undefined, 1)).toBe(true);
  });

  it('still opens for a dynasty with no archive', () => {
    expect(hasRememberedLives([{}, {}], 0)).toBe(true);
  });

  it('stays shut for a genuinely first life', () => {
    expect(hasRememberedLives([], 0)).toBe(false);
    expect(hasRememberedLives(undefined, undefined)).toBe(false);
  });

  it('ignores malformed inputs rather than throwing', () => {
    expect(hasRememberedLives('nope' as never, Number.NaN)).toBe(false);
  });
});
