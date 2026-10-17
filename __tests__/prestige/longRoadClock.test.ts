/**
 * The Long Road must make the life OLDER, not just the HUD.
 *
 * The Trial added 12 to `date.age` and `date.year` and stopped there. But
 * `date.age` is only the stored copy: the canonical reader `getAge` derives age
 * from `weeksLived` (`ageFromWeeksLived`, the inverse of the `computeWeeksLived`
 * seed the prestige builders stamp). So the life ran on two ages - 30 on screen
 * and to the old-age roll, 18 to the pension and retirement gates, elder
 * activities, chapter age goals, ribbons and age-conditioned events.
 *
 * The other half is the one that is easy to get wrong the other way: starting
 * twelve years older must NOT count as twelve years PLAYED. `weeksInThisLife`
 * must still open at 0, or the chapter ladder opens at chapter 5 and every
 * first-session guide retires before it renders (CLAUDE.md §4.2).
 */
import { applyTrialEffectsToNewLife } from '@/lib/dynasty/trials';
import { executePrestige } from '@/lib/prestige/prestigeExecution';
import { getAge, weeksInThisLife, getActiveChapter } from '@/lib/progress/lifeChapters';
import { computeWeeksLived, WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const TWELVE_YEARS = 12 * WEEKS_PER_YEAR;

/** A freshly-built 20-year-old heir, exactly as the child builder seeds one. */
function heirAt20(): GameState {
  const seed = computeWeeksLived(20);
  return createTestGameState({
    weeksLived: seed,
    lifeStartWeek: seed,
    lastEventWeeksLived: seed,
    date: { age: 20, year: 2040, month: 'January', week: 1 },
    legacyBuffs: { mentor: { expiresWeeksLived: seed + 104 } },
    relationships: [
      { id: 'mum', name: 'Mum', type: 'parent', relationshipScore: 50, personality: 'caring', gender: 'female', age: 45 },
    ],
  });
}

describe('The Long Road - one age, not two', () => {
  it('ages the life everywhere age is read, not only on the HUD', () => {
    const life = heirAt20();
    applyTrialEffectsToNewLife(life, ['trial_long_road']);
    expect(life.date.age).toBe(32);
    expect(life.date.year).toBe(2052);
    // The age every `getAge` reader (pension, events, chapters) sees.
    expect(getAge(life)).toBe(32);
    expect(life.weeksLived).toBe(computeWeeksLived(32));
  });

  it('does not count the twelve years as weeks played', () => {
    const life = heirAt20();
    applyTrialEffectsToNewLife(life, ['trial_long_road']);
    expect(weeksInThisLife(life)).toBe(0);
    expect(getActiveChapter(life)?.id).toBe('ch1_fresh_start');
  });

  it('moves every marker the builders stamp from the seed with it', () => {
    const life = heirAt20();
    const seed = life.weeksLived;
    applyTrialEffectsToNewLife(life, ['trial_long_road']);
    // Event spacing: not "twelve years without an event".
    expect(life.lastEventWeeksLived).toBe(seed + TWELVE_YEARS);
    // The heir's two-year buff still has two years left.
    expect(life.legacyBuffs?.mentor?.expiresWeeksLived).toBe(life.weeksLived + 104);
  });

  it('ages the family the life was dealt by the same twelve years', () => {
    const life = heirAt20();
    applyTrialEffectsToNewLife(life, ['trial_long_road']);
    expect(life.relationships?.[0]?.age).toBe(57);
  });

  it('stamps a baseline on a life that arrived without one', () => {
    const life = createTestGameState({ weeksLived: 0, date: { age: 18, year: 2025, month: 'January', week: 1 } });
    delete (life as Partial<GameState>).lifeStartWeek;
    applyTrialEffectsToNewLife(life, ['trial_long_road']);
    expect(getAge(life)).toBe(30);
    expect(weeksInThisLife(life)).toBe(0);
  });

  it('leaves the clock alone for a Trial that costs no years (control)', () => {
    const life = heirAt20();
    const before = life.weeksLived;
    applyTrialEffectsToNewLife(life, ['trial_pauper']);
    expect(life.weeksLived).toBe(before);
    expect(life.lifeStartWeek).toBe(before);
  });
});

describe('The Long Road through the real prestige builders', () => {
  const sworn = (): GameState => {
    const base = createTestGameState();
    return createTestGameState({
      weeksLived: 2000,
      stats: { ...base.stats, money: 500_000_000 },
      family: { ...base.family, children: [{ id: 'heir-1', name: 'Ada', age: 20, gender: 'female' }] } as never,
      dynasty: { trials: { pending: ['trial_long_road'] } },
    });
  };

  it.each([
    ['reset', undefined, 30],
    ['child', 'heir-1', 32],
  ] as const)('%s path: displayed age, derived age and week clock agree', (path, childId, expectedAge) => {
    const next = executePrestige(sworn(), path, childId);
    expect(Math.floor(next.date.age)).toBe(expectedAge);
    expect(getAge(next)).toBe(expectedAge);
    expect(weeksInThisLife(next)).toBe(0);
    expect(next.lastEventWeeksLived).toBe(next.weeksLived);
  });
});
