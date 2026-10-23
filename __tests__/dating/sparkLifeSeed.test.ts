/**
 * S3 (owner decisions, 2026-10-23): Spark's seeds are keyed on the LIFE.
 *
 * The catfish, jealousy and liked-you seeds folded in `lineageId` alone, and an
 * heir keeps the lineage (only `generationNumber` moves), so an heir drew the
 * parent's Spark rolls. The swipe roll folded in nothing per-life at all - just
 * the handle, which is 'player' for most lives.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { isCatfish, rollMatch, sparkLifeSeed } from '@/lib/dating/sparkLogic';
import { DATING_PROFILES } from '@/lib/dating/datingProfiles';

const life = (lineageId: string, generationNumber: number): GameState =>
  createTestGameState({ lineageId, generationNumber, weeksLived: 2_000 });

describe('sparkLifeSeed', () => {
  it('generation 1 keeps the bare lineage spelling, so no first-life save re-rolls a catfish flag', () => {
    expect(sparkLifeSeed(life('lin-a', 1), 'initial')).toBe('lin-a');
  });

  it('an heir folds in the generation', () => {
    expect(sparkLifeSeed(life('lin-a', 2), 'initial')).not.toBe(sparkLifeSeed(life('lin-a', 1), 'initial'));
    expect(sparkLifeSeed(life('lin-a', 3), 'initial')).not.toBe(sparkLifeSeed(life('lin-a', 2), 'initial'));
  });

  it("keeps each call site's fallback for a missing lineage", () => {
    expect(sparkLifeSeed({ generationNumber: 1 }, 'init')).toBe('init');
  });
});

describe("an heir does not replay the parent's Spark rolls", () => {
  it('catfish flags differ across generations', () => {
    // The shipped deck has almost no profile above the 5% floor, so use a
    // deliberately suspicious one (capped at 65%) under many ids.
    const suspicious = Array.from({ length: 40 }, (_, i) => ({
      ...DATING_PROFILES[0],
      id: `sus-${i}`,
      wealth: 'millionaire' as const,
      job: 'Student',
      income: 50_000,
      bio: 'send crypto',
    }));
    const flags = (s: GameState) => suspicious.map((p) => isCatfish(p, sparkLifeSeed(s, 'initial'))).join();
    expect(flags(life('lin-a', 2))).not.toBe(flags(life('lin-a', 1)));
    expect(flags(life('lin-a', 1))).toBe(flags(life('lin-a', 1)));
  });

  it('swipe outcomes differ between generations of the same lineage', () => {
    const outcomes = (s: GameState) =>
      DATING_PROFILES.flatMap((p) => [2_000, 2_001, 2_002].map((w) => rollMatch(s, p, w))).join();
    expect(outcomes(life('lin-a', 2))).not.toBe(outcomes(life('lin-a', 1)));
  });

  it('and are still deterministic within one life', () => {
    const p = DATING_PROFILES[3];
    expect(rollMatch(life('lin-a', 1), p, 2_000)).toBe(rollMatch(life('lin-a', 1), p, 2_000));
  });
});
