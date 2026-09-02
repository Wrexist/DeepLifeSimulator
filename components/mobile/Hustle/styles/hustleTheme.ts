/**
 * Hustle theme tokens.
 *
 * What used to live here was a parallel design system: a private type scale
 * (HUSTLE_TEXT), a private spacing scale (HUSTLE_DENSITY), a private motion
 * scale (HUSTLE_MOTION) and five gradients (indigo→cyan, gold, bull, bear and
 * a soft backdrop). The app's own ladders — `fontScale`/`responsiveSpacing`
 * from `utils/scaling` and `animation` from `lib/config/theme` — already say
 * all of that once, so the copies only ever meant "two answers to the same
 * question". They are gone.
 *
 * What is left is the part that is genuinely Hustle's: ONE identity tint and
 * the per-industry colours, both drawn from the shared `accent` palette rather
 * than private hexes.
 */

import { accent } from '@/lib/config/theme';

/** Semantic colours for in-app messaging + industry chips. */
export const HUSTLE_COLORS = {
  /** The one identity tint. */
  accent: accent.info,
  /** Secondary meaning tint (marketing, R&D, market share) — not an identity. */
  accentSecondary: accent.purple,
  // Semantic
  danger: accent.danger,
  warning: accent.warning,
  success: accent.success,
  info: accent.info,
  // KPI trends
  trendUp: accent.success,
  trendDown: accent.danger,
  trendFlat: accent.muted,
  // Industries
  factory: accent.warning,
  ai: accent.purple,
  restaurant: accent.danger,
  realestate: accent.success,
  bank: accent.info,
} as const;

export function industryColor(kind: string): string {
  switch (kind) {
    case 'factory': return HUSTLE_COLORS.factory;
    case 'ai': return HUSTLE_COLORS.ai;
    case 'restaurant': return HUSTLE_COLORS.restaurant;
    case 'realestate': return HUSTLE_COLORS.realestate;
    case 'bank': return HUSTLE_COLORS.bank;
    default: return HUSTLE_COLORS.accent;
  }
}
