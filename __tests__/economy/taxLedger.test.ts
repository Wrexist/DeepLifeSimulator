/**
 * The tax system gets a ledger, a surface, and one answer to "you cannot pay".
 *
 * Before this, `banking.taxDueThisYear` was the purest form of the bug this
 * audit keeps finding: a field with TWO readers (the desktop statement's "Tax
 * accrued this year" row and the phone ledger's "Tax due" chip), both gated on
 * `> 0`, and **no writer anywhere in the repo**. Both rows were dead on every
 * save ever made. `docs/app-depth-audit.json` flagged it and nothing happened.
 *
 * The other half is consistency. Five tax mechanisms disagreed on rate, cadence
 * and — worst — on what happens when the player cannot afford the bill:
 *
 *   income tax  → defers into `overdueBalance` (v31)
 *   crypto      → carries the untaxed gain into next year
 *   stocks      → written off entirely
 *
 * so "sell into a gain while broke" was the one tax-free realization in the
 * game. Stocks now defer like income tax does.
 */

import {
  CAPITAL_GAINS_TAX_RATE,
  TAX_YEAR_WEEKS,
  accrueYearlyTax,
  bracketBreakdown,
  clampTaxMult,
  effectiveTaxRate,
  marginalRate,
  startsNewTaxYear,
  taxYearOf,
  weekOfTaxYear,
} from '@/lib/economy/taxLedger';
import { calculateIncomeTax } from '@/lib/economy/constants';

describe('bracket breakdown', () => {
  it('splits income across bands and sums to the real bill', () => {
    const bands = bracketBreakdown(30_000);
    const total = bands.reduce((s, b) => s + b.tax, 0);
    // Rounded per band vs rounded once — allow a dollar of drift per band.
    expect(Math.abs(total - calculateIncomeTax(30_000))).toBeLessThanOrEqual(bands.length);
  });

  it('leaves the first $200/wk untaxed', () => {
    const bands = bracketBreakdown(150);
    expect(bands[0].taxedAmount).toBe(150);
    expect(bands[0].tax).toBe(0);
    expect(bands.slice(1).every((b) => b.taxedAmount === 0)).toBe(true);
  });

  it('marks exactly one current band', () => {
    for (const income of [150, 500, 3_000, 12_000, 400_000]) {
      const current = bracketBreakdown(income).filter((b) => b.isCurrent);
      expect(`${income}:${current.length}`).toBe(`${income}:1`);
    }
  });

  it('marks no band current at zero income', () => {
    expect(bracketBreakdown(0).some((b) => b.isCurrent)).toBe(false);
  });

  it('only bands BELOW the income carry an amount', () => {
    // The misreading a bracket table exists to prevent: a $3,000 earner is not
    // paying 20% on all $3,000.
    const bands = bracketBreakdown(3_000);
    expect(bands.find((b) => b.rate === 0.2)!.taxedAmount).toBe(2_000);
    expect(bands.find((b) => b.rate === 0.3)!.taxedAmount).toBe(0);
    expect(bands.find((b) => b.rate === 0.4)!.taxedAmount).toBe(0);
  });

  it('survives garbage input', () => {
    expect(bracketBreakdown(NaN).every((b) => b.taxedAmount === 0)).toBe(true);
    expect(bracketBreakdown(-5_000).every((b) => b.tax === 0)).toBe(true);
  });
});

describe('marginal vs effective', () => {
  it('effective is always below marginal for a progressive schedule', () => {
    for (const income of [1_500, 8_000, 60_000, 500_000]) {
      const eff = effectiveTaxRate(income);
      const marg = marginalRate(income);
      expect(`${income}:${eff < marg}`).toBe(`${income}:true`);
    }
  });

  it('the Tax Strategy discount lowers the effective rate', () => {
    expect(effectiveTaxRate(60_000, 0.9)).toBeLessThan(effectiveTaxRate(60_000, 1));
  });

  it('is 0 at or below zero income', () => {
    expect(effectiveTaxRate(0)).toBe(0);
    expect(effectiveTaxRate(-100)).toBe(0);
  });

  it('clamps a corrupt multiplier rather than amplifying the bill', () => {
    expect(clampTaxMult(99)).toBe(1.5);
    expect(clampTaxMult(-3)).toBe(0.5);
    expect(clampTaxMult(undefined)).toBe(1);
    expect(clampTaxMult(NaN)).toBe(1);
  });
});

