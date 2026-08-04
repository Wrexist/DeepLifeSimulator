/**
 * Arrears — the weekly bills a player could not cover.
 *
 * ── What this replaces ────────────────────────────────────────────────────
 *
 * The weekly cash line was:
 *
 *   cash = Math.max(0, money + income − tax − rent + rentalIncome
 *                   − upkeep − diet − tuition)
 *
 * so every dollar of mandatory outgoing a player could not afford was silently
 * FORGIVEN. Nothing recorded it, nothing chased it, and no consequence followed.
 * Combined with the hard `0` floor on `stats.money` (enforced at ~40 call sites,
 * including `updateMoney`'s overdraft reject) and the absence of any baseline
 * cost of living, the money axis had no failure state at all: a player could not
 * go into debt, could not be evicted, could not go under. `BANKRUPTCY_FLOOR`
 * names a bankruptcy the game had no way to reach.
 *
 * ── Why a bucket and not negative cash ────────────────────────────────────
 *
 * Allowing `stats.money < 0` is the obvious modelling answer and the wrong
 * engineering one: the non-negative invariant is load-bearing across the whole
 * codebase, and relaxing it would turn every `Math.max(0, …)` into a silent
 * clamp bug instead of a deliberate floor. So the shortfall lands in its own
 * field. Cash stays non-negative; the debt is explicit, visible, and settled
 * first out of next week's income.
 *
 * ── The shape of the consequence ──────────────────────────────────────────
 *
 * Deliberately a DRAG, not a death spiral. Arrears carry a weekly surcharge and
 * drag the credit score, but they never touch stats and never block progression:
 * a player who falls behind should feel it and be able to climb out by earning,
 * not be locked out of the game. The surcharge is capped so a long-forgotten
 * debt cannot compound into an unpayable number, which is the classic way this
 * mechanic turns from pressure into an abandoned save.
 */

/**
 * One-off late fee on the amount MISSED this week, as a fraction of that amount.
 *
 * Deliberately a fee on the miss, not interest on the balance. The first pass
 * compounded a 1%/week surcharge on the standing debt and tried to bound it with
 * a ceiling derived from that same debt — which is circular: the ceiling grew
 * with the balance it was meant to cap, and a player with no income watched
 * $1 000 reach $144 755 over ten years. A debt that grows while the player is
 * doing nothing is not pressure, it is a locked save.
 *
 * A flat fee per missed bill also matches how this works in life, and it gives
 * the mechanic the property that matters: the balance can only grow on a week
 * where the player actually failed to pay something.
 */
export const ARREARS_LATE_FEE_RATE = 0.05;

/** Credit-score points lost per week while any debt stands. */
export const ARREARS_CREDIT_SCORE_DRAG = 4;

const safe = (n: number | undefined | null, fallback = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fallback;

export interface ArrearsInput {
  /** Cash on hand plus everything earned this week, before mandatory outgoings. */
  availableCash: number;
  /** Mandatory outgoings for the week (tax, rent, upkeep, diet, tuition). */
  billsDue: number;
  /** Debt carried in from previous weeks. Optional — an older save has none. */
  previousOverdue?: number;
}

export interface ArrearsResult {
  /** Cash left after settling what could be settled. Never negative. */
  cashAfter: number;
  /** Debt carried forward into next week. Never negative. */
  overdueBalance: number;
  /** How much of the standing debt was cleared this week (for the recap). */
  paidTowardOverdue: number;
  /** New shortfall booked this week (for the recap). */
  newShortfall: number;
  /** Surcharge added to the debt this week. */
  surcharge: number;
  /** Credit-score delta to apply this week (0 or negative). */
  creditScoreDelta: number;
}

/**
 * Settle the week: pay down old debt first, then this week's bills, then book
 * whatever is left unpaid.
 *
 * Old debt is paid BEFORE current bills on purpose. The alternative — current
 * first — lets a player run a permanent balance while always looking current,
 * which makes the debt cosmetic. Paying it down first means the way out is to
 * out-earn it, which is the pressure this exists to create.
 */
export function applyArrears(input: ArrearsInput): ArrearsResult {
  const cash = Math.max(0, safe(input.availableCash));
  const bills = Math.max(0, safe(input.billsDue));
  const carried = Math.max(0, safe(input.previousOverdue));

  // 1. Settle the standing debt as far as cash allows.
  const paidTowardOverdue = Math.min(cash, carried);
  let remainingCash = cash - paidTowardOverdue;
  let remainingOverdue = carried - paidTowardOverdue;

  // 2. Pay this week's bills out of whatever is left.
  const paidTowardBills = Math.min(remainingCash, bills);
  remainingCash -= paidTowardBills;
  const newShortfall = bills - paidTowardBills;
  remainingOverdue += newShortfall;

  // 3. A one-off late fee on what was MISSED this week.
  //
  // Not interest on the standing balance: a debt must never grow on a week where
  // the player paid what they could. This makes the balance monotone in the
  // player's own failures, which is what keeps it escapable — see the
  // ARREARS_LATE_FEE_RATE note.
  const surcharge = newShortfall > 0 ? Math.round(newShortfall * ARREARS_LATE_FEE_RATE) : 0;
  remainingOverdue += surcharge;

  return {
    cashAfter: Math.max(0, Math.round(remainingCash)),
    overdueBalance: Math.max(0, Math.round(remainingOverdue)),
    paidTowardOverdue: Math.round(paidTowardOverdue),
    newShortfall: Math.round(newShortfall),
    surcharge,
    creditScoreDelta: remainingOverdue > 0 ? -ARREARS_CREDIT_SCORE_DRAG : 0,
  };
}
