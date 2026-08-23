/**
 * Source-scoped perk incomes (2026-08-23).
 *
 * crime_boss, landlord and financial_guru sold source-specific boosts and all
 * landed in one unscoped product over TOTAL income — crime_boss did not even
 * touch street pay, which is paid at action time and never enters the weekly
 * aggregate. Each is now paid at the source its card names and EXCLUDED from
 * the global product, so nothing applies twice.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import {
  computeWeeklyIncome,
  SOURCE_SCOPED_PERK_IDS,
  FINANCIAL_GURU_SALARY_MULT,
} from '@/contexts/game/actions/weekly/applyIncome';
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');
const code = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

const stateWithPerks = (perks: Record<string, boolean>): GameState => ({
  ...createTestGameState(),
  // Past the beginner-luck window on a fresh-life baseline, so the salary
  // delta below is the only moving part.
  weeksLived: 500,
  lifeStartWeek: 400,
  perks,
} as GameState);

const income = (perks: Record<string, boolean>, careerSalary = 1000) =>
  computeWeeklyIncome({
    prevState: stateWithPerks(perks),
    careerSalary,
    passiveIncome: 2000,
    pulseEarnings: 0,
    weeksLivedNow: 500,
    unlockedBonuses: [],
    economyIncomeMultiplier: 1,
  });

describe('financial_guru — +7% on the SALARY term only', () => {
  it('boosts exactly the salary slice of base income', () => {
    const base = income({});
    const guru = income({ financial_guru: true });
    expect(guru.baseTotalIncome - base.baseTotalIncome)
      .toBe(Math.round(1000 * FINANCIAL_GURU_SALARY_MULT) - 1000);
  });

  it('does nothing for a jobless life (the scoping, proven)', () => {
    expect(income({ financial_guru: true }, 0).totalIncome)
      .toBe(income({}, 0).totalIncome);
  });
});

describe('the scoped perks are OUT of the global product', () => {
  it('crime_boss and landlord no longer move weekly aggregate income at all', () => {
    const base = income({});
    expect(income({ crime_boss: true }).totalIncome).toBe(base.totalIncome);
    expect(income({ landlord: true }).totalIncome).toBe(base.totalIncome);
  });

  it('the exclusion set names exactly the three re-scoped ids', () => {
    expect([...SOURCE_SCOPED_PERK_IDS].sort())
      .toEqual(['crime_boss', 'financial_guru', 'landlord']);
  });
});

describe('each is paid at its promised source (source pins)', () => {
  it('crime_boss multiplies the street-job payout', () => {
    const src = code('contexts/game/actions/JobActions.ts');
    expect(src).toMatch(/crimeBossMult = gameState\.perks\?\.crime_boss \? 1\.1 : 1/);
    expect(src).toMatch(/talentPayMultiplier \* crimeBossMult/);
  });

  it('landlord multiplies rental income inside the capped tick', () => {
    const src = code('contexts/game/actions/weekly/applyRentAndHousing.ts');
    expect(src).toMatch(/perks\?\.landlord \? 1\.07 : 1/);
  });
});
