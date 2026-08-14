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

  it('names the LAST accepted career, not the first', () => {
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

  it('says nothing about a career the character never accepted (the control)', () => {
    const { text } = asText(generateObituary(died([career({ accepted: false })])));

    expect(text).not.toContain('Senior Developer');
  });
});

/** The obituary as one searchable string, whatever shape the object takes. */
function asText(obituary: unknown): { text: string } {
  return { text: JSON.stringify(obituary) };
}
