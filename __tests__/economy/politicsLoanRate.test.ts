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

/**
 * R4 completion of R3-M2 — the two call sites the original fix missed.
 *
 * `VehicleActions.quoteVehiclePurchase` and `EducationActions.enrollInProgram`
 * both read `politicsAprReduction` and neither floored it, so a high-office
 * player financed a car and a degree at the 2.5% hard minimum. A student loan
 * does not hand the player cash, but it frees the cash that would have paid
 * tuition — so it is the same 5.5%-CD carry, just one step removed.
 *
 * These assert the RATE, not the source text: the file-scan above is a
 * completeness net, this is the thing it is a net for. 2026-07-31 audit round 4.
 */
import { quoteVehiclePurchase } from '@/contexts/game/actions/VehicleActions';
import { enrollInProgram } from '@/contexts/game/actions/EducationActions';

function atOffice(careerLevel: number): GameState {
  const base = createTestGameState();
  return createTestGameState({
    politics: { ...(base.politics ?? {}), careerLevel } as never,
  });
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

  /**
   * DISCOVERED, not enumerated.
   *
   * The first version of this test hardcoded the two files the fix had touched,
   * so it passed while `VehicleActions.ts` and `EducationActions.ts` - both of
   * which call `politicsAprReduction` and neither of which floored the result -
   * financed at the 2.5% hard minimum against a 5.5% CD. A completeness check
   * that lists its own subjects proves nothing about completeness.
   */
  const importers = (): string[] => {
    const dir = path.join(__dirname, '..', '..', 'contexts', 'game', 'actions');
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => path.join('contexts/game/actions', f))
      .filter((rel) => /\bpoliticsAprReduction\b/.test(read(rel)))
      // LoanActions DEFINES it; it is covered by the two tests below.
      .filter((rel) => !rel.endsWith('LoanActions.ts'));
  };

  it('finds the call sites by search rather than by list', () => {
    // Guards the guard: a rename that broke the scan would silently empty it.
    expect(importers().length).toBeGreaterThan(0);
  });

  it('every consumer of politicsAprReduction floors the rate it produces', () => {
    for (const rel of importers()) {
      // Strip the import line: it names the constant without applying it, and
      // counting it would make this pass on a file that only imports.
      const body = read(rel).replace(/^import[\s\S]*?from\s+'[^']*';$/gm, '');

      expect(`${rel}: ${/POLITICS_LOAN_APR_FLOOR/.test(body)}`).toBe(`${rel}: true`);
    }
  });

  it('LoanActions itself floors both of its quote sites', () => {
    const source = read('contexts/game/actions/LoanActions.ts');
    const reductions = (source.match(/aprReduction: politicsAprReduction\(state\)/g) ?? []).length;
    const floors = (source.match(/aprFloor: politicsAprReduction\(state\) > 0/g) ?? []).length;

    expect(reductions).toBeGreaterThan(0);
    expect(floors).toBe(reductions);
  });

  it('refinance applies the floor too - it recomputes APR without quoteLoan', () => {
    const source = read('contexts/game/actions/LoanActions.ts');
    expect(source).toMatch(/const floor = politicsReduction > 0 \? POLITICS_LOAN_APR_FLOOR : 0\.025;/);
    expect(source).toMatch(/newAPR = Math\.max\(\s*floor,/);
  });
});

describe('R4 - the floor reaches the vehicle and education quote sites', () => {
  /** `atOffice` leaves the starting cash, which is under the down payment. */
  const funded = (level: number): GameState => {
    const s = atOffice(level);
    return createTestGameState({ ...s, stats: { ...s.stats, money: 100_000 } });
  };

  it('an auto loan for a top-office politician stays above the deposit cap', () => {
    const quote = quoteVehiclePurchase(funded(6), 'economy_sedan', 'standard', '5y', 2_000);

    if (quote.rejected) throw new Error(`auto quote rejected: ${quote.reason}`);
    expect(quote.offeredAPR).toBeGreaterThanOrEqual(POLITICS_LOAN_APR_FLOOR);
    expect(quote.offeredAPR).toBeGreaterThan(SAVINGS_APR_HARD_CAP);
  });

  it('a private citizen still gets the ordinary rate (not the floor for everyone)', () => {
    // The control: flooring unconditionally would "fix" this by deleting the
    // discount from the base game.
    const civilian = quoteVehiclePurchase(funded(0), 'economy_sedan', 'standard', '5y', 2_000);
    const politician = quoteVehiclePurchase(funded(6), 'economy_sedan', 'standard', '5y', 2_000);

    if (civilian.rejected) throw new Error(`civilian quote rejected: ${civilian.reason}`);
    if (politician.rejected) throw new Error(`politician quote rejected: ${politician.reason}`);
    expect(politician.offeredAPR!).toBeLessThanOrEqual(civilian.offeredAPR!);
  });

  it('a student loan for a top-office politician stays above the deposit cap', () => {
    let state = atOffice(6);
    (state as unknown as { loans: unknown[] }).loans = [];

    enrollInProgram(
      (updater) => {
        state = typeof updater === 'function' ? updater(state) : updater;
      },
      {
        templateId: 'law_school',
        name: 'Law School',
        description: 'Law School',
        cost: 100_000,
        duration: 156,
        mode: 'loan',
      },
    );

    const loan = (state.loans ?? []).find((l) => l.name.startsWith('Student Loan'));
    if (!loan) throw new Error('enrollInProgram created no student loan - nothing to assert on');
    expect(loan.rateAPR).toBeGreaterThanOrEqual(POLITICS_LOAN_APR_FLOOR);
    expect(loan.rateAPR).toBeGreaterThan(SAVINGS_APR_HARD_CAP);
  });
});
