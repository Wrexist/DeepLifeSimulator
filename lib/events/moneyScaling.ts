/**
 * Wealth-scaled event money.
 *
 * ## The problem
 *
 * There are ~400 authored event templates and every money effect is a FLAT
 * dollar figure, the largest of them ±$150,000. So a "$200 unexpected bill"
 * fires unchanged at $200M net worth. The best content volume in the repo turns
 * into rounding noise exactly when the player has the most time to read it —
 * which is a large part of why the late game reads as empty even though events
 * keep arriving.
 *
 * ## The model
 *
 * A choice may declare `moneyPct`: a fraction of net worth. The resolved amount
 * is then the LARGER of the flat `money` figure and the percentage, keeping the
 * sign of `money`. So an early-game player still sees the hand-authored number
 * (which is tuned for them), and a wealthy player sees something they can feel.
 *
 * `money` is therefore a floor, not a default that gets overwritten — an event
 * whose flat figure is already bigger than the percentage keeps its flat
 * figure.
 *
 * ## Why it is capped
 *
 * Percentage-based NEGATIVE events at high net worth are how a wealth tax feels
 * like a bug. `MAX_EVENT_NET_WORTH_FRACTION` bounds any single event to 5% of
 * net worth regardless of what a template asks for, and `MAX_EVENT_MONEY` bounds
 * the absolute figure. Neither is a balance knob a template can override.
 */

/** Hard ceiling on what one event may move, as a fraction of net worth. */
export const MAX_EVENT_NET_WORTH_FRACTION = 0.05;

/**
 * Absolute ceiling on a single event's money effect.
 *
 * Sits above the largest authored flat figure (±$150,000) by a wide margin so
 * it only ever binds on the percentage path.
 */
export const MAX_EVENT_MONEY = 50_000_000;

export interface ScalableMoneyEffect {
  /** Flat amount, and the FLOOR for a scaled effect. Sign carries. */
  money?: number;
  /**
   * Fraction of net worth this event is worth, e.g. 0.01 for 1%. Optional —
   * an event without it is flat, exactly as before.
   */
  moneyPct?: number;
}

const finite = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;

/**
 * Resolve what an event choice actually moves.
 *
 * Returns the flat `money` unchanged when no `moneyPct` is declared, so every
 * existing template behaves identically and this is a no-op until adopted.
 */
export function resolveEventMoney(
  effects: ScalableMoneyEffect | undefined | null,
  netWorth: number | undefined | null
): number {
  const flat = finite(effects?.money);
  const pct = finite(effects?.moneyPct);
  if (pct === 0) return clampMoney(flat);

  const worth = Math.max(0, finite(netWorth));
  // The percentage is bounded before it is compared, so a mis-authored 0.9
  // cannot wipe a player out.
  const boundedPct = Math.min(Math.abs(pct), MAX_EVENT_NET_WORTH_FRACTION);
  const scaled = worth * boundedPct;

  // Sign comes from `money` when it is non-zero, otherwise from `moneyPct` —
  // so a template can declare a purely proportional loss as `moneyPct: -0.01`.
  const sign = flat !== 0 ? Math.sign(flat) : Math.sign(pct) || 1;
  const magnitude = Math.max(Math.abs(flat), scaled);

  return clampMoney(sign * Math.round(magnitude));
}

function clampMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-MAX_EVENT_MONEY, Math.min(MAX_EVENT_MONEY, Math.round(value)));
}

/**
 * Does this effect scale with wealth? Useful for a UI that wants to say
 * "1% of your net worth" rather than a figure that looks arbitrary.
 */
export function isScaledMoneyEffect(
  effects: ScalableMoneyEffect | undefined | null
): boolean {
  return finite(effects?.moneyPct) !== 0;
}
