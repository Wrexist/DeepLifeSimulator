/**
 * What the banking UI should print for a savings rate — the rate that pays.
 *
 * `accrueAccountInterest` pays at `effectiveDepositAPR(acct.baseAPR, env)`,
 * scaled by the live economy: normal 1.00, boom 1.15, recession 0.80,
 * crash 0.65. Every banking surface printed the raw stored `account.baseAPR`
 * instead, so a card reading "4.50% APR" paid 2.93% in a crash with nothing on
 * screen to explain the gap.
 *
 * The game already TELLS the player rates moved — `EconomyEventBanner` says
 * "savings yields drift down" in a recession — so showing an unchanged number
 * next to that made the notification look cosmetic. `weeklyTick.ts` introduced
 * the rate environment specifically so those notifications would "finally have
 * teeth"; the display is what kept them toothless.
 *
 * This module deliberately does NOT re-derive the rate. It delegates to
 * `effectiveDepositAPR` — the same function the payout calls — because a UI
 * that recomputed the maths would be the identical bug one layer up, which is
 * exactly how the company-income and raise-premium defects happened.
 */
import { effectiveDepositAPR } from './rateEnvironment';

export interface DepositRateEnvironment {
  depositMult: number;
  loanDelta: number;
}

/** Neutral environment: what an older save with no `rateEnvironment` means. */
const NEUTRAL: DepositRateEnvironment = { depositMult: 1, loanDelta: 0 };

/**
 * Resolve an environment for display. `banking.rateEnvironment` is optional and
 * absent on saves from before v22, where the correct reading is "no adjustment"
 * — treating a missing value as 0x would show every account paying nothing.
 */
function safeEnv(env: DepositRateEnvironment | undefined | null): DepositRateEnvironment {
  if (!env || typeof env.depositMult !== 'number' || !isFinite(env.depositMult) || env.depositMult < 0) {
    return NEUTRAL;
  }
  return env;
}

/**
 * The APR to print, matching what `accrueAccountInterest` will actually pay.
 * Clamped by `effectiveDepositAPR` to the regulatory hard cap, so the display
 * can never advertise a rate the payout refuses.
 */
export function displayedDepositAPR(
  baseAPR: number,
  env: DepositRateEnvironment | undefined | null,
): number {
  return effectiveDepositAPR(baseAPR, safeEnv(env));
}

/**
 * A short attribution for a non-neutral rate, or `null` when the environment is
 * neutral and there is nothing to explain.
 *
 * Without this a reduced number reads as the bank changing its offer. Naming
 * the economy is what ties it to the event banner already on screen.
 */
export function depositAPRNote(env: DepositRateEnvironment | undefined | null): string | null {
  const mult = safeEnv(env).depositMult;
  if (mult === 1) return null;
  const pct = Math.abs(Math.round((mult - 1) * 100));
  return mult > 1
    ? `+${pct}% from the current economy`
    : `−${pct}% from the current economy`;
}

/** True when the environment is moving the rate at all. */
export function isDepositRateAdjusted(env: DepositRateEnvironment | undefined | null): boolean {
  return safeEnv(env).depositMult !== 1;
}
