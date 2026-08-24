/**
 * Spark weekly tick — determinism guard.
 *
 * The "liked you" top-up (count / profile pick / super-like) previously used
 * Math.random(), making it save-scummable (reload → reroll) and inconsistent
 * under React StrictMode double-invoke. It now reuses the same seededRandom
 * helper as the jealousy branch. This test pins that: two runs on identical
 * state + week must produce byte-identical `likedYou` output.
 */
import { processSparkWeeklyTick } from '@/lib/dating/sparkTick';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { perksForTier } from '@/lib/dating/sparkLogic';
import type { GameState } from '@/contexts/game/types';

function freshState(overrides: Partial<GameState> = {}): GameState {
  const s = createTestGameState(overrides);
  if (s.sparkApp) s.sparkApp = JSON.parse(JSON.stringify(s.sparkApp));
  return s;
}

function withUltra(s: GameState): GameState {
  s.sparkApp!.premium = {
    active: true,
    tier: 'ultra',
    perks: perksForTier('ultra'),
  };
  s.sparkApp!.likedYou = [];
  s.lineageId = 'lineage-A';
  return s;
}

describe('processSparkWeeklyTick - liked-you determinism', () => {
  it('produces byte-identical likedYou entries across re-runs (Ultra)', () => {
    const r1 = processSparkWeeklyTick(withUltra(freshState({ weeksLived: 12 })), 13);
    const r2 = processSparkWeeklyTick(withUltra(freshState({ weeksLived: 12 })), 13);
    expect(r1.sparkApp.likedYou).toEqual(r2.sparkApp.likedYou);
    // Sanity: the top-up actually seeded at least one entry.
    expect(r1.sparkApp.likedYou.length).toBeGreaterThan(0);
  });

  it('produces byte-identical likedYou entries across re-runs (free tier teaser)', () => {
    const build = () => {
      const s = freshState({ weeksLived: 7 });
      s.sparkApp!.premium = { active: false, tier: 'free', perks: perksForTier('free') };
      s.sparkApp!.likedYou = [];
      s.lineageId = 'lineage-B';
      return s;
    };
    const r1 = processSparkWeeklyTick(build(), 8);
    const r2 = processSparkWeeklyTick(build(), 8);
    expect(r1.sparkApp.likedYou).toEqual(r2.sparkApp.likedYou);
  });
});
