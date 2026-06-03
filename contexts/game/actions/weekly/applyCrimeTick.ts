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
      const fine = Math.min(ctx.newStats.money, Math.round(ctx.newStats.money * 0.05));
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
