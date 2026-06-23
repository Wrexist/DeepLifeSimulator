/**
 * Onboarding / pre-game menu theme — "amber-dark".
 *
 * A self-contained visual theme for the pre-game flow (MainMenu, SaveSlots,
 * Scenarios, Customize, Perks, loading). Deep near-black base with a warm amber
 * radial glow, dark glassy cards, pill badges, and a gradient CTA.
 *
 * Design decisions (locked):
 *  - MENU-ONLY: this never touches `lib/config/theme.ts` or any in-game styling.
 *  - ALWAYS DARK AMBER: the menu ignores the user's light/dark setting. The
 *    `darkMode` arg on `getOnboardingTheme()` is kept ONLY for call-site
 *    compatibility and is intentionally ignored — every screen renders amber-dark.
 *
 * Prefer `useOnboardingTheme()` in components; `getOnboardingTheme()` remains for
 * existing call sites that pass `darkMode`.
 */

export interface OnboardingTheme {
  // ── Backdrop ──
  /** Solid near-black page base (warm-tinted). */
  base: string;
  /** Amber glow color for the radial backdrop (opacity applied at the gradient). */
  glowColor: string;
  /** Legacy backdrop overlay token (kept for existing callers). */
  backdrop: string;
  /** Legacy top-glow token (kept for existing callers). */
  topGlow: string;
  /** Legacy bottom-shade token (kept for existing callers). */
  bottomShade: string;

  // ── Glass / cards ──
  glassBorder: string;
  glassHighlight: string;
  /** Default dark glassy card fill. */
  card: string;
  cardBorder: string;
  /** Selected card (amber-tinted) fill + border. */
  cardSelected: string;
  cardSelectedBorder: string;

  // ── Typography ──
  title: string;
  subtitle: string;
  /** Eyebrow / pill-badge text (amber). */
  eyebrow: string;
  /** Eyebrow / pill-badge border (amber, translucent). */
  eyebrowBorder: string;
  /** Highlight word in the hero title (e.g. "Here."). */
  accentText: string;

  // ── Difficulty pills ──
  difficulty: { easy: string; medium: string; hard: string };

  // ── CTA (gradient pill) ──
  /** Gradient stops for the primary CTA, e.g. "Start Your Life". */
  ctaGradient: readonly [string, string];
  /** Text/icon color on the amber CTA (dark for contrast). */
  ctaText: string;

  // ── Stat chips ──
  chipBg: string;
  chipText: string;

  // ── Decorative floating chips ──
  floatingChipBg: string;
  floatingChipBorder: string;
}

/** The single source of truth — a frozen amber-dark palette. */
export const ONBOARDING_THEME: OnboardingTheme = Object.freeze({
  // Backdrop
  base: '#0B0A08',
  glowColor: '#F59E0B',
  backdrop: 'rgba(11, 10, 8, 0.55)',
  topGlow: 'rgba(245, 158, 11, 0.18)',
  bottomShade: 'rgba(6, 5, 4, 0.78)',

  // Glass / cards
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  glassHighlight: 'rgba(255, 255, 255, 0.08)',
  card: 'rgba(24, 20, 16, 0.82)',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  cardSelected: 'rgba(245, 158, 11, 0.12)',
  cardSelectedBorder: 'rgba(245, 158, 11, 0.55)',

  // Typography
  title: '#FFF7ED',
  subtitle: 'rgba(245, 235, 220, 0.64)',
  eyebrow: '#FBBF24',
  eyebrowBorder: 'rgba(245, 158, 11, 0.45)',
  accentText: '#FBBF24',

  // Difficulty
  difficulty: { easy: '#22C55E', medium: '#F59E0B', hard: '#EF4444' },

  // CTA
  ctaGradient: ['#FBBF24', '#F97316'] as const,
  ctaText: '#1B1206',

  // Chips
  chipBg: 'rgba(255, 255, 255, 0.06)',
  chipText: 'rgba(245, 235, 220, 0.70)',

  // Floating chips
  floatingChipBg: 'rgba(28, 24, 18, 0.85)',
  floatingChipBorder: 'rgba(245, 158, 11, 0.40)',
});

/**
 * Returns the amber-dark onboarding theme. The `darkMode` argument is accepted
 * for call-site compatibility but IGNORED — the menu is always dark amber.
 */
export function getOnboardingTheme(_darkMode?: boolean): OnboardingTheme {
  return ONBOARDING_THEME;
}

/** Hook flavor — preferred in new/migrated components. */
export function useOnboardingTheme(): OnboardingTheme {
  return ONBOARDING_THEME;
}
