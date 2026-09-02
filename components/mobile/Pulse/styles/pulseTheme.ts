/**
 * Pulse theme tokens — app-specific overlays on the global theme.
 *
 * Source of truth for the brand gradient, density, motion timings, and
 * Pulse-specific colors used across every Pulse screen and component.
 *
 * Global theme (`@/lib/config/theme`) is the underlying foundation; this
 * file adds Pulse-only design decisions (the signature magenta→indigo,
 * the EKG ring widths, the count-up timings, etc.).
 */

import { colors, getThemeColors } from '@/lib/config/theme';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';

/**
 * Signature gradient. One consumer left: the EmptyState EKG illustration's SVG
 * stroke. The FAB is deleted, and the hero surfaces, verified badge and viral
 * border are solid identity tint now - the only JSX gradient in Pulse is the
 * primary Post CTA in ComposeModal, which builds its stops from PULSE_COLORS.
 */
export const PULSE_GRADIENT = ['#EC4899', '#6366F1'] as const;
/** Subtle 30% variant for backdrops, post backgrounds. */
export const PULSE_GRADIENT_SOFT = ['rgba(236, 72, 153, 0.18)', 'rgba(99, 102, 241, 0.18)'] as const;
/*
 * The two scandal-severity GRADIENTS that used to live here are gone: the
 * banner and the recovery meter now read severity as ONE colour
 * (`PULSE_COLORS.scandalHigh` / `scandalMid`), so a two-stop ramp had nothing
 * left to say and no callers.
 */

/**
 * Pulse density / spacing presets — generous breathing room.
 *
 * The base values below are pre-`scale()`. `cardPadding`/`cardGap` carried
 * `// 12` against `responsiveSpacing.md`, which is 16 — the author was reading
 * the OTHER `spacing.md` (the raw ladder that used to live in
 * `lib/config/theme.ts`, since deleted, where `md` was 12). The rendered value
 * has always been 16; only the comments were wrong, and they are corrected
 * rather than the numbers, because 16 is what these screens were reviewed at.
 */
export const PULSE_DENSITY = {
  pagePadding: responsiveSpacing.md,        // 16
  pagePaddingHero: responsiveSpacing.lg,    // 24
  cardPadding: responsiveSpacing.md,        // 16
  cardGap: responsiveSpacing.md,            // 16
  sectionGap: scale(20),
  rowGap: responsiveSpacing.sm,             // 8
} as const;

/** Pulse motion timings (ms). Respect Reduced Motion settings at call site. */
export const PULSE_MOTION = {
  tab: 220,
  modalIn: 300,
  countUp: 800,
  viralShimmer: 1200,
  liveRingLoop: 1400,
  scandalBanner: 600,
  verifiedShine: 600,
  likeBurst: 400,
  repostSpin: 250,
  likeSpring: 200,
} as const;

/** Pulse-specific text sizes (still funnel through fontScale at call site). */
export const PULSE_TEXT = {
  display: fontScale(28),
  title: fontScale(20),
  subtitle: fontScale(16),
  body: fontScale(14),
  caption: fontScale(12),
  micro: fontScale(10),
} as const;

/** Border widths used in Pulse — 1pt accents, 1.5pt cards, 2pt active rings. */
export const PULSE_BORDER = {
  hairline: 1,
  card: 1.5,
  activeRing: 2,
  gradientFrame: scale(1),
} as const;

/**
 * Pulse semantic colors layered on the global stat palette.
 *
 * NOTE — duplicate keys are intentional aliases. If you change the underlying
 * palette token, both names rotate together; if a future redesign breaks the
 * pairing, update both sides:
 *
 *   accent ←→ tierCelebrity ←→ palette.reputation (#EC4899)
 *   like ←→ scandalHigh ←→ danger ←→ palette.danger
 *   repost ←→ scandalLow ←→ success ←→ palette.success
 *   bookmark ←→ info ←→ palette.info
 *   verified ←→ tierInfluencer ←→ palette.primary
 *   warning ←→ scandalMid ←→ palette.warning
 *
 * Rule of thumb: use the semantic name at the call site (like, repost, scandalHigh)
 * rather than `danger`/`success` — it documents *why* the color was chosen.
 */
export const PULSE_COLORS = {
  // Brand
  accent: '#EC4899',          // matches PULSE_GRADIENT[0]
  accentSecondary: '#6366F1', // matches PULSE_GRADIENT[1]
  // Semantic aliases for in-app messaging
  danger: colors.palette.danger,
  warning: colors.palette.warning,
  success: colors.palette.success,
  info: colors.palette.info,
  // Engagement
  like: colors.palette.danger,
  repost: colors.palette.success,
  bookmark: colors.palette.info,
  // Verified Pro
  verified: colors.palette.primary,
  // Scandal severity bins
  scandalLow: colors.palette.success,
  scandalMid: colors.palette.warning,
  scandalHigh: colors.palette.danger,
  // Influence tier accent
  tierNovice: colors.palette.dark500,
  tierRising: colors.palette.info,
  tierPopular: colors.palette.primaryLight,
  tierInfluencer: colors.palette.primary,
  tierCelebrity: colors.palette.reputation,
} as const;

/** Resolve the Pulse theme bundle for the active dark/light mode. */
export function resolvePulseTheme(darkMode: boolean) {
  const base = getThemeColors(darkMode);
  return {
    base,
    gradient: PULSE_GRADIENT,
    gradientSoft: PULSE_GRADIENT_SOFT,
    density: PULSE_DENSITY,
    motion: PULSE_MOTION,
    text: PULSE_TEXT,
    border: PULSE_BORDER,
    pulse: PULSE_COLORS,
  };
}

export type PulseTheme = ReturnType<typeof resolvePulseTheme>;
