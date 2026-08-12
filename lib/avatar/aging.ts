/**
 * Age → face, derived rather than stored.
 *
 * This is the reason the avatar is parameters at all. The old pool aged a
 * character by swapping them to a DIFFERENT pre-rendered person from the next
 * age bucket — a slot index is not an identity — which is what produced the
 * "my character turned into someone else" reports. See
 * `docs/avatar-art-direction-research.md`. Here the player's
 * chosen features never change — ageing only greys the hair, thins it, and
 * makes glasses likelier, so the same face grows old.
 *
 * Every lever is a real option on the underlying art. Nothing is drawn on top;
 * an earlier pass painted wrinkle strokes over the face and it looked exactly
 * as bad as that sounds.
 *
 * Nothing here is persisted. Age is already in the save, so anything derived
 * from it would be a second copy that can drift.
 */
import type { AvatarAgeEffects, AvatarSex } from './types';

/** The age below which a beard is suppressed however the config was set. */
export const FACIAL_HAIR_MIN_AGE = 16;

/**
 * Ageing effects for an age in years.
 *
 * The curves are deliberately gentle and late: a 30-year-old should look
 * essentially like their 25-year-old self. Greying is monotonic in age —
 * `__tests__/avatar/avatarSystem.test.ts` pins that, because a non-monotonic
 * curve would let a character visibly get younger on a birthday.
 */
export function ageEffects(age: number, sex: AvatarSex): AvatarAgeEffects {
  const a = Number.isFinite(age) ? Math.max(0, age) : 0;

  return {
    greying: ramp(a, 34, 78),
    hairProbability: hairProbabilityFor(a, sex),
    glassesProbability: a < 40 ? 0 : a < 55 ? 25 : a < 70 ? 45 : 65,
    suppressFacialHair: a < FACIAL_HAIR_MIN_AGE,
  };
}

/**
 * How likely the hair layer is to render.
 *
 * Thinning is masculine-only and late. Applying it to feminine faces reads as
 * an art bug rather than as ageing, and starting it early would take hair off
 * characters in their fifties who should still have it.
 */
function hairProbabilityFor(age: number, sex: AvatarSex): number {
  if (sex !== 'male') return 100;
  if (age < 55) return 100;
  if (age < 68) return 85;
  if (age < 78) return 60;
  return 40;
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
