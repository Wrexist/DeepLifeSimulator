/**
 * M10 — age had TWO sources of truth, and lib/ read it both ways.
 *
 * `date.age` is STORED and advanced by `+1/52` on every weekly tick;
 * `weeksLived` is the absolute counter §4.2 says every comparison must use.
 * Four modules (`pension`, `secretEvents`, `nearMissEvents`, `ribbonSystem`)
 * kept a private `getAge` reading the stored value while `storyGenerator`
 * derived from the counter — so the death roll, the pension gates and every
 * age-conditioned event could disagree with the life story about how old the
 * player was.
 *
 * `getAge(state)` (`lib/progress/lifeChapters.ts`) is now the one reader.
 * These tests pin the two things that make that safe:
 *
 *   1. EQUIVALENCE — for a healthy save the derived age equals the stored one,
 *      across a fresh life, an aged life, and BOTH post-prestige paths, built
 *      through the real builders rather than hand-assembled state.
 *   2. The derivation is the one that survives — the stored value drifts,
 *      because `+1/52` is not representable in binary floating point.
 */
import { initialGameState, STATE_VERSION } from '@/contexts/game/initialState';
import { ADULTHOOD_AGE, WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';
import { continueAsChild, executePrestige } from '@/lib/prestige/prestigeExecution';
import { getAge } from '@/lib/progress/lifeChapters';
import { ageFromWeeksLived } from '@/utils/weekCounters';
import {
  buildNewGameState,
  computeWeeksLived,
  type BuildGameStateParams,
} from '@/src/features/onboarding/gameStateBuilder';
import { createTestGameState } from '../helpers/createTestGameState';

// ---------------------------------------------------------------------------
// The real onboarding builder — the one path that starts every non-heir life.
// ---------------------------------------------------------------------------

function freshLife(startingAge: number) {
  const params: BuildGameStateParams = {
    initialGameState,
    stateVersion: STATE_VERSION,
    firstName: 'Age',
    lastName: 'Probe',
    sex: 'male',
    sexuality: 'straight',
    scenario: { id: 'dropout', start: { age: startingAge, cash: 500 } },
    challengeScenarioId: undefined,
    selectedPerks: [],
    permanentPerks: [],
    selectedMindset: null,
  } as BuildGameStateParams;
  return buildNewGameState(params);
}

/** Age the save the way the week loop does: +1 week, +1/52 year, every tick. */
function tick(state: any, weeks: number) {
  let next = state;
  for (let i = 0; i < weeks; i++) {
    next = {
      ...next,
      weeksLived: (next.weeksLived ?? 0) + 1,
      date: { ...next.date, age: (next.date?.age ?? ADULTHOOD_AGE) + 1 / WEEKS_PER_YEAR },
    };
  }
  return next;
}

describe('M10 - derived age agrees with the stored age on a healthy save', () => {
  it.each([18, 20, 25, 30])('a fresh life started at %i', (startingAge) => {
    const state = freshLife(startingAge);

    // The premise: `weeksLived` is seeded, not zero (§4.2).
    expect(state.weeksLived).toBe(computeWeeksLived(startingAge));
    expect(state.lifeStartWeek).toBe(state.weeksLived);

    expect(getAge(state)).toBe(startingAge);
    expect(getAge(state)).toBe(Math.floor(state.date.age));
  });

  it('an aged life - every week of a decade agrees with the stored value', () => {
    let state = freshLife(25);
    for (let week = 1; week <= 10 * WEEKS_PER_YEAR; week++) {
      state = tick(state, 1);
      // Rounded before flooring, because the STORED value is what accumulates
      // float error — see the drift test below for what that costs unrounded.
      expect(getAge(state)).toBe(Math.floor(Math.round(state.date.age * 1e6) / 1e6));
    }
    expect(getAge(state)).toBe(35);
  });
});

describe('M10 - the derivation survives the prestige paths', () => {
  // Above the gate so `executePrestige` does not no-op.
  const richOldLife = () =>
    createTestGameState({
      stats: { money: getPrestigeThreshold(0) + 5_000_000 },
      weeksLived: computeWeeksLived(18) + 60 * WEEKS_PER_YEAR,
      lifeStartWeek: computeWeeksLived(18),
      date: { ...initialGameState.date, age: 78 },
    } as never);

  it('the reset path: heir starts at 18, and BOTH counters say so', () => {
    const next = executePrestige(richOldLife(), 'reset');

    expect(next.weeksLived).toBe(computeWeeksLived(ADULTHOOD_AGE));
    expect(next.lifeStartWeek).toBe(next.weeksLived);
    expect(getAge(next)).toBe(ADULTHOOD_AGE);
    expect(getAge(next)).toBe(Math.floor(next.date.age));
  });

  it('the child path: the heir takes over at their OWN age, not 18 + weeks', () => {
    const heirAge = 24;
    const withChild = createTestGameState({
      ...richOldLife(),
      family: {
        ...createTestGameState().family,
        children: [
          {
            id: 'kid-1',
            name: 'Heir',
            age: heirAge,
            gender: 'male',
            relationship: 80,
          },
        ],
      },
    } as never);

    const next = continueAsChild(withChild, 'kid-1');

    // The counter is RE-SEEDED from the heir's age — this is what makes the
    // derivation correct after a generation change. If it were left running,
    // `18 + weeksLived/52` would report the dead parent's age.
    expect(next.weeksLived).toBe(computeWeeksLived(heirAge));
    expect(next.lifeStartWeek).toBe(next.weeksLived);
    expect(getAge(next)).toBe(heirAge);
    expect(getAge(next)).toBe(Math.floor(next.date.age));
  });

  it('and the heir keeps agreeing as their own life runs on', () => {
    const withChild = createTestGameState({
      ...richOldLife(),
      family: {
        ...createTestGameState().family,
        children: [{ id: 'kid-1', name: 'Heir', age: 21, gender: 'female', relationship: 80 }],
      },
    } as never);

    let next: any = continueAsChild(withChild, 'kid-1');
    next = tick(next, 5 * WEEKS_PER_YEAR);
    expect(getAge(next)).toBe(26);
  });
});

describe('M10 - why the derived value is the one to trust', () => {
  it('the stored `date.age` drifts below the true age; the counter cannot', () => {
    let state: any = freshLife(18);
    state = tick(state, 40 * WEEKS_PER_YEAR);

    // 2080 additions of 1/52 do not make exactly 40.
    expect(state.date.age).not.toBe(58);
    expect(Math.abs(state.date.age - 58)).toBeLessThan(1e-9);

    // The derived answer is exact regardless of which side of 58 the float
    // landed on — this is the "permanent skew" M10 describes.
    expect(getAge(state)).toBe(58);
    expect(state.weeksLived - state.lifeStartWeek).toBe(40 * WEEKS_PER_YEAR);
  });

  it('a corrupt `date.age` no longer resets the player to 18', () => {
    const state: any = { ...freshLife(40), date: { age: undefined } };
    expect(getAge(state)).toBe(40);
  });
});

describe('M10 - legacy saves keep their current behaviour', () => {
  it('no `lifeStartWeek` (pre-v43) falls back to the stored age', () => {
    // The shape the pre-v43 heir path could write: a real age with a counter
    // that never agreed with it. Deriving would report 18.
    const legacy: any = { weeksLived: 0, date: { age: 20 } };
    expect(legacy.lifeStartWeek).toBeUndefined();
    expect(getAge(legacy)).toBe(20);
  });

  it('and a legacy save with neither still answers 18, not NaN', () => {
    expect(getAge({} as never)).toBe(ADULTHOOD_AGE);
    expect(getAge(undefined)).toBe(ADULTHOOD_AGE);
  });
});

describe('M10 - the primitive and the state helper are the same arithmetic', () => {
  it('ageFromWeeksLived is floor(18 + weeks/52)', () => {
    expect(ageFromWeeksLived(0)).toBe(18);
    expect(ageFromWeeksLived(WEEKS_PER_YEAR)).toBe(19);
    expect(ageFromWeeksLived(WEEKS_PER_YEAR - 1)).toBe(18);
    expect(ageFromWeeksLived(computeWeeksLived(65))).toBe(65);
  });

  it('malformed counters resolve to 18 rather than NaN', () => {
    expect(ageFromWeeksLived(undefined)).toBe(18);
    expect(ageFromWeeksLived('104' as never)).toBe(18);
    expect(ageFromWeeksLived(-5)).toBe(18);
    expect(ageFromWeeksLived(NaN)).toBe(18);
  });
});
