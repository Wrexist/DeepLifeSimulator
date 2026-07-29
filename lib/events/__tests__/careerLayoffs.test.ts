/**
 * The layoffs event must not contradict itself.
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
 */
import { careerEventTemplates } from '../careerEvents';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const layoffs = careerEventTemplates.find((t) => t.id === 'company_layoffs')!;

function employedState(): GameState {
  return createTestGameState({
    currentJob: 'programmer',
    weeksLived: 200,
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

describe('company_layoffs resolves to ONE consistent outcome', () => {
  afterEach(() => {
    jest.spyOn(Math, 'random').mockRestore();
  });

  // NOTE ON THE MOCK: a single `mockReturnValue(x)` cannot catch this bug —
  // both of the old draws would read the same x and agree by accident. The
  // contradiction only appears when consecutive draws land on OPPOSITE sides of
  // surviveChance, which is what real Math.random does roughly half the time in
  // the mid bands. So these mock a SEQUENCE.
  it('draws exactly one number, so the two halves cannot disagree', () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    stayCalmChoice(employedState());
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('survives-then-fired sequence still yields a consistent outcome', () => {
    // Old behaviour: first draw (0) → survived effects (+5 reputation);
    // second draw (0.99) → special 'fire_from_job'. Kept the job on paper,
    // fired in fact.
    jest.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.99);
    const choice = stayCalmChoice(employedState());

    expect(choice.effects?.stats?.reputation).toBe(5); // survived
    expect(choice.special).toBeUndefined(); // ...and is NOT fired
  });

  it('fired-then-survived sequence still yields a consistent outcome', () => {
    // The mirror image: laid-off effects with no firing, so the player ate
    // -25 happiness for a layoff that never happened.
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0);
    const choice = stayCalmChoice(employedState());

    expect(choice.effects?.stats?.happiness).toBe(-25); // laid off
    expect(choice.special).toBe('fire_from_job'); // ...and actually fired
  });

  it('holds across every straddling pair of draws', () => {
    const state = employedState();
    for (let i = 0; i < 50; i += 1) {
      const a = i / 50;
      const b = 1 - a; // the two straddle surviveChance for most of the range
      jest.spyOn(Math, 'random').mockReturnValueOnce(a).mockReturnValueOnce(b);

      const choice = stayCalmChoice(state);
      const survivedEffects = choice.effects?.stats?.reputation === 5;
      const laidOffEffects = choice.effects?.stats?.happiness === -25;
      const wasFired = choice.special === 'fire_from_job';

      expect(survivedEffects && wasFired).toBe(false);
      expect(laidOffEffects).toBe(wasFired);
    }
  });

  it('survives on a low roll and is fired on a high one (the roll still matters)', () => {
    const state = employedState(); // default performance sits in a mid band

    jest.spyOn(Math, 'random').mockReturnValue(0);
    const survived = stayCalmChoice(state);
    expect(survived.special).toBeUndefined();
    expect(survived.effects?.stats?.reputation).toBe(5);

    jest.spyOn(Math, 'random').mockReturnValue(0.999);
    const fired = stayCalmChoice(state);
    expect(fired.special).toBe('fire_from_job');
    expect(fired.effects?.stats?.happiness).toBe(-25);
  });

  it('leaves the severance choice unconditionally firing (unchanged)', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const event = layoffs.generate(employedState());
    const volunteer = event.choices.find((c) => c.id === 'volunteer_leave')!;
    expect(volunteer.special).toBe('fire_from_job');
    expect(volunteer.effects?.money).toBe(1000);
  });
});