describe('the tax year', () => {
  it('runs weeks 1–52, then rolls', () => {
    expect(weekOfTaxYear(1)).toBe(1);
    expect(weekOfTaxYear(52)).toBe(52);
    expect(weekOfTaxYear(53)).toBe(1);
    expect(taxYearOf(52)).toBe(1);
    expect(taxYearOf(53)).toBe(2);
  });

  it('resets at week 53, NOT week 52', () => {
    // The crypto tick levies its yearly capital gains ON week 52
    // (`currentWeek % 52 === 0`). Resetting there would push that bill into the
    // next year's total and leave year one permanently understating itself.
    expect(startsNewTaxYear(TAX_YEAR_WEEKS)).toBe(false);
    expect(startsNewTaxYear(TAX_YEAR_WEEKS + 1)).toBe(true);
    expect(startsNewTaxYear(0)).toBe(false);
  });
});

describe('the year-to-date accumulator', () => {
  it('adds each week', () => {
    let ytd = 0;
    ytd = accrueYearlyTax(ytd, 500, 10);
    ytd = accrueYearlyTax(ytd, 500, 11);
    expect(ytd).toBe(1_000);
  });

  it('keeps the week-52 capital-gains bill inside year one', () => {
    const ytd = accrueYearlyTax(40_000, 250_000, 52);
    expect(ytd).toBe(290_000);
  });

  it('starts year two clean', () => {
    expect(accrueYearlyTax(290_000, 500, 53)).toBe(500);
  });

  it('never goes negative and tolerates a corrupt stored value', () => {
    expect(accrueYearlyTax(-99, 100, 10)).toBe(100);
    expect(accrueYearlyTax(undefined, 100, 10)).toBe(100);
    expect(accrueYearlyTax(1_000, -500, 10)).toBe(1_000);
    expect(accrueYearlyTax(1_000, NaN, 10)).toBe(1_000);
  });

  it('a full 52-week year of steady withholding lands on the obvious number', () => {
    let ytd = 0;
    for (let w = 1; w <= TAX_YEAR_WEEKS; w += 1) ytd = accrueYearlyTax(ytd, 100, w);
    expect(ytd).toBe(5_200);
    expect(accrueYearlyTax(ytd, 100, TAX_YEAR_WEEKS + 1)).toBe(100);
  });
});

describe('the rates the Tax tab quotes are the rates the ticks charge', () => {
  const read = (rel: string) =>
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('fs').readFileSync(require('path').join(__dirname, '../..', rel), 'utf8');

  it('stocks and crypto both charge CAPITAL_GAINS_TAX_RATE', () => {
    expect(CAPITAL_GAINS_TAX_RATE).toBe(0.25);
    expect(read('lib/crypto/weeklyTick.ts')).toMatch(/CAPITAL_GAINS_TAX_RATE \* clampTaxMult\(input\.taxMult\)/);
    expect(read('lib/stocks/weeklyTick.ts')).toMatch(
      /STOCK_CAPITAL_GAINS_TAX_RATE \* clampTaxMult\(input\.taxMult\)/
    );
  });

  it('the Bank app derives its bands from the same module, not a copy', () => {
    const app = read('components/computer/AdvancedBankApp.tsx');
    expect(app).toMatch(/from '@\/lib\/economy\/taxLedger'/);
    expect(app).toMatch(/bracketBreakdown\(weeklyIncome\)/);
  });
});
