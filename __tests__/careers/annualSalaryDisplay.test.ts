/**
 * No screen quotes a career salary it computed itself.
 *
 * The companion to `__tests__/economy/paidWeeklySalary.test.ts`, which pins what
 * the pay helpers RETURN. This one pins who CALLS them, across every surface
 * that prints a salary — the property that keeps the "conflicting numbers"
 * report closed as new screens are added.
 *
 * Two independent branches fixed halves of this in the same week, which is the
 * reason a cross-surface sweep is worth having on its own:
 *
 *   - `weeklyCareerSalary` (2026-07-31) fixed the four loan/DTI gates, which
 *     read the ANNUAL political ladder as weekly and inflated borrowing
 *     capacity 52x. Six DISPLAY surfaces kept the bug.
 *   - `paidWeeklySalaryForLevel` / `paidWeeklyCareerSalary` (2026-08-21) fixed
 *     those, and went further: every screen had been applying a different
 *     subset of the pay stack (raise premium, Work Pay Boost, salary life
 *     skills, DeepLife+), so one Surgical Director read $26K, $13000 and $13K
 *     across three screens.
 *
 * Both went looking for callers of the bug rather than readers of the field.
 * A per-file assertion is what finds the seventh screen.
 */
import fs from 'fs';
import path from 'path';
import { ANNUAL_SALARY_CAREER_IDS, isAnnualSalaryCareer } from '@/lib/careers/weeklySalary';
import { POLITICAL_CAREER } from '@/lib/careers/political';

const code = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

/** The pay helpers. A surface must reach a salary through one of these. */
const PAY_HELPERS = /paidWeeklySalaryForLevel|paidWeeklyCareerSalary|paidCareerCeiling|weeklyCareerSalary/;

/**
 * Every surface that prints a career salary to the player, or builds a record
 * that will be printed as one.
 */
const SURFACES = [
  'app/(tabs)/work.tsx',
  'components/ShareLifeCard.tsx',
  'components/IdentityCard.tsx',
  'components/computer/PoliticalApp.tsx',
  'contexts/game/actions/JobActions.ts',
];

describe('every salary surface goes through a pay helper', () => {
  it.each(SURFACES)('%s', (rel) => {
    expect(code(rel)).toMatch(PAY_HELPERS);
  });

  it('and none of them still divides or multiplies a salary by hand', () => {
    // The shape the bug took before there was a helper: a screen doing the
    // annual→weekly conversion itself, which is how two of them ended up
    // disagreeing about whether to do it at all.
    for (const rel of SURFACES) {
      const src = code(rel);
      expect(`${rel}: ${/salary\s*\/\s*WEEKS_PER_YEAR/.test(src)}`).toBe(`${rel}: false`);
      expect(`${rel}: ${/levels\[[^\]]*\]\?\.salary\s*\*/.test(src)}`).toBe(`${rel}: false`);
    }
  });

  it('the Politics app no longer names the annual figure weekly (the regression)', () => {
    // Its variable was called `salaryWeekly` and held the raw annual number, so
    // a President read "$100,000/wk" against the $1,923 office credits. The
    // NAME asserting the property is why this survived an earlier sweep.
    const src = code('components/computer/PoliticalApp.tsx');
    expect(src).not.toMatch(/salaryWeekly\s*=\s*careerLevel >= 1 \? \(POLITICAL_CAREER/);
    expect(src).toMatch(/paidWeeklySalaryForLevel\(gameState, POLITICAL_CAREER/);
  });

  it('the promotion record is built weekly at its SOURCE, not in the modal', () => {
    // `PendingPromotion.fromSalary` is documented as weekly and rendered with
    // "/wk". Converting in the modal instead would leave every future reader of
    // the record to remember to divide.
    expect(code('contexts/game/actions/JobActions.ts')).toMatch(/paidWeeklySalaryForLevel\(gameState, career/);
  });
});

describe('the annual ladder is still the only one', () => {
  it('political, and nothing else', () => {
    // A second annual ladder added without updating the set would reintroduce
    // the 52x bug on that ladder alone, silently.
    expect([...ANNUAL_SALARY_CAREER_IDS]).toEqual(['political']);
    expect(isAnnualSalaryCareer('political')).toBe(true);
    expect(isAnnualSalaryCareer('technology')).toBe(false);
    expect(isAnnualSalaryCareer(undefined)).toBe(false);
  });

  it('and a President is worth four figures a week, not six (the premise)', () => {
    const president = POLITICAL_CAREER.levels[POLITICAL_CAREER.levels.length - 1].salary;
    expect(president).toBe(100_000);
    expect(Math.round(president / 52)).toBeLessThan(2_500);
  });
});
