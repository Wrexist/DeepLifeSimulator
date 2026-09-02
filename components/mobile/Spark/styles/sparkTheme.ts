/**
 * Spark theme tokens — app-specific overlays on the global theme.
 *
 * The identity colour is ONE value, `SPARK_COLORS.accent` (rose), tinted at the
 * call site with `withAlpha` from `@/lib/config/theme`. The signature gradient
 * survives in exactly two JSX elements — the Like button and the premium upsell
 * CTA — because there it means something; everywhere else it was decoration on
 * a hero surface and is now a flat tint. (Its two stops also colour the stroke
 * of the illustrated EmptyState heart, which is an SVG, not a Gradient view.)
 */

import { colors } from '@/lib/config/theme';

/** Signature gradient — rose → orange. Call sites listed above. */
export const SPARK_GRADIENT = ['#F43F5E', '#FB923C'] as const;

/** Swipe-action colors. */
export const SPARK_ACTION = {
  pass: colors.palette.danger,         // X / pass — red
  like: colors.palette.success,        // ❤️ / like — green
  superLike: '#3B82F6',                // ⭐ super-like — blue
  rewind: '#FBBF24',                   // ⏪ rewind — amber
  boost: '#F43F5E',                    // 🚀 boost — rose
} as const;

/** Spark motion timings (ms). Respect reduced-motion at call site. */
export const SPARK_MOTION = {
  cardSnap: 280,
  cardSwipeOut: 360,
  matchCelebration: 800,
  matchCelebrationHold: 1600,
  buttonPress: 180,
  modalIn: 300,
  flameLoop: 1400,
} as const;

/** Pulse-style semantic colors. Use named tokens at call sites. */
export const SPARK_COLORS = {
  // Brand
  accent: '#F43F5E',                    // matches SPARK_GRADIENT[0]
  accentSecondary: '#FB923C',           // matches SPARK_GRADIENT[1]
  // Semantic
  danger: colors.palette.danger,
  warning: colors.palette.warning,
  success: colors.palette.success,
  info: colors.palette.info,
  // Premium tiers
  tierFree: colors.palette.dark500,
  tierPlus: colors.palette.primary,
  tierUltra: '#F59E0B',                 // gold
  // Engagement (matches Pulse for visual consistency across the phone)
  like: colors.palette.danger,
  pass: colors.palette.dark500,
  superLike: '#3B82F6',
} as const;
