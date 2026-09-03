/**
 * The "Get qualified" SOON goal — Master Program 10 (2026-09-03).
 *
 * The measured entry-tier life: a janitor tops out at $200/wk by week ~80,
 * banks ~$120/wk, and the home feed never points at the first rung off the
 * ladder even though the cheapest certificate ($12k) is affordable from week
 * ~20. The goal is eligible for exactly that player and for nobody who has
 * already started or finished a programme.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { GOAL_CATALOGUE } from '@/lib/goals/catalogue';
import { recommendGoals } from '@/lib/goals/engine';
import { EDUCATION_PROGRAMS } from '@/lib/education/programs';

const goal = GOAL_CATALOGUE.find((g) => g.id === 'soon_get_qualified');
if (!goal) throw new Error('soon_get_qualified missing from the catalogue');

/** A janitor at the ladder ceiling, tier 2 by wealth, with $9k and no schooling. */
function ceilingJanitor(extra: Partial<GameState> = {}): GameState {
  const base = createTestGameState();
  return createTestGameState({
    currentJob: 'janitor',
    careers: base.careers.map((c) =>
      c.id === 'janitor' ? { ...c, accepted: true, applied: true, level: 5, currentLevel: 5 } : c,
    ),
    stats: { ...base.stats, money: 9_000 },
    educations: [],
    completedChapters: ['ch1_fresh_start', 'ch2_settling_in'],
    ...extra,
  });
}

describe('soon_get_qualified', () => {
  it('is eligible for an entry-ladder worker with the Education app open and no schooling', () => {
    expect(goal!.isEligible(ceilingJanitor())).toBe(true);
  });

  it('measures cash against the cheapest paid programme, so the bar moves with saving', () => {
    const cheapest = Math.min(...EDUCATION_PROGRAMS.filter((p) => p.cost > 0).map((p) => p.cost));
    expect(goal!.measure(ceilingJanitor())).toEqual({ current: 9_000, target: cheapest });
    expect(goal!.measure(ceilingJanitor({ stats: { ...createTestGameState().stats, money: 11_000 } })).current).toBe(11_000);
  });

  it('is not offered before the Education app unlocks', () => {
    expect(goal!.isEligible(ceilingJanitor({ completedChapters: [], stats: { ...createTestGameState().stats, money: 900 } }))).toBe(false);
  });

  it('is not offered to a player who is studying or already qualified', () => {
    const studying = ceilingJanitor({
      educations: [{ id: 'police_academy', name: 'Police Academy', completed: false, weeksRemaining: 12 } as any],
    });
    expect(goal!.isEligible(studying)).toBe(false);
    const graduate = ceilingJanitor({
      educations: [{ id: 'police_academy', name: 'Police Academy', completed: true, weeksRemaining: 0 } as any],
    });
    expect(goal!.isEligible(graduate)).toBe(false);
  });

  it('is not offered to someone already on a degree ladder', () => {
    const base = createTestGameState();
    const teacher = ceilingJanitor({
      currentJob: 'teacher',
      careers: base.careers.map((c) =>
        c.id === 'teacher' ? { ...c, accepted: true, applied: true, level: 2, currentLevel: 2 } : c,
      ),
    });
    expect(goal!.isEligible(teacher)).toBe(false);
  });

  it('reaches the home feed for the measured ceiling janitor', () => {
    // `recommendGoals` returns the three spotlighted goals (NOW / SOON /
    // DREAM); the SOON slot rotates on an 8-week window (Program 9), so the
    // state is pinned at a week where the rotation lands on this goal's turn
    // is not something a unit test should know. Assert the weaker, stable
    // property: for this player the goal is in the recommendation at week 0.
    const rec = recommendGoals(ceilingJanitor());
    expect(rec.map((g) => g.id)).toContain('soon_get_qualified');
  });
});
