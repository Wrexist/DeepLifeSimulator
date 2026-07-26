/**
 * Grooming, wardrobe and upkeep.
 *
 * The half of appearance you control on a weekly budget rather than over years.
 * Body composition takes months to move; a haircut takes an afternoon. Having
 * both means the chapter has a fast loop and a slow loop, and a broke player
 * still has *something* they can do about how they land in a room.
 *
 * Everything here decays. That is the design: appearance is a maintained state,
 * not a purchased one. A player who buys a designer wardrobe once and never
 * grooms again should visibly slide, because that is what happens.
 */

import { WARDROBE_TIERS, type StyleProfile } from './types';

function clampRange(n: number, lo: number, hi: number): number {
  if (!isFinite(n)) return lo;
  return n < lo ? lo : n > hi ? hi : n;
}

/** Force a loaded/partial style profile into a valid one. */
export function normalizeStyle(input: Partial<StyleProfile> | null | undefined): StyleProfile {
  const src = input && typeof input === 'object' ? input : {};
  return {
    grooming: clampRange(src.grooming ?? 70, 0, 100),
    skincare: clampRange(src.skincare ?? 70, 0, 100),
    wardrobeTier: Math.round(clampRange(src.wardrobeTier ?? 1, 0, WARDROBE_TIERS.length - 1)),
    teeth: clampRange(src.teeth ?? 80, 0, 100),
    lastHaircutWeek: typeof src.lastHaircutWeek === 'number' && isFinite(src.lastHaircutWeek)
      ? src.lastHaircutWeek
      : -1,
  };
}

/** A starting style profile — presentable, not polished. */
export function createStyle(): StyleProfile {
  return { grooming: 68, skincare: 72, wardrobeTier: 1, teeth: 82, lastHaircutWeek: -1 };
}

/** Salon and clinic services the player can buy. */
export interface GroomingService {
  id: string;
  name: string;
  description: string;
  cost: number;
  /** Minimum age. Cosmetic dentistry on a 6-year-old is not a feature. */
  minAge?: number;
}

export const GROOMING_SERVICES: readonly GroomingService[] = [
  {
    id: 'barber_basic',
    name: 'Neighbourhood barber',
    description: 'Quick cut. Does the job.',
    cost: 25,
  },
  {
    id: 'barber_premium',
    name: 'Stylist appointment',
    description: 'A proper cut and shape. Lasts longer and looks it.',
    cost: 180,
  },
  {
    id: 'barber_celebrity',
    name: 'Celebrity stylist',
    description: 'The person who cuts hair for people on magazine covers.',
    cost: 2500,
  },
  {
    id: 'skincare_basic',
    name: 'Drugstore skincare run',
    description: 'Cleanser, moisturiser, sunscreen. Unglamorous and effective.',
    cost: 60,
  },
  {
    id: 'skincare_facial',
    name: 'Dermatologist facial',
    description: 'A real treatment from someone with a medical degree.',
    cost: 400,
    minAge: 16,
  },
  {
    id: 'teeth_clean',
    name: 'Dental cleaning',
    description: 'Scale and polish. Boring, cheap, and it compounds.',
    cost: 150,
  },
  {
    id: 'teeth_whitening',
    name: 'Professional whitening',
    description: 'Several shades brighter for a while.',
    cost: 900,
    minAge: 16,
  },
  {
    id: 'teeth_veneers',
    name: 'Porcelain veneers',
    description: 'A permanent, unmistakable, expensive smile.',
    cost: 22000,
    minAge: 18,
  },
];

/**
 * Apply a purchased service. Pure — returns the new profile, charges nothing.
 *
 * Gains are capped rather than additive-to-100 so repeat-buying the cheapest
 * option in a loop cannot reach the same place as one good appointment. The
 * expensive services are not just faster; they reach a ceiling the cheap ones
 * never do.
 */
