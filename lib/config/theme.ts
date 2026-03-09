/**
 * Design Token System — DeepLifeSim
 *
 * Single source of truth for colors, spacing, typography, and radii.
 * Components should import from here instead of hardcoding values.
 *
 * Usage:
 *   import { colors, spacing, typography, radii } from '@/lib/config/theme';
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
    textSecondary: palette.dark500,
    textMuted: palette.dark600,
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
    textSecondary: palette.light400,
    textMuted: palette.light300,
    overlay: 'rgba(0, 0, 0, 0.4)',
    glassBg: 'rgba(255, 255, 255, 0.3)',
    glassBorder: 'rgba(255, 255, 255, 0.4)',
  },
} as const;

/** Get theme colors for the current mode */
export function getThemeColors(darkMode: boolean) {
  return darkMode ? colors.dark : colors.light;
}

// ---------------------------------------------------------------------------
// Spacing (4px base grid)
// ---------------------------------------------------------------------------

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 48,
} as const;

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

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
} as const;

// ---------------------------------------------------------------------------
// Animation Timing
// ---------------------------------------------------------------------------

export const animation = {
  fast: 150,
  normal: 300,
  slow: 500,

  spring: {
    snappy: { damping: 20, stiffness: 300 },
    gentle: { damping: 15, stiffness: 150 },
    bouncy: { damping: 10, stiffness: 200 },
  },
} as const;
