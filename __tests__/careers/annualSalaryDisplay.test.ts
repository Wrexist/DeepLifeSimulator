/**
 * The political ladder is ANNUAL. Every screen labels salaries "/wk".
 *
 * `Career.levels[].salary` is a WEEKLY figure for every ladder except
 * `political`, whose `POLITICAL_CAREER` levels are annual — 800 for a Local
 * Council Member up to 100,000 for a President. `weeklyCareerSalary` was added
 * (R3-M3) when four loan screens read the raw field into a DTI gate and
 * inflated an elected player's borrowing capacity 52x.
 *
 * The DISPLAY half of that bug was never fixed. Seven surfaces printed
 * `levels[level].salary` straight into a string ending in "/wk" or "/week",
 * including the Politics app itself — whose variable was even NAMED
 * `salaryWeekly` while holding the annual number. A President saw
 * "$100,000/wk" on the Work tab, the career card, the share card, the
 * promotion celebration AND the politics screen, and was paid $1,923.
 *
 * Two layers: the converter's own behaviour, and a source-level ratchet so a
 * new screen cannot reintroduce the raw read.
 */

import fs from 'fs';
import path from 'path';
import {
  ANNUAL_SALARY_CAREER_IDS,
  displayWeeklySalary,
  isAnnualSalaryCareer,
  weeklyCareerSalary,
} from '@/lib/careers/weeklySalary';
import { POLITICAL_CAREER } from '@/lib/careers/political';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

const code = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('displayWeeklySalary', () => {
  it('divides the political ladder and passes every other ladder through', () => {
    expect(displayWeeklySalary('political', 100_000)).toBe(Math.round(100_000 / WEEKS_PER_YEAR));
    expect(displayWeeklySalary('technology', 100_000)).toBe(100_000);
    expect(displayWeeklySalary(undefined, 5_000)).toBe(5_000);
  });

  it('agrees with `weeklyCareerSalary` for the job the player actually holds', () => {
    // Two functions, one rule. If they can disagree, the DTI gate and the
    // screen above it are back to showing different numbers.
    for (let level = 0; level < POLITICAL_CAREER.levels.length; level++) {
      const state = {
        currentJob: 'political',
        careers: [{ ...POLITICAL_CAREER, level, accepted: true }],
      } as unknown as Parameters<typeof weeklyCareerSalary>[0];
      const viaJob = weeklyCareerSalary(state);
      const viaDisplay = displayWeeklySalary('political', POLITICAL_CAREER.levels[level].salary);
      expect(`level ${level}: ${viaDisplay}`).toBe(`level ${level}: ${viaJob}`);
    }
  });

  it('never emits NaN, Infinity or a negative from a corrupt save', () => {
    for (const bad of [undefined, null, NaN, Infinity, -1, 0, '5000']) {
      const v = displayWeeklySalary('political', bad as number);
      expect(`${String(bad)}: ${Number.isInteger(v) && v >= 0}`).toBe(`${String(bad)}: true`);
    }
  });

  it('keeps `political` the only annual ladder', () => {
    // A second annual ladder added without updating the set would silently
    // reintroduce the 52x bug on that ladder alone.
    expect([...ANNUAL_SALARY_CAREER_IDS]).toEqual(['political']);
    expect(isAnnualSalaryCareer('political')).toBe(true);
    expect(isAnnualSalaryCareer('technology')).toBe(false);
    expect(isAnnualSalaryCareer(undefined)).toBe(false);
  });

  it('a President is worth four figures a week, not six', () => {
    // The number in the support report, pinned.
    const president = POLITICAL_CAREER.levels[POLITICAL_CAREER.levels.length - 1].salary;
    expect(president).toBe(100_000);
    expect(displayWeeklySalary('political', president)).toBeLessThan(2_500);
  });
});

describe('no screen reads the raw salary into a weekly label', () => {
  /**
   * Surfaces that print a career salary with a weekly suffix. Each must route
   * through one of the two converters rather than reading `levels[].salary`.
   */
  const SURFACES = [
    'app/(tabs)/work.tsx',
    'components/CareerPathCard.tsx',
    'components/ShareLifeCard.tsx',
    'components/IdentityCard.tsx',
    'components/computer/PoliticalApp.tsx',
    'contexts/game/actions/JobActions.ts',
  ];

  it.each(SURFACES)('%s converts before displaying', (rel) => {
    const src = code(rel);
    expect(src).toMatch(/displayWeeklySalary|weeklyCareerSalary/);
  });

  it('the Politics app no longer calls the annual figure weekly', () => {
    const src = code('components/computer/PoliticalApp.tsx');
    // The exact expression that shipped the bug: the variable was named
    // `salaryWeekly` and assigned the raw annual `POLITICAL_CAREER` salary.
    expect(src).not.toMatch(/salaryWeekly\s*=\s*careerLevel >= 1 \? \(POLITICAL_CAREER/);
    expect(src).toMatch(/displayWeeklySalary\('political'/);
  });

  it('the promotion celebration is fed a weekly figure at the source', () => {
    // `PendingPromotion.fromSalary` is documented as weekly and rendered with
    // "/wk", so the conversion belongs where the record is built, not in the
    // modal — otherwise every future reader has to remember to divide.
    const src = code('contexts/game/actions/JobActions.ts');
    expect(src).toMatch(/displayWeeklySalary\(careerId, applyRaisePremium/);
  });
});
