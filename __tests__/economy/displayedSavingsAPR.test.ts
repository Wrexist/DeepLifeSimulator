/**
 * The advertised savings APR was not the APR that paid.
 *
 * `accrueAccountInterest` pays at `effectiveDepositAPR(acct.baseAPR, env)`,
 * where `env.depositMult` tracks the economy:
 *
 *   normal 1.00 · boom 1.15 · recession 0.80 · crash 0.65
 *
 * Every banking surface displayed the raw stored `account.baseAPR` — five
 * sites across `AdvancedBankApp.tsx` and `BankApp.tsx`. So an account card
 * reading "4.50% APR" pays 2.93% in a crash, and nothing on screen says so.
 *
 * What makes this worse than a plain hidden modifier: the game ALREADY tells
 * the player the rate moved. `EconomyEventBanner` says "savings yields drift
 * down" in a recession and "APRs spike across the board" in a crash. So the
 * player is informed rates changed, then shown a number that did not change —
 * which reads as the notification being cosmetic. `weeklyTick.ts` says in its
 * own comment that the rate environment exists so those notifications "finally
 * have teeth"; the display is what kept them toothless.
 *
 * The fix needs no new plumbing: the tick already persists the resolved
 * environment to `banking.rateEnvironment`, so the UI can read exactly what
 * the payout used rather than recomputing it.
 */
import {
  RATE_ENVIRONMENT_TABLE,
  effectiveDepositAPR,
  getRateEnvironment,
} from '@/lib/banking/rateEnvironment';
import { displayedDepositAPR, depositAPRNote } from '@/lib/banking/displayRates';
import { SAVINGS_APR_HARD_CAP } from '@/lib/economy/constants';
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');
const code = (rel: string) =>
  fs.readFileSync(path.join(repoRoot, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the displayed APR is the APR that pays', () => {
  it('matches effectiveDepositAPR exactly, in every economy state', () => {
    // The whole point. Two functions computing this independently is the bug
    // one layer up — so the display MUST delegate, not re-derive.
    for (const state of ['normal', 'boom', 'recession', 'crash'] as const) {
      const env = RATE_ENVIRONMENT_TABLE[state];
      expect(displayedDepositAPR(0.045, env)).toBeCloseTo(effectiveDepositAPR(0.045, env), 12);
    }
  });

  it('a crash really does cut the shown rate by 35%', () => {
    // The number a player would notice: 4.50% advertised, 2.93% actually paid.
    const crash = RATE_ENVIRONMENT_TABLE.crash;
    expect(crash.depositMult).toBe(0.65);
    expect(displayedDepositAPR(0.045, crash)).toBeCloseTo(0.02925, 10);
  });

  it('a boom shows the boost, not the base', () => {
    expect(displayedDepositAPR(0.04, RATE_ENVIRONMENT_TABLE.boom)).toBeCloseTo(0.046, 10);
  });

  it('never advertises above the regulatory hard cap', () => {
    // effectiveDepositAPR clamps; a display that did not would promise a rate
    // the payout refuses to pay — the same defect in the other direction.
    const boosted = displayedDepositAPR(SAVINGS_APR_HARD_CAP, RATE_ENVIRONMENT_TABLE.boom);
    expect(boosted).toBeLessThanOrEqual(SAVINGS_APR_HARD_CAP);
  });

  it('an absent rateEnvironment is neutral, not zero (the control)', () => {
    // `rateEnvironment` is optional on BankingState and absent on older saves.
    // Treating undefined as 0x would show every account paying nothing.
    expect(displayedDepositAPR(0.045, undefined)).toBeCloseTo(0.045, 12);
    expect(displayedDepositAPR(0.045, getRateEnvironment(undefined))).toBeCloseTo(0.045, 12);
  });

  it('a corrupt multiplier cannot render a nonsense rate (the control)', () => {
    for (const bad of [NaN, Infinity, -1] as number[]) {
      const apr = displayedDepositAPR(0.045, { depositMult: bad, loanDelta: 0 });
      expect(Number.isFinite(apr)).toBe(true);
      expect(apr).toBeGreaterThanOrEqual(0);
      expect(apr).toBeLessThanOrEqual(SAVINGS_APR_HARD_CAP);
    }
  });
});

describe('the player is told WHY the rate moved', () => {
  it('names the direction only when the environment is not neutral', () => {
    expect(depositAPRNote(RATE_ENVIRONMENT_TABLE.normal)).toBeNull();
    expect(depositAPRNote(undefined)).toBeNull();
  });

  it('explains a cut and a boost differently', () => {
    // "2.93% APR" alone reads like the bank changed its offer. Attributing it
    // to the economy is what connects it to the event banner already on screen.
    expect(depositAPRNote(RATE_ENVIRONMENT_TABLE.crash)).toMatch(/econom/i);
    expect(depositAPRNote(RATE_ENVIRONMENT_TABLE.boom)).toMatch(/econom/i);
    expect(depositAPRNote(RATE_ENVIRONMENT_TABLE.crash))
      .not.toEqual(depositAPRNote(RATE_ENVIRONMENT_TABLE.boom));
  });
});

describe('no banking surface still shows the raw baseAPR', () => {
  const SITES = ['components/computer/AdvancedBankApp.tsx', 'components/mobile/BankApp.tsx'];

  it.each(SITES)('%s reads the shared display helper', (rel) => {
    expect(code(rel)).toMatch(/displayedDepositAPR/);
  });

  it.each(SITES)('%s no longer renders account.baseAPR as the rate', (rel) => {
    // The literal that was on screen. Its absence is the fix.
    expect(code(rel)).not.toMatch(/\(account\.baseAPR \* 100\)\.toFixed/);
    expect(code(rel)).not.toMatch(/\(acct\.baseAPR \* 100\)\.toFixed/);
  });

  it('the payout still owns the arithmetic (the control)', () => {
    // If operations.ts stopped calling effectiveDepositAPR, the display would
    // be honest about a rate nothing applies.
    expect(code('lib/banking/operations.ts')).toMatch(/effectiveDepositAPR\(safe\(acct\.baseAPR\), env\)/);
  });
});
