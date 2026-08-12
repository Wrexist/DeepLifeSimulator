/**
 * Age → face, derived rather than stored.
 *
 * This is the reason the avatar is parameters at all. The old pool aged a
 * character by swapping them to a DIFFERENT pre-rendered person from the next
 * age bucket, which is what produced the "my character turned into someone
 * else" reports documented at length in `utils/facePool.ts`. Here the player's
 * chosen features never change — ageing only layers greying, recession,
 * wrinkles and proportion on top, so the same face grows old.
 *
 * Nothing here is persisted. Age is already in the save; storing anything
 * derived from it would just be a second copy that can drift.
 */
import type { AvatarAgeEffects, AvatarSex } from './types';

/**
 * Ageing effects for an age in years.
 *
 * The curves are deliberately gentle and late: a 30-year-old should look
 * essentially like their 25-year-old self. Every effect is monotonic in age —
 * `__tests__/avatar/aging.test.ts` pins that, because a non-monotonic curve
 * would let a character visibly get younger on a birthday.
 */
export function ageEffects(age: number, sex: AvatarSex): AvatarAgeEffects {
  const a = Number.isFinite(age) ? Math.max(0, age) : 0;

  return {
    greying: ramp(a, 32, 78),
    // Recession is masculine-only and starts earlier. Feminine faces keep
    // their hairline; thinning reads as an art bug rather than as ageing at
    // the sizes this renders at.
    recession: sex === 'male' ? ramp(a, 28, 70) * 0.85 : 0,
    wrinkles: ramp(a, 34, 82),
    headScale: headScaleFor(a),
    babyness: a >= 13 ? 0 : ramp(13 - a, 0, 13),
  };
}

/**
 * Head size relative to the shoulders. Children have proportionally large
 * heads; this is most of what makes a young character read as young without
 * needing a separate child face catalog.
 */
function headScaleFor(age: number): number {
  if (age <= 1) return 1.32;
  if (age >= 20) return 1;
  // Linear from infant proportions to adult over the first 20 years.
  return 1.32 - (0.32 * (age - 1)) / 19;
}

/** 0 below `start`, 1 at or above `end`, smoothly eased between. */
function ramp(value: number, start: number, end: number): number {
  if (end <= start) return value >= end ? 1 : 0;
  const t = (value - start) / (end - start);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  // Smoothstep — avoids a visible kink at the moment ageing begins.
  return t * t * (3 - 2 * t);
}

/**
 * How far the hair's front mass lifts off the forehead, in viewBox units.
 *
 * Scaled by the style's own coverage so a fringe recedes visibly while a
 * style that already shows forehead barely moves, and suppressed entirely for
 * styles that cannot recede (shaved, faded).
 */
export function recessionOffset(
  effects: AvatarAgeEffects,
  coverage: number,
  noRecede: boolean | undefined
): number {
  if (noRecede) return 0;
  return effects.recession * coverage * 14;
}
