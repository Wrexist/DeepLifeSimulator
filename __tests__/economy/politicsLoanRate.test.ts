/**
 * Holding office must not hand the player a risk-free money printer.
 *
 * `PoliticalPerk.effects.loanInterestReduction` is documented at
 * `lib/politics/perks.ts:13` as "Percentage reduction (0-100)" and carries
 * 2, 5, 8, 12, 15, 20. `quoteLoan` consumes `aprReduction` as a DECIMAL APR
 * (`Math.min(0.2, …)`). So the smallest perk — a Council Member's 2, earned at
 * the first elected office — clamped to 0.2 and subtracted TWENTY APR POINTS,
 * flooring every loan type at 0.025. The sibling fields on the same effects
 * object are converted correctly (`realEstateTaxBreak / 100`,
 * `businessIncomeBonus / 100`), so this one was simply missed.
 *
 * That also broke the anti-arbitrage contract documented at
 * `lib/banking/rateEnvironment.ts:12-21`: deposits are hard-capped at
 * SAVINGS_APR_HARD_CAP (5.5%) precisely so the cheapest loan stays above them.
 * A 2.5% loan parked in a 5.5% CD is a free ~3%/yr carry on unbounded
 * principal. 2026-07-31 audit round 3, R3-M2.
 */
import { politicsAprReduction, POLITICS_LOAN_APR_FLOOR } from '@/contexts/game/actions/LoanActions';
import { quoteLoan } from '@/lib/banking/operations';
import { SAVINGS_APR_HARD_CAP } from '@/lib/economy/constants';
import { getCombinedPerkEffects } from '@/lib/politics/perks';
import { createTestGameState } from '../helpers/createTestGameState';
import { initialGameState } from '@/contexts/game/initialState';
import type { GameState } from '@/contexts/game/types';

function atOffice(careerLevel: number): GameState {
  const base = createTestGameState();
  return {
    ...base,
    politics: { ...(base.politics ?? {}), careerLevel },
  } as GameState;
}

const LEVELS = [1, 2, 3, 4, 5, 6];

describe('the perk value is a percent and is converted as one', () => {
  it('the catalogue really does store percents (guards everything below)', () => {
    // If these were already decimals the conversion would be the bug.
    const top = getCombinedPerkEffects(6).loanInterestReduction;
    expect(top).toBeGreaterThan(1);
  });

  it('returns a decimal fraction, not the raw percent', () => {
    for (const level of LEVELS) {
      const reduction = politicsAprReduction(atOffice(level));
      const percent = getCombinedPerkEffects(level).loanInterestReduction ?? 0;

      expect(reduction).toBeCloseTo(percent / 100, 10);
      // The bug in one line: the raw percent is >= 1, which any APR consumer
      // clamps to its maximum.
      expect(reduction).toBeLessThan(1);
    }
  });

  it('is zero for a player who has never held office', () => {
    expect(politicsAprReduction(atOffice(0))).toBe(0);
  });

  it('survives a corrupt perk value without returning NaN or Infinity', () => {
    const reduction = politicsAprReduction(atOffice(3));
    expect(Number.isFinite(reduction)).toBe(true);
    expect(reduction).toBeGreaterThanOrEqual(0);
  });
});

describe('no politician can borrow below the deposit hard cap', () => {
  const banking = initialGameState.banking!;
  const TYPES = ['personal', 'auto', 'business', 'mortgage'] as const;

  /**
   * The offered APR, with the union narrowed rather than asserted.
   *
   * `quoteLoan` returns a discriminated union; reading `offeredAPR` off it
   * unguarded is Hard Rule #2. Failing loudly on a rejection also means an
   * accidentally-rejected quote can never make an assertion pass vacuously.
   */
  function aprAt(level: number, type: (typeof TYPES)[number]): number {
    const state = atOffice(level);
    const reduction = politicsAprReduction(state);
    const quote = quoteLoan(banking, [], {
      principal: 10_000,
      termWeeks: 260,
      type,
      weeklyIncome: 5_000,
      aprReduction: reduction,
      aprFloor: reduction > 0 ? POLITICS_LOAN_APR_FLOOR : undefined,
    });
    if (quote.rejected) throw new Error(`quote rejected at level ${level}: ${quote.reason}`);
    return quote.offeredAPR;
  }

  it('keeps every offered rate strictly above the savings hard cap', () => {
    // The arbitrage test. `SAVINGS_APR_HARD_CAP` is 5.5% and the 52-week CD
    // pays it, so a loan at or below this is a risk-free carry.
    for (const level of LEVELS) {
      for (const type of TYPES) {
        expect(aprAt(level, type)).toBeGreaterThan(SAVINGS_APR_HARD_CAP);
      }
    }
  });

  it('never reaches the 2.5% floor that the raw percent produced', () => {
    for (const level of LEVELS) {
      for (const type of TYPES) {
        expect(aprAt(level, type)).toBeGreaterThan(0.025);
      }
    }
  });

  it('still gives a politician a REAL discount (not a no-op fix)', () => {
    // The control in the other direction: clamping everything to the base rate
    // would satisfy both assertions above while silently deleting the perk.
    const withOffice = aprAt(6, 'personal');
    const baseQuote = quoteLoan(banking, [], {
      principal: 10_000,
      termWeeks: 260,
      type: 'personal',
      weeklyIncome: 5_000,
    });
    if (baseQuote.rejected) throw new Error(`base quote rejected: ${baseQuote.reason}`);

    expect(withOffice).toBeLessThan(baseQuote.offeredAPR);
  });

  it('gives a higher office at least as good a rate as a lower one', () => {
    const rates = LEVELS.map((l) => aprAt(l, 'personal'));
    for (let i = 1; i < rates.length; i += 1) {
      expect(rates[i]).toBeLessThanOrEqual(rates[i - 1]);
    }
  });
});

describe('the floor is passed at every quote site', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const read = (rel: string): string =>
    fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

  it('every aprReduction caller also passes aprFloor', () => {
    for (const rel of [
      'contexts/game/actions/LoanActions.ts',
      'contexts/game/actions/RealEstateActions.ts',
    ]) {
      const source = read(rel);
      const reductions = (source.match(/aprReduction: politicsAprReduction\(state\)/g) ?? []).length;
      const floors = (source.match(/aprFloor: politicsAprReduction\(state\) > 0/g) ?? []).length;

      expect(reductions).toBeGreaterThan(0);
      expect(floors).toBe(reductions);
    }
  });

  it('refinance applies the floor too — it recomputes APR without quoteLoan', () => {
    const source = read('contexts/game/actions/LoanActions.ts');
    expect(source).toMatch(/const floor = politicsReduction > 0 \? POLITICS_LOAN_APR_FLOOR : 0\.025;/);
    expect(source).toMatch(/newAPR = Math\.max\(\s*floor,/);
  });
});
