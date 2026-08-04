/**
 * Weekly crime tick — R7 Phase 2 step 2.6-i.
 *
 * Scope: two micro-mechanics previously inline in
 * `GameActionsContext.tsx:1020-1038` (~19 lines).
 *
 *   1. Wanted-level decay: -1 per week while not in jail (floor 0).
 *   2. Random police encounter: when post-decay wanted level >= 5 AND
 *      not in jail, roll `preRolls.policeEncounter` against a chance
 *      that scales 5%/level above 4 (capped at 30%). On hit:
 *        - Jail for `min(4, ceil(wantedLevel/3))` weeks.
 *        - -15 happiness.
 *        - Fine: 5% of cash (capped at current cash → can never go negative).
 *        - Push notification + log.
 *
 * Side effects (mutations of `ctx`):
 *   - `ctx.newStats.happiness` — `-15` on encounter (floored at 0).
 *   - `ctx.newStats.money`     — `-5%` fine on encounter (floored at 0).
 *   - `ctx.notifications.push(...)` — encounter notification.
 *
 * Returns the two scalars the downstream blocks consume:
 *   - `newWantedLevel`            — written to gameState.wantedLevel later.
 *   - `policeEncounterJailWeeks`  — feeds the jail-weeks accumulator.
 */

import { logger } from '@/utils/logger';
import type { WeekContext } from './weekContext';

export interface CrimeTickInput {
  prevWantedLevel: number | undefined;
  prevJailWeeks: number | undefined;
  /** From `preRolls.policeEncounter` — deterministic 0-1 value. */
  policeEncounterRoll: number;
  /**
   * Total net worth, so the fine is priced off WEALTH rather than off whatever
   * happens to be sitting in the wallet. Optional so legacy/test callers that
   * omit it fall back to the cash-only behaviour.
   */
  netWorth?: number;
}

/** Share of net worth the court takes, per point of wanted level above 4. */
const FINE_RATE_PER_WANTED_LEVEL = 0.005;

/** Hard cap on the net-worth share a single encounter can cost. */
const MAX_FINE_RATE = 0.05;

/**
 * Price one police encounter.
 *
 * Two bounds, both load-bearing:
 *  - the RATE is capped, so a high wanted level cannot confiscate an estate;
 *  - the CHARGE is capped by cash on hand, so an illiquid player is never driven
 *    to a negative balance (which nothing downstream in this game supports).
 *
 * The floor keeps the old behaviour meaningful for an early-game player whose
 * net worth is basically their wallet.
 */
export function computePoliceFine(cash: number, netWorth: number | undefined, wantedLevel: number): number {
  const safeCash = typeof cash === 'number' && isFinite(cash) && cash > 0 ? cash : 0;
  if (safeCash <= 0) return 0;
  const safeNetWorth =
    typeof netWorth === 'number' && isFinite(netWorth) && netWorth > 0 ? netWorth : safeCash;
  const rate = Math.min(MAX_FINE_RATE, Math.max(0, wantedLevel - 4) * FINE_RATE_PER_WANTED_LEVEL);
  const wealthBased = Math.round(safeNetWorth * rate);
  // Never less than the old flat-5%-of-cash charge, so this can only tighten
  // the consequence, never loosen it for the player it already applied to.
  const cashBased = Math.round(safeCash * 0.05);
  return Math.min(safeCash, Math.max(cashBased, wealthBased));
}

export interface CrimeTickResult {
  /** Wanted level AFTER decay (and unchanged by any encounter — encounters jail, they don't bump wanted further). */
  newWantedLevel: number;
  /** Jail weeks to add THIS tick from the random encounter (0 when no encounter). */
  policeEncounterJailWeeks: number;
}

export function applyCrimeTick(input: CrimeTickInput, ctx: WeekContext): CrimeTickResult {
  // Wanted level decay: -1 per week if not in jail, minimum 0.
  let newWantedLevel = input.prevWantedLevel || 0;
  const inJail = (input.prevJailWeeks || 0) > 0;
  if (newWantedLevel > 0 && !inJail) {
    newWantedLevel = Math.max(0, newWantedLevel - 1);
  }

  // Random police encounter if wanted level is high (outside jail).
  let policeEncounterJailWeeks = 0;
  if (newWantedLevel >= 5 && !inJail) {
    const encounterChance = Math.min(0.30, (newWantedLevel - 4) * 0.05); // 5% per level above 4, cap 30%.
    if (input.policeEncounterRoll < encounterChance) {
      policeEncounterJailWeeks = Math.min(4, Math.ceil(newWantedLevel / 3));
      ctx.newStats.happiness = Math.max(0, ctx.newStats.happiness - 15);
      // The fine is priced off NET WORTH, then taken from cash.
      //
      // It used to be a flat 5% of the wallet, which made crime free for anyone
      // wealthy: a player holding $10M in property, stocks and companies but
      // $2 000 in cash paid a $100 fine and lost four weeks. The court does not
      // care which pocket the money is in. Pricing on net worth and capping the
      // rate keeps it meaningful at the top without being able to wipe out a
      // player whose wealth is illiquid — the charge is still bounded by cash on
      // hand, so it can never drive the balance negative.
      const fine = computePoliceFine(ctx.newStats.money, input.netWorth, newWantedLevel);
      ctx.newStats.money = Math.max(0, ctx.newStats.money - fine);
      logger.info(`[POLICE] Random encounter! Wanted ${newWantedLevel}, jailed ${policeEncounterJailWeeks} weeks, fined $${fine}`);
      ctx.notifications.push({
        id: 'police-encounter',
        message: `The police caught up with you! You've been fined $${fine.toLocaleString()} and sentenced to ${policeEncounterJailWeeks} week(s) in jail.`,
        title: 'Police Encounter',
      });
    }
  }

  return { newWantedLevel, policeEncounterJailWeeks };
}
