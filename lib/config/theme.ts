import { Platform } from 'react-native';
/**
 * Design Token System — DeepLifeSim
 *
 * Single source of truth for colors, typography, and radii. Spacing lives in
 * `@/utils/scaling` (`responsiveSpacing`, `scale`) and deliberately NOT here —
 * see the note where its ladder used to be.
 * Components should import from here instead of hardcoding values.
 *
 * Usage:
 *   import { colors, typography, radii } from '@/lib/config/theme';
 *   // or with dark mode:
 *   const c = colors.dark; // or colors.light
 */

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const palette = {
  // Neutrals
  white: '#FFFFFF',
  black: '#000000',

  // Dark mode backgrounds (current default)
  dark900: '#0F172A',   // deepest bg
  dark800: '#1E293B',   // card bg
  dark700: '#334155',   // elevated surface
  dark600: '#475569',   // subtle border
  dark500: '#64748B',   // muted text

  // Light mode backgrounds
  light50: '#F8FAFC',
  light100: '#F1F5F9',
  light200: '#E2E8F0',
  light300: '#CBD5E1',
  light400: '#94A3B8',

  // Brand / Accent
  primary: '#6366F1',    // indigo
  primaryLight: '#818CF8',
  primaryDark: '#4F46E5',

  // Semantic
  success: '#10B981',
  successLight: '#34D399',
  warning: '#F59E0B',
  warningLight: '#FBBF24',
  danger: '#EF4444',
  dangerLight: '#F87171',
  info: '#3B82F6',
  infoLight: '#60A5FA',

  // Game-specific
  health: '#10B981',
  happiness: '#F59E0B',
  energy: '#3B82F6',
  fitness: '#8B5CF6',
  money: '#10B981',
  gems: '#6366F1',
  reputation: '#EC4899',

  // Gradients
  gradientPrimary: ['#6366F1', '#8B5CF6'] as const,
  gradientSuccess: ['#10B981', '#34D399'] as const,
  gradientDanger: ['#EF4444', '#F87171'] as const,
  gradientGold: ['#F59E0B', '#D97706'] as const,
  gradientDark: ['#1E293B', '#0F172A'] as const,
} as const;

export const colors = {
  palette,

  dark: {
    background: palette.dark900,
    surface: palette.dark800,
    surfaceElevated: palette.dark700,
    border: 'rgba(255, 255, 255, 0.1)',
    borderStrong: 'rgba(255, 255, 255, 0.2)',
    text: palette.white,
    // Dark-mode secondary/muted text on dark800 cards. The previous
    // dark500/dark600 grays were ~3.0:1 and ~1.9:1 contrast — muted labels
    // (Bank's "Cash/Bank/Debt", credit-score scale, account subtitles) were
    // nearly invisible. light300/light400 pass WCAG AA (~9.4:1 / ~5.9:1)
    // while keeping the secondary > muted hierarchy.
    textSecondary: palette.light300,
    textMuted: palette.light400,
    overlay: 'rgba(0, 0, 0, 0.6)',
    glassBg: 'rgba(15, 23, 42, 0.3)',
    glassBorder: 'rgba(255, 255, 255, 0.15)',
  },

  light: {
    background: palette.light50,
    surface: palette.white,
    surfaceElevated: palette.light100,
    border: 'rgba(0, 0, 0, 0.08)',
    borderStrong: 'rgba(0, 0, 0, 0.15)',
    text: palette.dark900,
    // Light-mode secondary/muted text on the near-white light50 background.
    // The previous light400/light300 grays were ~2.6:1 and ~1.4:1 contrast —
    // both fail WCAG AA. Darker slate tokens keep secondary more prominent than
    // muted while passing AA (~7:1 and ~4.8:1 on light50).
    textSecondary: palette.dark600,
    textMuted: palette.dark500,
    overlay: 'rgba(0, 0, 0, 0.4)',
    glassBg: 'rgba(255, 255, 255, 0.3)',
    glassBorder: 'rgba(255, 255, 255, 0.4)',
  },
} as const;

/** Get theme colors for the current mode */
export function getThemeColors(darkMode: boolean) {
  return darkMode ? colors.dark : colors.light;
}

/**
 * Semantic accent colors — short, stable names for cross-component reuse.
 * Use these instead of hardcoded hex in new code.
 *
 *   accent.success   →  positive state (gains, completion)
 *   accent.warning   →  caution (high heat, missed payments, dirty BTC)
 *   accent.danger    →  failure (late payments, scams, debt)
 *   accent.info      →  neutral primary action (CTAs, focus)
 *   accent.purple    →  premium / identity / dark-web tier
 *   accent.gold      →  reputation stars / premium tier
 *   accent.amber     →  middle band (warm heat, mid-tier mixer)
 */
