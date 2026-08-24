/**
 * C-2 — Family-business Brand and Reputation now change outcomes.
 *
 * `manageFamilyBusiness` charges $10,000 (marketing), $50,000 (branding) or
 * $25,000 (reputation) for actions that raise `brandValue` and `reputation`.
 * `brandValue` was rendered as a meter in `CompanyDetailScreen` and read by
 * NOTHING else. `reputation` was read by nothing at all. The player paid real
 * money to move two bars that changed no outcome — the same class as the
 * Commitment system, and the reason both were held for a product decision.
 *
 * Owner's call: wire them, reusing the shape `hustleLogic` already uses for
 * regular companies. Brand drives money; reputation drives scrutiny.
 *
 *   brandValue → the business's weekly passive income
 *   reputation → its organic scandal odds
 *
 * Both curves are built so an UNTOUCHED business lands on exactly 1.0.
 * `createFamilyBusiness` seeds brand 0 and reputation 50, so no existing
 * save's income or scandal rate moves until the player spends on it. Brand is
 * pure upside for the same reason: brand 0 is the default state, not a failing
 * one, and taxing it would be a stealth nerf dressed as a bug fix.
 *
 * 2026-08-01, product decision taken by the owner.
 */
import {
  familyBrandIncomeMultiplier,
  familyReputationScandalMultiplier,
  findFamilyBusiness,
  MAX_BRAND_INCOME_BONUS,
} from '@/lib/business/familyBusinessEffects';
import { calcWeeklyPassiveIncome } from '@/lib/economy/passiveIncome';
import { createTestGameState } from '../helpers/createTestGameState';
import type { Company, GameState } from '@/contexts/game/types';

describe('C-2 - the brand curve', () => {
  it('an untouched business is EXACTLY neutral', () => {
    // createFamilyBusiness seeds brandValue: 0. Nothing may move for a save
    // that has never bought marketing.
    expect(familyBrandIncomeMultiplier(0)).toBe(1);
  });

  it('a maxed brand pays the documented bonus', () => {
    expect(familyBrandIncomeMultiplier(100)).toBeCloseTo(1 + MAX_BRAND_INCOME_BONUS, 10);
  });

  it('is monotonic in between', () => {
    expect(familyBrandIncomeMultiplier(50)).toBeGreaterThan(familyBrandIncomeMultiplier(0));
    expect(familyBrandIncomeMultiplier(100)).toBeGreaterThan(familyBrandIncomeMultiplier(50));
  });

  it('never penalises, at any value', () => {
    // Brand is pure upside by design — see the module header.
    for (const v of [0, 1, 25, 50, 99, 100]) {
      expect(`brand ${v}: ${familyBrandIncomeMultiplier(v) >= 1}`).toBe(`brand ${v}: true`);
    }
  });

  it('a corrupt meter reads as neutral, not NaN (the control)', () => {
    for (const bad of [undefined, NaN, Infinity, -50, 1e9]) {
      const m = familyBrandIncomeMultiplier(bad as number);
      expect(`${String(bad)}: finite=${Number.isFinite(m)} inRange=${m >= 1 && m <= 1 + MAX_BRAND_INCOME_BONUS}`)
        .toBe(`${String(bad)}: finite=true inRange=true`);
    }
  });
});

describe('C-2 - the reputation curve', () => {
  it('the SEEDED reputation of 50 is exactly neutral', () => {
    expect(familyReputationScandalMultiplier(50)).toBe(1);
  });

  it('a good reputation draws less scrutiny, a bad one more', () => {
    expect(familyReputationScandalMultiplier(100)).toBeLessThan(1);
    expect(familyReputationScandalMultiplier(0)).toBeGreaterThan(1);
  });

  it('but reputation never buys immunity', () => {
    // A multiplier at or near zero would delete the scandal system - and the
    // whole resolution UI built for it - for anyone who invests.
    expect(familyReputationScandalMultiplier(100)).toBeGreaterThan(0.5);
  });

  it('and a terrible reputation is not a death sentence either', () => {
    expect(familyReputationScandalMultiplier(0)).toBeLessThan(2);
  });

  it('a corrupt meter reads as neutral (the control)', () => {
    for (const bad of [undefined, NaN, Infinity]) {
      expect(`${String(bad)}: ${familyReputationScandalMultiplier(bad as number)}`)
        .toBe(`${String(bad)}: 1`);
    }
  });
});

