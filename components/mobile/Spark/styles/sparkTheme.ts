/**
 * Spark theme tokens — app-specific overlays on the global theme.
 *
 * Signature gradient: rose → orange (warm, romantic) — distinct from Pulse's
 * magenta → indigo (cool, social). Used on hero surfaces, match celebrations,
 * the FAB, premium upsell, and the swipe ❤️ action.
 */

import { colors, getThemeColors } from '@/lib/config/theme';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';

/** Signature gradient — rose → orange. */
export const SPARK_GRADIENT = ['#F43F5E', '#FB923C'] as const;
/** Soft 30% variant for backdrops, photo overlays. */
export const SPARK_GRADIENT_SOFT = ['rgba(244, 63, 94, 0.2)', 'rgba(251, 146, 60, 0.2)'] as const;
/** Premium gold gradient — used for Spark Ultra perks. */
export const SPARK_GRADIENT_GOLD = ['#FBBF24', '#F59E0B'] as const;

/** Swipe-action colors. */
export const SPARK_ACTION = {
  pass: colors.palette.danger,         // X / pass — red
  like: colors.palette.success,        // ❤️ / like — green
  superLike: '#3B82F6',                // ⭐ super-like — blue
  rewind: '#FBBF24',                   // ⏪ rewind — amber
  boost: '#F43F5E',                    // 🚀 boost — rose
} as const;

/** Spark density / spacing presets — generous, photo-first. */
export const SPARK_DENSITY = {
  pagePadding: responsiveSpacing.md,
  pagePaddingHero: responsiveSpacing.lg,
  cardPadding: responsiveSpacing.md,
  cardGap: responsiveSpacing.md,
  sectionGap: scale(20),
  rowGap: responsiveSpacing.sm,
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

/** Spark-specific text sizes. */
export const SPARK_TEXT = {
  display: fontScale(28),
  title: fontScale(20),
  subtitle: fontScale(16),
  body: fontScale(14),
  caption: fontScale(12),
  micro: fontScale(10),
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

/** Resolve a Spark theme bundle for the active mode. */
export function resolveSparkTheme(darkMode: boolean) {
  const base = getThemeColors(darkMode);
  return {
    base,
    gradient: SPARK_GRADIENT,
    gradientSoft: SPARK_GRADIENT_SOFT,
    gradientGold: SPARK_GRADIENT_GOLD,
    action: SPARK_ACTION,
    density: SPARK_DENSITY,
    motion: SPARK_MOTION,
    text: SPARK_TEXT,
    spark: SPARK_COLORS,
  };
}

export type SparkTheme = ReturnType<typeof resolveSparkTheme>;