export const accent = {
  success: palette.success,       // #10B981
  warning: palette.warning,       // #F59E0B
  danger: palette.danger,         // #EF4444
  info: palette.info,             // #3B82F6
  purple: '#A855F7',
  gold: '#FACC15',
  amber: '#F97316',
  // Inactive/neutral tint. NOT dark500 (#64748B): that is the exact value the
  // contrast pass above condemns at ~3.0:1 on dark cards, and it survived here.
  // #7C8BA1 is the midpoint that clears WCAG's 3:1 UI-component bar on BOTH
  // themes (4.2:1 on dark800, 3.3:1 on light50) — a single static accent can't
  // reach 4.5:1 both ways, so keep it to icons, large text, and states that are
  // also signified by something other than color.
  muted: '#7C8BA1',
} as const;

// ---------------------------------------------------------------------------
// Spacing (4px base grid)
// ---------------------------------------------------------------------------

/**
 * There is no `spacing` export here. That is the resolution of a real problem,
 * so it is recorded rather than left as an absence.
 *
 * This file used to export a raw ladder — `md: 12`, `lg: 16` — while
 * `utils/scaling.ts` exported `responsiveSpacing` with the SAME key names and
 * different values (`md: scale(16)`, `lg: scale(24)`). Same names, different
 * numbers, and only one of the two scaled with the device: on a tablet a screen
 * mixing them drifted, and a reviewer reading `spacing.md` could not tell which
 * ladder was meant without checking the import line.
 *
 * The two were never reconciled because reconciling them looked like a
 * 156-file migration. It was not: by the time anyone measured, this ladder had
 * ZERO importers left — every screen had already drifted onto
 * `responsiveSpacing` on its own. Deleting it costs nothing and leaves exactly
 * one spacing scale in the app.
 *
 * Use `responsiveSpacing` / `scale()` from `@/utils/scaling`. Do not
 * reintroduce an unscaled ladder here; that is the bug, not the fix.
 */

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const typography = {
  size: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 22,
    xxxl: 28,
    display: 34,
  },

  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },

  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },
} as const;

// ---------------------------------------------------------------------------
// Border Radii
// ---------------------------------------------------------------------------

export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  round: 9999,
} as const;

// ---------------------------------------------------------------------------
// Shadows
// ---------------------------------------------------------------------------

/**
 * A react-native-web box-shadow, as a typed style fragment.
 *
 * `boxShadow` is a react-native-web property that React Native's own
 * `ViewStyle` does not declare, which is why the four shadow tiers below each
 * carried an `as any` — and why `no-restricted-syntax`'s own message names this
 * exact case ("for RN-web style shadows, use a typed helper"). This is that
 * helper: one named shape, declared once, instead of four anonymous escapes
 * from the type system.
 */
interface WebBoxShadow {
  boxShadow: string;
}

/** The native side of the same tier — RN's own elevation-shadow props. */
interface NativeBoxShadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
}

/**
 * `Platform.select` infers its generic from the FIRST branch it sees, so a
 * web-only return type makes the native branch a type error. Naming the union
 * explicitly is what lets both branches be checked instead of silenced.
 */
type PlatformShadow = WebBoxShadow | NativeBoxShadow;

const webBoxShadow = (value: string): WebBoxShadow => ({ boxShadow: value });

export const shadows = {
  sm: {
    ...Platform.select<PlatformShadow>({
      web: webBoxShadow('0px 1px 2px rgba(0, 0, 0, 0.1)'),
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
    }),
    elevation: 2,
  },
  md: {
    ...Platform.select<PlatformShadow>({
      web: webBoxShadow('0px 2px 4px rgba(0, 0, 0, 0.15)'),
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
    }),
    elevation: 4,
  },
  lg: {
    ...Platform.select<PlatformShadow>({
      web: webBoxShadow('0px 4px 8px rgba(0, 0, 0, 0.2)'),
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
    }),
    elevation: 8,
  },
  xl: {
    ...Platform.select<PlatformShadow>({
      web: webBoxShadow('0px 8px 16px rgba(0, 0, 0, 0.25)'),
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
    }),
    elevation: 16,
  },
} as const;

// ---------------------------------------------------------------------------
// Animation Timing
// ---------------------------------------------------------------------------

// Motion tiers: micro = press/selection feedback, fast = small state changes,
// normal = screen/content transitions, slow = emphasis. `MotiStub` and
// `usePressableScale` read these as their defaults, so most of the app's motion
// follows this scale without each call site naming a number.
export const animation = {
  micro: 100,
  fast: 150,
  normal: 300,
  slow: 500,

  spring: {
    snappy: { damping: 20, stiffness: 300 },
    gentle: { damping: 15, stiffness: 150 },
    bouncy: { damping: 10, stiffness: 200 },
  },
} as const;