describe('C-2 - brand reaches the weekly income', () => {
  function withCompany(brandValue: number | null): GameState {
    const base = createTestGameState();
    return createTestGameState({
      ...base,
      companies: [{
        id: 'co-1', name: 'Acme', weeklyIncome: 10_000, employees: 1,
      } as unknown as Company],
      familyBusinesses: brandValue === null ? [] : [{
        companyId: 'co-1', foundedGeneration: 1, generationsHeld: 1,
        brandValue, reputation: 50,
      }],
    } as never);
  }

  /**
   * `calcWeeklyPassiveIncome` returns `{ total, breakdown }`, not the breakdown
   * itself. The first version of this file read `.companies` off the wrapper,
   * which made the two controls below compare `undefined` to `undefined` and
   * pass for the wrong reason. Read through `.breakdown`, and assert the
   * baseline is non-zero so the comparison has something to bite on.
   */
  const companyIncome = (s: GameState) => calcWeeklyPassiveIncome(s).breakdown.companies;

  it('a branded family business earns more than an unbranded one', () => {
    const plain = companyIncome(withCompany(0));
    const branded = companyIncome(withCompany(100));

    expect(plain).toBeGreaterThan(0);
    expect(branded).toBeGreaterThan(plain);
  });

  it('a company that is NOT a family business is untouched (the control)', () => {
    // The multiplier must not leak onto every company in the game.
    const notFamily = companyIncome(withCompany(null));
    const familyAtZero = companyIncome(withCompany(0));

    expect(notFamily).toBeGreaterThan(0);
    expect(notFamily).toBe(familyAtZero);
  });

  it('and brand 0 pays exactly what it paid before (the control)', () => {
    // The no-regression guarantee for existing saves, stated as a number
    // rather than a promise: an untouched family business earns the same as a
    // plain company with the same weeklyIncome.
    expect(companyIncome(withCompany(0))).toBeGreaterThan(0);
    expect(companyIncome(withCompany(0))).toBe(companyIncome(withCompany(null)));
  });
});

describe('C-2 - reputation reaches the scandal roll', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

  it('the roll multiplies the existing chance rather than replacing it', () => {
    // The size gate and post-scandal cooldown above it must keep working.
    expect(read('lib/business/hustleLogic.ts'))
      .toMatch(/scandalSpawnChance\(brand, income\)\s*\n?\s*\* familyReputationScandalMultiplier\(familyReputation\)/);
  });

  it('and the tick passes the family reputation through', () => {
    const tick = read('lib/business/hustleTick.ts');

    expect(tick).toMatch(/state\.familyBusinesses\?\.find\(fb => fb\?\.companyId === company\.id\)\?\.reputation/);
    expect(tick).toMatch(/rollScandalForWeek\(company, o, nextWeeksLived, familyRep\)/);
  });

  it('a non-family company passes undefined, which is neutral (the control)', () => {
    expect(familyReputationScandalMultiplier(undefined)).toBe(1);
  });
});

describe('C-2 - the lookup helper', () => {
  const rows = [{ companyId: 'a', brandValue: 10, reputation: 60 }];

  it('finds a family business by company id', () => {
    expect(findFamilyBusiness(rows, 'a')?.brandValue).toBe(10);
  });

  it('and returns undefined for anything else, without throwing', () => {
    expect(findFamilyBusiness(rows, 'b')).toBeUndefined();
    expect(findFamilyBusiness(rows, undefined)).toBeUndefined();
    expect(findFamilyBusiness(undefined, 'a')).toBeUndefined();
    expect(findFamilyBusiness(null, 'a')).toBeUndefined();
    expect(findFamilyBusiness([null as never], 'a')).toBeUndefined();
  });
});
