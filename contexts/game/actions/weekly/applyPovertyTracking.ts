/**
 * Consecutive weeks spent broke — the counter the poverty recovery path needs.
 *
 * ── The bug ───────────────────────────────────────────────────────────────
 *
 * `scholarshipOpportunity` (`lib/events/engine.ts`) is the game's safety net
 * for a player who is stuck: under $500, no education, no way out. It is fully
 * built — registered in the event pool, its `grant_free_education` special
 * effect is handled in the week loop and covered by a stress test — and it
 * could never fire, because its condition reads `state.weeksInPoverty >= 12`
 * and **nothing in the repo had ever written that field**. The one counter the
 * feature turned on did not exist, so the recovery path was unreachable for
 * exactly the player it was written for.
 *
 * What makes this worth a comment rather than a one-line commit: the field WAS
 * looked at. `__tests__/progression/invisibleStateP2.test.ts` triages it in a
 * list of twelve, under "logic, no UI", with the note "gates one event at >= 12
 * weeks". That review asked "does the player need to see this number?" and
 * correctly answered no. It never asked whether the number moves. A recorded
 * no-change against one question reads as clearance against every other one.
 *
 * ── Shape ─────────────────────────────────────────────────────────────────
 *
 * CONSECUTIVE, not cumulative: the counter resets the moment the player is
 * above the line again, so "12 weeks in poverty" means a sustained run rather
 * than twelve bad weeks spread over a life. That is what the event's own
 * wording ("been in poverty for extended period") describes.
 *
 * Reads the POST-tick balance, so a week that ends solvent does not count.
 *
 * No migration and no `STATE_VERSION` bump: `weeksInPoverty` is already on
 * `GameState`, is absent from `initialGameState`, and every reader already
 * treats an absent key as 0 — a §7 carve-out that stays one. Writing a number
 * where there was none is additive.
 */
import { POVERTY_MONEY_THRESHOLD } from '@/lib/config/gameConstants';

export interface PovertyTrackingInput {
  /** Cash after every subsystem has moved money this tick. */
  money: number;
  /** Savings count — a player with a cushion is not in poverty. */
  bankSavings?: number;
  /** `prevState.weeksInPoverty`; absent means zero. */
  previous?: number;
}

const num = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;

/**
 * @returns the new `weeksInPoverty` — `previous + 1` while broke, else 0.
 */
export function applyPovertyTracking(input: PovertyTrackingInput): number {
  // Savings are included so a player sitting on a bank balance with an empty
  // wallet is not counted as destitute. The event's own `hasLowMoney` check
  // reads `stats.money` alone; that is its business — it is the FINAL gate and
  // can be stricter than the counter feeding it. What must not drift is the
  // threshold, which is why both read the same constant.
  const liquid = num(input.money) + num(input.bankSavings);
  if (liquid >= POVERTY_MONEY_THRESHOLD) return 0;
  return num(input.previous) + 1;
}
