/**
 * The SOON / DREAM spotlight rotation — Master Program 9.
 *
 * Measured before: "Earn your next promotion / Reach a fortune" for 90 weeks
 * while three other goals were eligible. These pin that the eligible set now
 * takes turns on an eight-week window, that a nearly-done goal holds the
 * spotlight, that NOW never rotates, and that it is deterministic.
 */
import { createTestGameState } from '../../../__tests__/helpers/createTestGameState';
import { recommendGoals, GOAL_SPOTLIGHT_WEEKS } from '../engine';
import type { GameState } from '@/contexts/game/types';

/** An employed, housed life with nothing urgent - the mid-game a persona lives. */
const midGame = (weeksIntoLife: number, extra: Partial<GameState> = {}): GameState => {
  const base = createTestGameState();
  return createTestGameState({
    weeksLived: 104 + weeksIntoLife,
    lifeStartWeek: 104,
    stats: { ...base.stats, money: 3_000, health: 90, happiness: 90 },
    bankSavings: 0,
    realEstate: [],
    rental: { tierId: 'shared-room', startedWeek: 105 },
    currentJob: 'janitor',
    careers: (base.careers ?? []).map((c) =>
      c.id === 'janitor' ? { ...c, applied: true, accepted: true, level: 1, progress: 20 } : c,
    ),
    ...extra,
  });
};

const soonAt = (w: number) => recommendGoals(midGame(w)).find((g) => g.horizon === 'soon')?.id;
const dreamAt = (w: number) => recommendGoals(midGame(w)).find((g) => g.horizon === 'dream')?.id;

describe('the spotlight rotates through what is eligible', () => {
  it('SOON shows more than one goal across a life, not the same one for 90 weeks', () => {
    const seen = new Set<string>();
    for (let w = 8; w <= 96; w++) seen.add(soonAt(w)!);
    expect(seen.size).toBeGreaterThanOrEqual(2);
    expect(seen).toContain('soon_promotion');
  });

  it('DREAM shows more than one goal too', () => {
    const seen = new Set<string>();
    for (let w = 8; w <= 96; w++) seen.add(dreamAt(w)!);
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it('holds one goal for a whole window, then moves - deterministic in the week', () => {
    const first = soonAt(8);
    for (let w = 8; w < 8 + GOAL_SPOTLIGHT_WEEKS; w++) expect(soonAt(w)).toBe(first);
    expect(soonAt(8)).toBe(soonAt(8));
  });

  it('a nearly finished goal keeps the spotlight instead of rotating away', () => {
    for (let w = 8; w <= 40; w++) {
      const s = midGame(w, {
        careers: (createTestGameState().careers ?? []).map((c) =>
          c.id === 'janitor' ? { ...c, applied: true, accepted: true, level: 1, progress: 85 } : c,
        ),
      });
      expect(recommendGoals(s).find((g) => g.horizon === 'soon')?.id).toBe('soon_promotion');
    }
  });

  it('NOW never rotates: arrears stay ahead of the savings ladder every week', () => {
    for (let w = 0; w <= 40; w++) {
      const s = midGame(w, { overdueBalance: 200 });
      expect(recommendGoals(s)[0].id).toBe('now_clear_arrears');
    }
  });
});
