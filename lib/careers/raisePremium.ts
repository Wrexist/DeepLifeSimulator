/**
 * The negotiated salary premium — one definition, because there were four.
 *
 * `career.raiseMultiplier` (1 = base pay) is written by `requestRaise`, which
 * steps it up by `RAISE_PREMIUM_STEP` and caps it at `RAISE_PREMIUM_CAP`. Every
 * site that read it back had invented its own bound:
 *
 *   JobActions.ts (promotion payout)   `?? 1` — no clamp whatsoever
 *   applyCareerSalaryAndPenalty.ts     clamp [1, 3]
 *   CareerPathCard.tsx                 clamp [1, 3], written out twice
 *   work.tsx (premium %)               `?? 1` — no clamp
 *
 * Inside the design range all four agree, which is exactly why it went
 * unnoticed: the disagreement is invisible until the stored value leaves that
 * range. And it can. `repairGameState` carries `raiseMultiplier` through a
 * career-ladder repair verbatim (utils/saveValidation.ts), so a legacy,
 * hand-edited or corrupt save keeps whatever it holds — at which point the
 * weekly salary pays a 3x ceiling, the promotion payout pays the raw value with
 * NO ceiling, and the work screen advertises a percentage matching neither.
 *
 * A reader that allowed 3 was also promising a premium the game will never
 * grant, since the writer stops at 2. The ceiling belongs to the writer; the
 * readers' job is to agree with it.
 *
 * This is the same shape as the company-income bug fixed earlier today — UI and
 * payout computing one quantity independently — so it gets the same remedy:
 * export the arithmetic once and let both sides call it.
 */

/** A premium never cuts base pay. 1 = the level's listed salary. */
export const RAISE_PREMIUM_FLOOR = 1;
/** Negotiated premium tops out at +100%. Owned here, used by the writer too. */
export const RAISE_PREMIUM_CAP = 2.0;
/** +8% of base salary per successful raise. */
export const RAISE_PREMIUM_STEP = 0.08;

/**
 * The premium a payout would actually honour, for any stored value.
 *
 * Non-numeric, non-finite and out-of-range inputs collapse to the nearest
 * legitimate bound rather than throwing: this sits on the payroll path, and a
 * corrupt field must not be able to stop a week from ticking.
 */
export function resolveRaisePremium(stored: unknown): number {
  if (typeof stored !== 'number' || !isFinite(stored)) return RAISE_PREMIUM_FLOOR;
  return Math.max(RAISE_PREMIUM_FLOOR, Math.min(RAISE_PREMIUM_CAP, stored));
}

/** Apply the premium to a base salary, rounded to whole currency. */
export function applyRaisePremium(baseSalary: number, stored: unknown): number {
  const base = typeof baseSalary === 'number' && isFinite(baseSalary) ? baseSalary : 0;
  return Math.round(base * resolveRaisePremium(stored));
}

/**
 * The premium as a whole percentage, for display.
 * Derived from the same clamp as the payout, so a screen can never advertise a
 * raise payroll will not pay.
 */
export function raisePremiumPct(stored: unknown): number {
  return Math.round((resolveRaisePremium(stored) - 1) * 100);
}

/** The next premium after a successful negotiation, capped. */
export function nextRaisePremium(stored: unknown): number {
  return Math.min(RAISE_PREMIUM_CAP, resolveRaisePremium(stored) + RAISE_PREMIUM_STEP);
}

/** True when the premium has reached the cap and further raises are refused. */
export function isRaisePremiumMaxed(stored: unknown): boolean {
  return resolveRaisePremium(stored) >= RAISE_PREMIUM_CAP;
}
