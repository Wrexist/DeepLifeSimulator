/**
 * "Prestige Ready" must be reachable, and the net-worth headline must be the
 * canonical one.
 *
 * UX-1: the chapter goal read `state.prestigeAvailable`, a flag that is only
 * ever written FALSE — `prestigeExecution` resets it and nothing in normal play
 * sets it true (only DevTools does). So the goal could never complete, its
 * reward was permanently unclaimable, and the home PrestigeButton gated on the
 * same flag was dead code. Its progress bar was broken twice over: it divided by
 * a hardcoded $100M — ten times the real $10M threshold — and capped at 0.9.
 *
 * 2026-07-28 audit UX-1.
 */
import { LIFE_CHAPTERS, getChapterProgress } from '../lifeChapters';
import { isPrestigeAvailable, getPrestigeThreshold, BASE_PRESTIGE_THRESHOLD } from '@/lib/prestige/prestigeTypes';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const CHAPTER = LIFE_CHAPTERS.find((c) => c.goals.some((g) => g.id === 'ch5_prestige_ready'))!;
const GOAL = CHAPTER.goals.find((g) => g.id === 'ch5_prestige_ready')!;

function withCash(money: number, overrides: Partial<GameState> = {}): GameState {
  const base = createTestGameState();
  return createTestGameState({
    weeksLived: 900,
    stats: { ...base.stats, money },
    ...overrides,
  });
}

describe('ch5_prestige_ready completes on merit, not on a dead flag', () => {
  it('completes at the real threshold with the flag never set', () => {
    const rich = withCash(BASE_PRESTIGE_THRESHOLD + 1);
    expect(rich.prestigeAvailable).toBeFalsy(); // the flag stays false in normal play
    expect(GOAL.checkComplete(rich)).toBe(true);
  });

  it('does not complete below the threshold', () => {
    expect(GOAL.checkComplete(withCash(BASE_PRESTIGE_THRESHOLD - 1_000))).toBe(false);
  });

  it('still honours the flag when something does set it (DevTools)', () => {
    expect(GOAL.checkComplete(withCash(0, { prestigeAvailable: true }))).toBe(true);
  });

  it('fills the progress bar all the way, not to 0.9', () => {
    expect(GOAL.checkProgress(withCash(BASE_PRESTIGE_THRESHOLD))).toBe(1);
  });

  it('reports progress against the real threshold, not a 10x-too-large one', () => {
    // Half of $10M should read ~50%, not ~5% (the old $100M divisor).
    const half = GOAL.checkProgress(withCash(BASE_PRESTIGE_THRESHOLD / 2));
    expect(half).toBeGreaterThan(0.4);
    expect(half).toBeLessThan(0.6);
  });

  it('scales with prestige level, like the threshold does', () => {
    const level2 = { prestige: { prestigeLevel: 2, prestigePoints: 0 } } as Partial<GameState>;
    const atFirstThreshold = withCash(BASE_PRESTIGE_THRESHOLD + 1, level2);
    expect(getPrestigeThreshold(2)).toBeGreaterThan(BASE_PRESTIGE_THRESHOLD);
    expect(GOAL.checkComplete(atFirstThreshold)).toBe(false); // needs more at level 2
  });

  it('lets the chapter itself reach 100% (the reward becomes claimable)', () => {
    // Every goal in the chapter satisfied via the flag except the one under
    // test, which is satisfied on merit.
    const rich = withCash(BASE_PRESTIGE_THRESHOLD * 5);
    const progress = getChapterProgress(CHAPTER, rich);
    const prestigeGoal = progress.goals.find((g) => g.id === 'ch5_prestige_ready')!;
    expect(prestigeGoal.complete).toBe(true);
    expect(prestigeGoal.progress).toBe(1);
  });
});

describe('isPrestigeAvailable is the shared answer', () => {
  it('agrees with the chapter goal', () => {
    for (const money of [0, BASE_PRESTIGE_THRESHOLD - 1, BASE_PRESTIGE_THRESHOLD, BASE_PRESTIGE_THRESHOLD * 3]) {
      const state = withCash(money);
      expect(isPrestigeAvailable(state)).toBe(GOAL.checkComplete(state));
    }
  });

  it('counts more than cash - assets move it too', () => {
    const base = createTestGameState();
    const withSavings = createTestGameState({
      weeksLived: 900,
      stats: { ...base.stats, money: BASE_PRESTIGE_THRESHOLD / 2 },
      bankSavings: BASE_PRESTIGE_THRESHOLD,
    });
    expect(isPrestigeAvailable(withSavings)).toBe(true);
  });
});
