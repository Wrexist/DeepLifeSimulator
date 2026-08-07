/**
 * No weekly subsystem may cost the player their week.
 *
 * `nextWeek()` runs ~37 `apply*` subsystems inside ONE `setGameState` updater
 * wrapped in a single outer try/catch that returns `prevState`. So a subsystem
 * that throws does not degrade — it silently rolls the whole tick back. The
 * player taps "Next Week" and nothing happens: no error, no advance, no income,
 * no aging. A soft-lock that presents as a dead button. `CLAUDE.md` §4.3 names
 * this class and `tasks/lessons.md` records it five times.
 *
 * Thirteen calls were running bare under that outer catch: career salary, diet,
 * career applications, career progress, education stress, rent/housing, loan
 * autopay, crime, mining (x2), economic events, weekly events, life moments.
 *
 * Two kinds of test here, on purpose:
 *
 *  1. BEHAVIOUR — `guardTick` really does swallow and fall back. That is the
 *     contract, and it is executable.
 *  2. COVERAGE — every `apply*` call in the tick is inside SOME guard. That one
 *     has to read the caller: there is no way to prove "nothing is unguarded" by
 *     running code, because the whole point is the case nobody thought to write.
 *     It is the same reason a lint rule beats a code review.
 */
import fs from 'fs';
import path from 'path';
import { guardTick } from '@/contexts/game/actions/weekly/guardTick';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TICK = path.join(REPO_ROOT, 'contexts/game/GameActionsContext.tsx');

describe('guardTick', () => {
  it('returns the subsystem result when it works', () => {
    expect(guardTick('ok', () => 42, 0)).toBe(42);
  });

  it('returns the fallback when the subsystem throws', () => {
    expect(
      guardTick(
        'boom',
        () => {
          throw new Error('subsystem exploded');
        },
        'fallback',
      ),
    ).toBe('fallback');
  });

  it('does not rethrow, so the rest of the tick still runs', () => {
    let reachedNextStep = false;
    expect(() => {
      guardTick('boom', () => {
        throw new Error('x');
      }, null);
      reachedNextStep = true;
    }).not.toThrow();
    expect(reachedNextStep).toBe(true);
  });

  it('survives a thrown non-Error, which a bad save can produce', () => {
    expect(guardTick('weird', () => { throw 'a string'; }, 'safe')).toBe('safe');
    expect(guardTick('nullish', () => { throw null; }, 'safe')).toBe('safe');
  });
});

describe('every apply* call in the weekly tick is guarded', () => {
  /** The tick source with comments stripped — docblocks NAME these helpers. */
  const code = fs
    .readFileSync(TICK, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  /**
   * The thirteen that were running bare. Each must now appear either inside a
   * `guardTick(` wrapper or inside a plain `try {` block — both are acceptable
   * guards; what is not acceptable is neither.
   */
  const PREVIOUSLY_UNGUARDED = [
    'applyCareerSalaryAndPenalty',
    'applyDietPlanForWeek',
    'applyCareerApplications',
    'applyCareerProgress',
    'applyEducationStress',
    'applyRentAndHousing',
    'applyLoanAutopay',
    'applyCrimeTick',
    'applyMiningCryptos',
    'applyMiningWarehouse',
    'applyEconomicEvent',
    'applyWeeklyEvents',
    'applyLifeMoment',
    // Added with the rental/arrears feature after the original thirteen. It
    // landed running bare under the outer catch (it routes everything through
    // `safe()` so it could not throw, but "cannot throw today" is exactly the
    // assumption a future edit breaks). Guarded in the 2026-08-07 weekly audit;
    // pinned here so it stays that way.
    'applyArrears',
  ];

  it.each(PREVIOUSLY_UNGUARDED)('%s runs inside a guard', (helper) => {
    const call = new RegExp(`\\b${helper}\\s*\\(`);
    expect(code).toMatch(call);

    // Find the call and walk backwards to the nearest guard opener on the same
    // statement. `guardTick('name', () => helper(` puts the wrapper immediately
    // before the call, which is what makes this checkable at all.
    const index = code.search(call);
    const preceding = code.slice(Math.max(0, index - 400), index);
    const guarded = /guardTick\s*\(\s*['"][^'"]+['"]\s*,\s*\(\)\s*=>\s*$/.test(
      preceding.replace(/\s+$/, ' ').replace(/\s+/g, ' '),
    ) || /guardTick\s*\(/.test(preceding.slice(-120));

    expect(`${helper} guarded: ${guarded}`).toBe(`${helper} guarded: true`);
  });

  it('still wraps the whole updater, so guardTick is defence in depth', () => {
    // The outer catch is the reason an unguarded throw is so expensive. It stays
    // — it is the last line against a bug in the tick's OWN code — but it must
    // never again be the only thing standing between one subsystem and the week.
    expect(code).toMatch(/setGameState\(prevState => \{\s*try \{/);
  });
});
