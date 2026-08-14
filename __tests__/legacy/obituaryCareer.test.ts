/**
 * The obituary names the career the character actually had.
 *
 * It did not, for every player who ever held a job. The generator read
 * `career.name || career.title`, and `Career` has NEITHER — the job title lives
 * in `levels[level].name`. Both reads were `as any`, so the expression compiled,
 * evaluated to `undefined || undefined`, and fell through to the literal string
 * `'employed'` on every death screen ever shown.
 *
 * The cast is the whole story. Without it this would not have compiled, which is
 * exactly what CLAUDE.md Hard Rule #2 and the `no-restricted-syntax` rule exist
 * to prevent — and it was found by clearing that rule's backlog rather than by
 * anyone noticing a dull obituary.
 */
import { generateObituary } from '@/lib/legacy/obituaryGenerator';
import { createTestGameState } from '../helpers/createTestGameState';
import type { Career, GameState } from '@/contexts/game/types';

const career = (over: Partial<Career> = {}): Career => ({
  id: 'software_engineer',
  levels: [
    { name: 'Junior Developer', salary: 900 },
    { name: 'Senior Developer', salary: 2_400 },
    { name: 'Engineering Lead', salary: 4_000 },
  ],
  level: 1,
  description: 'Writes software.',
  requirements: {},
  progress: 0,
  applied: true,
  accepted: true,
  ...over,
});

const died = (careers: Career[]): GameState =>
  createTestGameState({ weeksLived: 400, careers, deathReason: 'health' });

/** Died out of work, with `careerHistory` remembering the jobs they held. */
const diedUnemployed = (careers: Career[], jobIds: string[]): GameState => {
  const base = createTestGameState();
  const stats = base.lifetimeStatistics;
  if (!stats) throw new Error('createTestGameState must carry lifetimeStatistics');
  return createTestGameState({
    weeksLived: 400,
    deathReason: 'health',
    careers: careers.map((c) => ({ ...c, accepted: false })),
    lifetimeStatistics: {
      ...stats,
      careerHistory: jobIds.map((job, i) => ({
        job, weeks: 40, earnings: 50_000, startWeek: i * 40, endWeek: (i + 1) * 40,
      })),
    },
  });
};

describe('the obituary names the job, not the word "employed"', () => {
  it('uses the title of the level the character reached', () => {
    const { text } = asText(generateObituary(died([career()])));

    expect(text).toContain('Senior Developer');
    expect(text).not.toContain('employed');
  });

  it('follows a promotion', () => {
    // The level index is the whole point of reading `levels[level]` — a
    // character who reached the top should not be eulogised as a junior.
    const { text } = asText(generateObituary(died([career({ level: 2 })])));

    expect(text).toContain('Engineering Lead');
  });

  it('uses `currentJob` to pick which career they held', () => {
    // The canonical answer, and the one `getCareerName` uses. A save should
    // only ever carry one accepted career; picking by flag alone left it to
    // array order, which is not a decision anyone made.
    const state = createTestGameState({
      weeksLived: 400,
      deathReason: 'health',
      currentJob: 'barista',
      careers: [
        career({ id: 'barista', levels: [{ name: 'Barista', salary: 300 }], level: 0 }),
        career({ id: 'surgeon', levels: [{ name: 'Surgeon', salary: 9_000 }], level: 0 }),
      ],
    });

    expect(asText(generateObituary(state)).text).toContain('Barista');
  });

  it('falls back to the LAST accepted career when currentJob is unset', () => {
    const { text } = asText(generateObituary(died([
      career({ id: 'barista', levels: [{ name: 'Barista', salary: 300 }], level: 0 }),
      career({ id: 'surgeon', levels: [{ name: 'Surgeon', salary: 9_000 }], level: 0 }),
    ])));

    expect(text).toContain('Surgeon');
  });

  it('still falls back gracefully when a career has no levels', () => {
    // The fallback is correct behaviour for a malformed career; it was just
    // never supposed to be the ONLY behaviour.
    const { text } = asText(generateObituary(died([career({ levels: [] })])));

    expect(text).toContain('employed');
  });

  it('clamps a level index past the end of the ladder', () => {
    // A save whose `level` outran its `levels` array must not read undefined.
    const { text } = asText(generateObituary(died([career({ level: 99 })])));

    expect(text).toContain('Engineering Lead');
  });

  it('says nothing about someone who never worked at all (the control)', () => {
    const neverWorked = createTestGameState({ weeksLived: 400, careers: [], deathReason: 'health' });

    expect(asText(generateObituary(neverWorked)).text).not.toContain('employed');
  });
});

describe('and it names a job they no longer held when they died', () => {
  /**
   * `accepted` means "employed RIGHT NOW" — both `quitJob` and the firing path
   * set it false. Filtering on it named a career only for someone who died
   * still on the payroll, which excludes everyone who retired, quit or was
   * fired. Caught in review of #130, after the first fix.
   *
   * `level` is safe to read afterwards because neither path resets it: they
   * clear `accepted`, `applied`, `progress`, `performance` and
   * `warningsReceived` and leave the ladder position alone.
   */
  it('recovers the title from careerHistory after a quit', () => {
    const { text } = asText(generateObituary(diedUnemployed([career()], ['software_engineer'])));

    expect(text).toContain('Senior Developer');
  });

  it('names the LAST job in the history, not the first', () => {
    const state = diedUnemployed(
      [
        career({ id: 'barista', levels: [{ name: 'Barista', salary: 300 }], level: 0 }),
        career({ id: 'surgeon', levels: [{ name: 'Surgeon', salary: 9_000 }], level: 0 }),
      ],
      ['barista', 'surgeon'],
    );

    expect(asText(generateObituary(state)).text).toContain('Surgeon');
  });

  it('prefers the job held at death over the history', () => {
    const state = createTestGameState({
      weeksLived: 400,
      deathReason: 'health',
      careers: [
        career({ id: 'barista', levels: [{ name: 'Barista', salary: 300 }], level: 0, accepted: false }),
        career({ id: 'surgeon', levels: [{ name: 'Surgeon', salary: 9_000 }], level: 0, accepted: true }),
      ],
    });

    expect(asText(generateObituary(state)).text).toContain('Surgeon');
  });

  it('still says SOMETHING for a history naming a career the catalogue lost', () => {
    // They demonstrably worked; the ladder just is not there to name.
    const state = diedUnemployed([], ['a_career_that_was_removed']);

    expect(asText(generateObituary(state)).text).toContain('employed');
  });
});

/** The obituary as one searchable string, whatever shape the object takes. */
function asText(obituary: unknown): { text: string } {
  return { text: JSON.stringify(obituary) };
}
