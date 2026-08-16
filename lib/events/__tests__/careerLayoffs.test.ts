/**
 * The layoffs event must not contradict itself — and must be DETERMINISTIC.
 *
 * `company_layoffs` drew `Math.random() < surviveChance` TWICE — once to pick the
 * `effects` and again to decide `special: 'fire_from_job'`. The two draws are
 * independent, so the outcomes disagreed whenever they landed on opposite sides:
 * the player could keep their job while taking the -25 happiness of being laid
 * off, or collect the +5 reputation for surviving and be fired anyway. At the
 * 50-69 performance band (surviveChance 0.6) that is 2 × 0.6 × 0.4 ≈ 48% of
 * resolutions. 2026-07-28 audit GL-4.
 *
 * The invariant: the reputation-positive "survived" effects and the
 * `fire_from_job` special can never appear together, and the "laid off" effects
 * must always come WITH it.
 *
 * ## Why this suite no longer mocks Math.random (2026-08-16 audit H7b)
 *
 * The single remaining draw is now `payloadRoll(state, 'company_layoffs')`
 * (`lib/events/seededPayload.ts`), a pure function of `weeksLived` — because
 * `generate()` runs inside the weekly `setGameState` updater, where React 19's
 * double invocation used to hand the player whichever outcome the committed
 * render happened to draw, and a reload re-rolled being FIRED.
 *
 * So the outcome is steered the way `payloadDeterminism.test.ts` steers the
 * engine's: by choosing `weeksLived`, not by spying on `Math.random`. The
 * fixtures below are pinned weeks whose roll sits in a known band — recomputing
 * the roll inside the test would just restate the implementation.
 */
import { careerEventTemplates } from '../careerEvents';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const layoffs = careerEventTemplates.find((t) => t.id === 'company_layoffs')!;

/**
 * Employed with an estimated (stat-derived) performance.
 * `weeksLived` is the ONLY knob that moves the outcome.
 */
function employedState(weeksLived = 200): GameState {
  return createTestGameState({
    currentJob: 'programmer',
    weeksLived,
    careers: [
      {
        id: 'programmer',
        accepted: true,
        level: 2,
        startedWeeksLived: 0,
        levels: [{ salary: 100 }, { salary: 200 }, { salary: 300 }],
      } as never,
    ],
  });
}

/** The choice whose outcome is rolled ("stay calm"); the other is deterministic. */
function stayCalmChoice(state: GameState) {
  const event = layoffs.generate(state);
  return event.choices.find((c) => c.id === 'stay_calm')!;
}

/** Weeks whose seeded roll lands BELOW 0.3 — survives in every performance band. */
const SURVIVING_WEEKS = [101, 105, 107, 109];
/** Weeks whose seeded roll lands at/above 0.85 — fired in every performance band. */
const FIRED_WEEKS = [100, 110, 122, 139, 140];

describe('company_layoffs resolves to ONE consistent outcome', () => {
  it('never calls Math.random — the outcome comes from the save, not the render', () => {
    const spy = jest.spyOn(Math, 'random');
    try {
      for (let week = 100; week < 140; week++) stayCalmChoice(employedState(week));
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('survives on a low-roll week', () => {
    for (const week of SURVIVING_WEEKS) {
      const choice = stayCalmChoice(employedState(week));
      expect(choice.effects?.stats?.reputation).toBe(5); // survived
      expect(choice.special).toBeUndefined(); // ...and is NOT fired
    }
  });

  it('is fired on a high-roll week', () => {
    for (const week of FIRED_WEEKS) {
      const choice = stayCalmChoice(employedState(week));
      expect(choice.effects?.stats?.happiness).toBe(-25); // laid off
      expect(choice.special).toBe('fire_from_job'); // ...and actually fired
    }
  });

  it('holds the effects↔special invariant across every week', () => {
    // The original suite mocked straddling PAIRS of draws because two draws
    // existed. There is one draw now, so the sweep is over weeks instead — and
    // it has to see both outcomes, or it would pass vacuously.
    const outcomes = new Set<boolean>();
    for (let week = 100; week < 400; week++) {
      const choice = stayCalmChoice(employedState(week));
      const survivedEffects = choice.effects?.stats?.reputation === 5;
      const laidOffEffects = choice.effects?.stats?.happiness === -25;
      const wasFired = choice.special === 'fire_from_job';

      expect(survivedEffects && wasFired).toBe(false);
      expect(laidOffEffects).toBe(wasFired);
      outcomes.add(wasFired);
    }
    expect(outcomes.size).toBe(2);
  });

  it('the roll still matters — performance shifts the outcome on a fixed week', () => {
    // A week in the 0.6–0.85 band: fired at the mid performance band
    // (surviveChance 0.6), survives as a high performer (0.85). Same week, so
    // only the band moved — proof the seeding did not pin the result.
    const week = 112; // seeded roll ≈ 0.71
    const withPerformance = (performance: number): GameState => {
      const state = employedState(week);
      (state.careers[0] as unknown as { performance: number }).performance = performance;
      return state;
    };
    expect(stayCalmChoice(withPerformance(55)).special).toBe('fire_from_job'); // 0.6 band
    expect(stayCalmChoice(withPerformance(90)).special).toBeUndefined(); // 0.85 band
  });

  it('re-generating the same week is byte-identical (no save-scum, no StrictMode drift)', () => {
    for (let week = 100; week < 200; week++) {
      const a = layoffs.generate(employedState(week));
      const b = layoffs.generate(employedState(week));
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it('leaves the severance choice unconditionally firing (unchanged)', () => {
    const event = layoffs.generate(employedState());
    const volunteer = event.choices.find((c) => c.id === 'volunteer_leave')!;
    expect(volunteer.special).toBe('fire_from_job');
    expect(volunteer.effects?.money).toBe(1000);
  });
});
