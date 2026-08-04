/**
 * Telling the player when their asking rent exceeds what a tenant will pay.
 *
 * `effectiveAskRent` clamps the ask to `value × ASK_RENT_CEILING_RATE`, so an
 * over-ask is accepted by the modal and then silently reduced at payout. This
 * derives the cap from the same constant the clamp uses, so the two cannot
 * disagree — the recurring defect in this codebase is a display that computes
 * a player-facing number independently of the payout.
 *
 * Scoped deliberately small. The ceiling only bites on a deliberate over-ask
 * (every mode's suggested yield is below it) and `askFillMultiplier` already
 * penalises over-asking through a slower fill. So this states the cap at the
 * moment it applies and stays silent otherwise: a warning shown on every
 * ordinary ask is noise, and noise is how a real warning stops being read.
 */
import { ASK_RENT_CEILING_RATE } from './tenancy';

const usableValue = (propertyValue: number): number =>
  typeof propertyValue === 'number' && isFinite(propertyValue) && propertyValue > 0
    ? propertyValue
    : 0;

/** The most a tenant will pay per week for a property of this value. */
export function askRentCeiling(propertyValue: number): number {
  return usableValue(propertyValue) * ASK_RENT_CEILING_RATE;
}

export interface AskRentOverage {
  /** What the player typed. */
  asked: number;
  /** What a tenant would actually pay. */
  collected: number;
}

/**
 * The gap between the ask and what would be collected, or `null` when the ask
 * is within the cap (or there is no usable value to derive a cap from).
 */
export function askRentOverage(askRent: number, propertyValue: number): AskRentOverage | null {
  const ceiling = askRentCeiling(propertyValue);
  if (ceiling <= 0) return null;
  if (typeof askRent !== 'number' || !isFinite(askRent) || askRent <= ceiling) return null;
  return { asked: askRent, collected: ceiling };
}
