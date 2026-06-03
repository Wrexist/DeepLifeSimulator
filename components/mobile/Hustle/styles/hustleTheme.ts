/**
 * Hustle theme tokens — app-specific overlays on the global theme.
 *
 * Signature gradient: indigo → cyan (focused, premium-tech) — distinct from
 * Pulse's magenta→indigo (social) and Spark's rose→orange (warm romantic).
 * Used on hero surfaces, KPI cards, FAB, premium-tier badges, IPO ticker.
 */

import { colors, getThemeColors } from '@/lib/config/theme';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';

/** Signature gradient — indigo → cyan. */
export const HUSTLE_GRADIENT = ['#6366F1', '#06B6D4'] as const;
/** Subtle 25% variant for backdrops. */
export const HUSTLE_GRADIENT_SOFT = ['rgba(99, 102, 241, 0.18)', 'rgba(6, 182, 212, 0.18)'] as const;
/** Premium gold gradient — used on IPO ticker badges + ultra perks. */
export const HUSTLE_GRADIENT_GOLD = ['#FBBF24', '#F59E0B'] as const;
/** Bull/bear gradients for stock-price chips. */
export const HUSTLE_BULL = ['#10B981', '#059669'] as const;
export const HUSTLE_BEAR = ['#EF4444', '#B91C1C'] as const;

/** Spacing presets — generous, dashboard-first. */
export const HUSTLE_DENSITY = {
  pagePadding: responsiveSpacing.md,
  pagePaddingHero: responsiveSpacing.lg,
  cardPadding: responsiveSpacing.md,
  cardGap: responsiveSpacing.md,
  sectionGap: scale(20),
  rowGap: responsiveSpacing.sm,
} as const;

/** Motion timings (ms). Respect reduced-motion at call site. */
export const HUSTLE_MOTION = {
  tab: 220,
  modalIn: 300,
  countUp: 700,
  kpiPulse: 900,
} as const;

/** Text size scale. */
export const HUSTLE_TEXT = {
  display: fontScale(28),
  title: fontScale(20),
  subtitle: fontScale(16),
  body: fontScale(14),
  caption: fontScale(12),
  micro: fontScale(10),
} as const;

/** Semantic colors for in-app messaging + industry chips. */
export const HUSTLE_COLORS = {
  // Brand
  accent: '#6366F1',
  accentSecondary: '#06B6D4',
  // Semantic
  danger: colors.palette.danger,
  warning: colors.palette.warning,
  success: colors.palette.success,
  info: colors.palette.info,
  // KPI trends
  trendUp: colors.palette.success,
  trendDown: colors.palette.danger,
  trendFlat: colors.palette.dark500,
  // Industries (matches lucide icon palette)
  factory: '#F59E0B',     // amber
  ai: '#8B5CF6',          // violet
  restaurant: '#EF4444',  // red
  realestate: '#10B981',  // green
  bank: '#3B82F6',        // blue
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

export function resolveHustleTheme(darkMode: boolean) {
  const base = getThemeColors(darkMode);
  return {
    base,
    gradient: HUSTLE_GRADIENT,
    gradientSoft: HUSTLE_GRADIENT_SOFT,
    gradientGold: HUSTLE_GRADIENT_GOLD,
    bull: HUSTLE_BULL,
    bear: HUSTLE_BEAR,
    density: HUSTLE_DENSITY,
    motion: HUSTLE_MOTION,
    text: HUSTLE_TEXT,
    hustle: HUSTLE_COLORS,
  };
}

export type HustleTheme = ReturnType<typeof resolveHustleTheme>;
