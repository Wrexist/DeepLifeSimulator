/**
 * R4 completion of GL-5 — three of the four ways to go into debt never recorded
 * it.
 *
 * `progress.hasBeenInDebt` gates the "Debt Free" achievement and, since R3-P11,
 * the "Clean Slate" prestige bonus (2,000 pts). GL-5 made `acceptLoan` set it
 * and the comment there described that function as "the ONLY writer" — which
 * was the finding, not the fix. Student loans, auto loans and mortgages each
 * originate a `Loan` in their own module and none of them stamped the flag.
 *
 * So a player who financed a car or a house, paid it off and never opened the
 * generic Loans screen sat at `hasBeenInDebt === false` forever — locked out of
 * two rewards that describe exactly what they did. `Clean Slate` also reads
 * `loans.length > 0` as a fallback, which a fully-repaid-and-cleared borrower
 * no longer satisfies.
 *
 * These drive the REAL action modules and read the REAL flag. 2026-07-31 audit
 * round 4.
 */
import fs from 'fs';
import path from 'path';
import type React from 'react';
import { acceptLoan } from '@/contexts/game/actions/LoanActions';
import { enrollInProgram } from '@/contexts/game/actions/EducationActions';
import { purchaseVehicleWithAutoLoan } from '@/contexts/game/actions/VehicleActions';
import { buyPropertyWithMortgage } from '@/contexts/game/actions/RealEstateActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, RealEstate } from '@/contexts/game/types';

/** A funded, licensed adult with an empty loan book and the flag unset. */
function borrower(): GameState {
  const base = createTestGameState();
  return createTestGameState({
    stats: { ...base.stats, money: 2_000_000 },
    loans: [],
    hasDriversLicense: true,
    progress: { ...(base.progress ?? {}), hasBeenInDebt: false },
  });
}

/**
 * Runs an action that takes a React setState and returns the resulting state.
 *
 * The updater form is the only one these actions use; a direct value would mean
 * a non-functional write, which the codebase forbids, so it throws rather than
 * silently accepting one.
 */
type Setter = (updater: React.SetStateAction<GameState>) => void;

function run(action: (set: Setter) => void, from: GameState): GameState {
  let state = from;
  action((updater) => {
    if (typeof updater !== 'function') {
      throw new Error('action wrote a raw value instead of a functional updater');
    }
    state = updater(state);
  });
  return state;
}

const CONDO = {
  id: 'test-condo',
  name: 'Test Condo',
  price: 300_000,
  owned: false,
} as unknown as RealEstate;

describe('every way to borrow records that the player borrowed', () => {
  it('the fixture starts un-flagged (guards every assertion below)', () => {
    expect(borrower().progress?.hasBeenInDebt).toBe(false);
    expect(borrower().loans).toEqual([]);
  });

  it('a personal loan sets it', () => {
    const after = run(
      (set) => acceptLoan(set as never, {
        principal: 10_000,
        termWeeks: 260,
        type: 'personal',
        name: 'Personal Loan',
        weeklyIncome: 5_000,
        depositAccountId: 'checking-default',
      }),
      borrower(),
    );

    expect(after.loans?.length).toBeGreaterThan(0);
    expect(after.progress?.hasBeenInDebt).toBe(true);
  });

  it('a student loan sets it', () => {
    const after = run(
      (set) => enrollInProgram(set as never, {
        templateId: 'law_school',
        name: 'Law School',
        description: 'Law School',
        cost: 100_000,
        duration: 156,
        mode: 'loan',
      }),
      borrower(),
    );

    expect(after.loans?.length).toBeGreaterThan(0);
    expect(after.progress?.hasBeenInDebt).toBe(true);
  });

  it('an auto loan sets it', () => {
    const start = borrower();
    const after = run(
      (set) => purchaseVehicleWithAutoLoan(set as never, {
        templateId: 'economy_sedan',
        tier: 'standard',
        term: '5y',
        weeklyIncome: 5_000,
      }),
      start,
    );

    if ((after.loans ?? []).length === 0) throw new Error('no auto loan was created — nothing to assert on');
    expect(after.progress?.hasBeenInDebt).toBe(true);
  });

  it('a mortgage sets it', () => {
    const after = run(
      (set) => buyPropertyWithMortgage(set as never, {
        property: CONDO,
        tier: 'standard',
        term: '30y',
        weeklyIncome: 5_000,
      } as never),
      borrower(),
    );

    if ((after.loans ?? []).length === 0) throw new Error('no mortgage was created — nothing to assert on');
    expect(after.progress?.hasBeenInDebt).toBe(true);
  });

  it('a CASH vehicle purchase does NOT set it', () => {
    // The control. Stamping unconditionally would "fix" this by handing the
    // Debt Free achievement to someone who never borrowed a cent.
    const after = run(
      (set) => purchaseVehicleWithAutoLoan(set as never, {
        templateId: 'economy_sedan',
        tier: 'cash',
        term: '5y',
        weeklyIncome: 5_000,
      }),
      borrower(),
    );

    expect(after.loans ?? []).toEqual([]);
    expect(after.progress?.hasBeenInDebt).toBe(false);
  });
});

describe('the stamp is applied through the shared helper, not re-implemented', () => {
  const read = (rel: string): string =>
    fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

  it('no module writes hasBeenInDebt by hand any more', () => {
    // A hand-rolled write is how three of the four sites came to be missing it.
    // `debtProgress` in LoanActions is the single writer.
    const dir = path.join(__dirname, '..', '..', 'contexts', 'game', 'actions');
    const offenders = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => path.join('contexts/game/actions', f))
      .filter((rel) => {
        const body = read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
        return /hasBeenInDebt\s*:/.test(body) && !rel.endsWith('LoanActions.ts');
      });

    expect(offenders).toEqual([]);
  });

  it('LoanActions still owns exactly one assignment', () => {
    const body = read('contexts/game/actions/LoanActions.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    expect((body.match(/hasBeenInDebt:\s*true/g) ?? []).length).toBe(1);
  });
});
