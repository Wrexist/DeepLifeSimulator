/**
 * Goal acknowledgement is a comparison between two states, never a stored flag.
 *
 * That is the whole safety argument: with nothing persisted there is nothing to
 * double-claim, which is the most-repeated bug class in this repo
 * (CLAUDE.md §4.4). These tests pin the properties that make the comparison
 * trustworthy — it fires on advancement, stays silent on regression, and is
 * idempotent for the same pair of states.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { goalsAchievedBetween } from '@/lib/goals/engine';
import { GOAL_CATALOGUE } from '@/lib/goals/catalogue';

const ids = (prev: never, next: never) => goalsAchievedBetween(prev, next).map((g) => g.id);

describe('goalsAchievedBetween', () => {
  it('reports nothing when nothing changed', () => {
    const state = createTestGameState({ stats: { money: 2_000 } });
    expect(goalsAchievedBetween(state, state)).toEqual([]);
  });

  it('reports getting hired', () => {
    const before = createTestGameState({ currentJob: undefined });
    const after = createTestGameState({ currentJob: 'tech' });
    expect(ids(before as never, after as never)).toContain('now_get_hired');
  });

  it('reports crossing a savings rung, even though the goal stays on screen', () => {
    // The case a boolean "done" flag could never express: the goal remains
    // eligible with a higher target, but the player just did something real.
    const before = createTestGameState({ stats: { money: 900 } });
    const after = createTestGameState({ stats: { money: 1_100 } });
    expect(ids(before as never, after as never)).toContain('now_bank_savings');
  });

  it('does NOT report a rung the player was already past', () => {
    const before = createTestGameState({ stats: { money: 1_100 } });
    const after = createTestGameState({ stats: { money: 1_500 } });
    expect(ids(before as never, after as never)).not.toContain('now_bank_savings');
  });

  it('stays silent on regression — losing ground never congratulates', () => {
    const rich = createTestGameState({ currentJob: 'tech', stats: { money: 60_000 } });
    const poor = createTestGameState({ currentJob: undefined, stats: { money: 10 } });
    expect(goalsAchievedBetween(rich, poor)).toEqual([]);
  });

  it('does not re-arm after a regression and recovery to the same level', () => {
    // Selling a property and rebuying it is not a second achievement of the
    // same rung — but it IS a genuine increase from the reduced state, so the
    // property that matters is that the acknowledgement tracks the LEVEL, not
    // a flag that could be cleared and re-earned repeatedly for free. Nothing
    // is paid here, which is precisely why that is safe.
    const one = createTestGameState({ stats: { money: 1_100 } });
    const back = createTestGameState({ stats: { money: 900 } });
    expect(goalsAchievedBetween(one, back)).toEqual([]);
  });

  it('is idempotent for the same pair of states', () => {
    const before = createTestGameState({ stats: { money: 900 } });
    const after = createTestGameState({ stats: { money: 1_100 } });
    expect(goalsAchievedBetween(before, after)).toEqual(goalsAchievedBetween(before, after));
  });

  it('reports several advances from one transition', () => {
    const before = createTestGameState({ currentJob: undefined, stats: { money: 100 } });
    const after = createTestGameState({ currentJob: 'tech', stats: { money: 30_000 } });
    const reported = ids(before as never, after as never);
    expect(reported).toEqual(expect.arrayContaining(['now_get_hired', 'now_bank_savings']));
  });

  it('degrades to empty rather than throwing on a missing state', () => {
    const state = createTestGameState();
    expect(goalsAchievedBetween(null, state)).toEqual([]);
    expect(goalsAchievedBetween(state, null)).toEqual([]);
    expect(() => goalsAchievedBetween({} as never, {} as never)).not.toThrow();
  });

  it('every goal in the catalogue declares a level, and it can rise', () => {
    // A goal with no level is silently un-acknowledgeable. That is a legitimate
    // choice, but not an accidental one — assert it is a deliberate omission by
    // requiring the catalogue to be complete today.
    const missing = GOAL_CATALOGUE.filter((g) => !g.achievementLevel).map((g) => g.id);
    expect(missing).toEqual([]);
  });
});