export function applyGroomingService(
  style: StyleProfile,
  serviceId: string,
  weeksLived: number,
): StyleProfile {
  const s = normalizeStyle(style);
  switch (serviceId) {
    case 'barber_basic':
      return { ...s, grooming: Math.max(s.grooming, Math.min(78, s.grooming + 30)), lastHaircutWeek: weeksLived };
    case 'barber_premium':
      return { ...s, grooming: Math.max(s.grooming, Math.min(92, s.grooming + 45)), lastHaircutWeek: weeksLived };
    case 'barber_celebrity':
      return { ...s, grooming: 100, lastHaircutWeek: weeksLived };
    case 'skincare_basic':
      return { ...s, skincare: Math.max(s.skincare, Math.min(80, s.skincare + 18)) };
    case 'skincare_facial':
      return { ...s, skincare: Math.max(s.skincare, Math.min(97, s.skincare + 34)) };
    case 'teeth_clean':
      return { ...s, teeth: Math.max(s.teeth, Math.min(88, s.teeth + 16)) };
    case 'teeth_whitening':
      return { ...s, teeth: Math.max(s.teeth, Math.min(96, s.teeth + 28)) };
    case 'teeth_veneers':
      return { ...s, teeth: 100 };
    default:
      return s;
  }
}

export interface StyleWeekInputs {
  age: number;
  /** [0, 100]. Stress wrecks skin faster than anything except sun and time. */
  stress: number;
  /** [0, 100]. */
  health: number;
  /** True while the character is a smoker — hits skin and teeth hard. */
  smoker?: boolean;
}

/**
 * One week of decay.
 *
 * Rates are chosen so grooming needs attention roughly monthly (a real haircut
 * cadence), skincare drifts over a season, and teeth over years. Three different
 * timescales, so the maintenance loop never collapses into one weekly chore.
 */
export function decayStyleWeek(style: StyleProfile, w: StyleWeekInputs): StyleProfile {
  const s = normalizeStyle(style);
  const age = clampRange(w.age, 0, 120);
  const stress = clampRange(w.stress, 0, 100);
  const health = clampRange(w.health, 0, 100);

  // ~5/week → a fresh cut is scruffy again in about a month.
  const grooming = clampRange(s.grooming - 5, 0, 100);

  // Skin: baseline drift, plus stress, plus age, plus smoking, minus good health.
  const skinDecay =
    0.9 +
    Math.max(0, stress - 45) * 0.035 +
    Math.max(0, age - 30) * 0.012 +
    (w.smoker ? 0.8 : 0) -
    Math.max(0, health - 70) * 0.012;
  const skincare = clampRange(s.skincare - Math.max(0.15, skinDecay), 0, 100);

  // Teeth: very slow, and effectively permanent damage once neglected.
  const teeth = clampRange(s.teeth - (0.14 + (w.smoker ? 0.22 : 0) + Math.max(0, age - 45) * 0.004), 0, 100);

  return { ...s, grooming, skincare, teeth };
}

/**
 * Weekly cost of simply staying presentable at the current wardrobe tier.
 *
 * Charged whether or not the player thinks about it, because that is how
 * clothes work — dry cleaning, replacement, repair. It also gives the higher
 * tiers an ongoing cost, so "Designer" is a commitment rather than a one-off
 * purchase that permanently raises a stat.
 */
export function wardrobeWeeklyUpkeep(style: StyleProfile): number {
  const s = normalizeStyle(style);
  const tier = WARDROBE_TIERS[s.wardrobeTier] ?? WARDROBE_TIERS[0];
  return Math.round(tier.cost * 0.004);
}

/** Presentation score, [0, 100] — the grooming half of presence. */
export function presentationScore(style: StyleProfile): number {
  const s = normalizeStyle(style);
  const tier = WARDROBE_TIERS[s.wardrobeTier] ?? WARDROBE_TIERS[0];
  const raw = s.grooming * 0.34 + s.skincare * 0.3 + s.teeth * 0.2 + 50 + tier.presence;
  return clampRange(raw * 0.66, 0, 100);
}
