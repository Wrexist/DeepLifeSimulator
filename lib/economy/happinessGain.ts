/**
 * What a point of happiness is WORTH, and the one place its numbers live.
 *
 * ── The finding (Master Program 14, 2026-09-04) ──────────────────────────
 *
 * Happiness had exactly one recurring drain — natural decay, 3.2/week at full
 * grace and 1.6/week once net worth passes $200k — and an unbounded number of
 * additive sources: events, relationships, activities, housing, goals, pets,
 * anniversaries, luxury, diet, education. Every source paid its full face value
 * at every level of the stat, so any life that touched the social or event
 * systems ran a large permanent weekly surplus, and the 0-100 clamp threw the
 * surplus away. With it went every difference between lives.
 *
 * Measured over 150 weeks on the real tick, six personas:
 *
 *   persona              mean   p10  median  weeks>=95  weeks with NO change
 *   ROMANCE-FOCUSED     98.99   100     100    140/150             132/149
 *   FRIENDSHIP-FOCUSED  98.79  95.2     100    137/150              95/149
 *   CASUAL SOCIAL       98.43  95.6     100    137/150              94/149
 *   CAREER-OBSESSED     88.38  68.0    97.4     81/150              58/149
 *   WEALTH MAXIMIZER    88.38  68.0    97.4     81/150              58/149
 *   LONER               87.41  62.8    95.8     76/150              55/149
 *
 * Three things in that table, none of them about the cap:
 *   - CAREER-OBSESSED and WEALTH MAXIMIZER are IDENTICAL to the decimal. Two
 *     different lives, one emotional trajectory.
 *   - `weeks with no change` is the tell: the romance life spent 132 of 149
 *     weeks with happiness moving by exactly zero. It was not stable, it was
 *     pinned — inflow beat decay and the clamp absorbed the rest.
 *   - `weeks below 50` was **0 for all six personas**. The bottom half of the
 *     scale was unreachable in ordinary play.
 *
 * And the measurement that settles it: a life knocked down to 20 happiness
 * converges on the SAME trajectory as one that started at 100, inside ~25
 * weeks. LONER's mean over its last 20 weeks is 93.19 whether it began at 20,
 * 50, 80 or 100 — identical to two decimals. The starting state was not
 * recovered from, it was erased.
 *
 * ── The fix, and why this shape ─────────────────────────────────────────
 *
 * Not a bigger penalty, not a smaller bonus, and not removing the cap. A gain
 * is worth LESS the happier you already are — the same answer this repository
 * has already reached twice for the same shape of problem:
 *
 *   `closenessFalloff` (lib/social/npcDepth.ts, Program 12) — a catch-up is
 *     worth full value to bond 45 and a quarter at 100, because a flat bonus
 *     against a slow decay ratcheted every contact to the top and made the
 *     upper half of the bond scale meaningless.
 *   food satiety (lib/economy/foodSatiety.ts, v48) — meals 1-3 restore in
 *     full, 4-6 at half, 7+ at a quarter.
 *
 * CLAUDE.md 4.7 states the principle: when one ladder in a family of ladders
 * is flat, that is the bug.
 *
 * What this deliberately does NOT do:
 *   - It never makes a delta negative and never adds a penalty. A life below
 *     `HAPPINESS_FULL_VALUE_BELOW` is completely unaffected, which is why
 *     recovery from a real setback is exactly as fast as it was.
 *   - It does not touch decay, so nothing gets worse for anybody.
 *   - It does not lower the cap. 100 is still reachable; it now has to be
 *     earned continuously rather than arrived at and held for free.
 */

/**
 * Below this, a happiness gain pays its full face value.
 *
 * 55 rather than the 45 its `closenessFalloff` sibling uses, because these are
 * different scales: a bond at 45 is an acquaintance, while happiness at 45 is
 * a life going badly, and Program 14's brief is explicit that the goal is not
 * to make every life miserable. Every persona measured above sat at or above
 * 62 at its 10th percentile, so this threshold is under the whole observed
 * range: it changes nothing about how a struggling life recovers.
 */
export const HAPPINESS_FULL_VALUE_BELOW = 55;

/**
 * The multiplier a gain is worth at 100 — the far end of the taper.
 *
 * 0.2 and not lower, on evidence. Halving it to 0.1 was measured over the same
 * six personas and 150 weeks and bought almost nothing: the spread of persona
 * means went 12.18 -> 12.29 and the romance life's weeks at 95-or-above did not
 * move at all (136 either way). So the floor is not what is still holding the
 * top of the scale together, and doubling the nerf for no measured gain would
 * be exactly the blind rebalancing Program 14's brief rules out. The null
 * result is recorded here rather than discarded, the way Program 12 recorded
 * its event-weight non-response — that note is what made Program 13 productive.
 */
export const HAPPINESS_GAIN_FLOOR = 0.2;

/**
 * How much of a POSITIVE happiness delta actually lands, given where happiness
 * already is. Returns 1.0 up to `HAPPINESS_FULL_VALUE_BELOW`, then falls
 * smoothly to `HAPPINESS_GAIN_FLOOR` at 100.
 *
 * Quadratic rather than linear so the squeeze is gentle through the sixties and
 * seventies (where a life is merely doing well) and sharp in the nineties
 * (where it had been free). Mirrors `closenessFalloff`'s curve.
 */
export function happinessGainFalloff(current: number): number {
  const at = Number.isFinite(current) ? current : 0;
  if (at <= HAPPINESS_FULL_VALUE_BELOW) return 1;
  if (at >= 100) return HAPPINESS_GAIN_FLOOR;
  const span = 100 - HAPPINESS_FULL_VALUE_BELOW;
  const t = (at - HAPPINESS_FULL_VALUE_BELOW) / span; // 0 at the threshold, 1 at 100
  return 1 - (1 - HAPPINESS_GAIN_FLOOR) * t * t;
}

/**
 * Scale a happiness delta by the falloff. Negative deltas pass through
 * untouched: this makes the good times harder to bank, never the bad times
 * worse.
 *
 * Callers apply the RESULT and clamp as they already did; this function does
 * not clamp, so it composes with whatever bounds the call site enforces.
 */
export function scaledHappinessGain(current: number, delta: number): number {
  if (!Number.isFinite(delta) || delta <= 0) return Number.isFinite(delta) ? delta : 0;
  return delta * happinessGainFalloff(current);
}
