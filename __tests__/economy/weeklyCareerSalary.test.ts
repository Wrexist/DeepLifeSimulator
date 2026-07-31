/**
 * A President's borrowing capacity was 52x what it should have been.
 *
 * `Career.levels[].salary` is WEEKLY for every ladder except `political`, whose
 * POLITICAL_CAREER levels are ANNUAL (800 for a Local Council Member up to
 * 100,000 for a President). The repo says so in two places: `passiveIncome.ts`
 * divides by WEEKS_PER_YEAR, and `applyCareerSalaryAndPenalty` skips the
 * political salary on the generic weekly path precisely to avoid paying an
 * annual figure every week.
 *
 * Four screens — AdvancedBankApp, BankApp, RealEstateApp, VehicleApp — each
 * carried their own copy of the same memo and each read `levels[level].salary`
 * straight into the number handed to the DTI gate as weekly income. Winning an
 * election sets `currentJob: 'political'` with the annual ladder attached, so
 * `exceedsDTI` saw $100,000/week instead of $1,923 and allowed ~$43,000/week of
 * debt service instead of ~$827, on a principal field with no other ceiling.
 * Combined with R3-M2's floored APR that is a ~$47M loan where ~$900k was
 * intended, credited straight to `stats.money`.
 * 2026-07-31 audit round 3, R3-M3.
 */
import { weeklyCareerSalary, isAnnualSalaryCareer } from '@/lib/careers/weeklySalary';
import { POLITICAL_CAREER } from '@/lib/careers/political';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

type SalaryState = Parameters<typeof weeklyCareerSalary>[0];

function employedAs(id: string, level: number, levels: { name: string; salary: number }[]): SalaryState {
  return {
    currentJob: id,
    careers: [{ id, accepted: true, level, levels }],
  } as SalaryState;
}

describe('the political ladder is treated as annual', () => {
  it('really does store annual figures (guards everything below)', () => {
    // If these were weekly, dividing would be the bug.
    const president = POLITICAL_CAREER.levels[POLITICAL_CAREER.levels.length - 1];
    expect(president.salary).toBe(100_000);
  });

  it('converts a President to a weekly figure', () => {
    const state = employedAs('political', 5, POLITICAL_CAREER.levels);

    expect(weeklyCareerSalary(state)).toBe(Math.round(100_000 / WEEKS_PER_YEAR));
    // The bug in one number: the raw annual figure must not come back.
    expect(weeklyCareerSalary(state)).not.toBe(100_000);
  });

  it('converts every rung, not just the top one', () => {
    POLITICAL_CAREER.levels.forEach((level, index) => {
      const weekly = weeklyCareerSalary(employedAs('political', index, POLITICAL_CAREER.levels));
      expect(weekly).toBe(Math.round(level.salary / WEEKS_PER_YEAR));
      expect(weekly).toBeLessThan(level.salary);
    });
  });

  it('names political as annual and an ordinary career as not', () => {
    expect(isAnnualSalaryCareer('political')).toBe(true);
    expect(isAnnualSalaryCareer('software_engineer')).toBe(false);
    expect(isAnnualSalaryCareer(undefined)).toBe(false);
  });
});

describe('every other ladder stays weekly', () => {
  it('does NOT divide an ordinary career', () => {
    // The control in the other direction: dividing everything would fix the
    // political case while quietly cutting every normal job's income by 52.
    const state = employedAs('software_engineer', 1, [
      { name: 'Junior', salary: 900 },
      { name: 'Senior', salary: 1_800 },
    ]);

    expect(weeklyCareerSalary(state)).toBe(1_800);
  });
});

describe('it never returns NaN, which would approve every loan', () => {
  it('returns 0 when unemployed', () => {
    expect(weeklyCareerSalary({ currentJob: undefined, careers: [] } as SalaryState)).toBe(0);
  });

  it('returns 0 for a job that was never accepted', () => {
    const state = {
      currentJob: 'political',
      careers: [{ id: 'political', accepted: false, level: 5, levels: POLITICAL_CAREER.levels }],
    } as SalaryState;

    expect(weeklyCareerSalary(state)).toBe(0);
  });

  it('clamps a level beyond the ladder rather than reading undefined', () => {
    const weekly = weeklyCareerSalary(employedAs('political', 99, POLITICAL_CAREER.levels));

    expect(Number.isFinite(weekly)).toBe(true);
    expect(weekly).toBe(Math.round(100_000 / WEEKS_PER_YEAR));
  });

  it('survives corrupt salary values', () => {
    // `NaN < x` is false, so a NaN income slips past `exceedsDTI` entirely.
    for (const bad of [NaN, Infinity, -5, undefined, 'lots']) {
      const weekly = weeklyCareerSalary(
        employedAs('generic', 0, [{ name: 'X', salary: bad as number }]),
      );
      expect(Number.isFinite(weekly)).toBe(true);
      expect(weekly).toBeGreaterThanOrEqual(0);
    }
  });

  it('survives a career entry with no levels array', () => {
    const state = {
      currentJob: 'broken',
      careers: [{ id: 'broken', accepted: true, level: 2 }],
    } as SalaryState;

    expect(weeklyCareerSalary(state)).toBe(0);
  });
});

describe('all four screens use the shared helper', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');

  const SCREENS = [
    'components/computer/AdvancedBankApp.tsx',
    'components/mobile/BankApp.tsx',
    'components/computer/RealEstateApp.tsx',
    'components/computer/VehicleApp.tsx',
  ];

  it('none of them still reads levels[safeLevel].salary directly', () => {
    // The duplicated block is what made one bug into four.
    for (const rel of SCREENS) {
      const source = fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');
      expect(source).not.toMatch(/income \+= job\.levels\[safeLevel\]\?\.salary/);
      expect(source).toMatch(/weeklyCareerSalary\(gameState\)/);
    }
  });
});
