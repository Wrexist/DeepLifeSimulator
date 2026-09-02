/**
 * The visual weight scale and the vertical rhythm scale - Master Program 4.
 *
 * Programs 1 and 3 gave every screen the same primitives at the same size, so
 * the remaining machine-made tell was STRUCTURAL: equal cards, equal tiles,
 * equal gaps, nothing dominant. These two ladders are how a screen says
 * "this matters most, this is next, this can wait". Rules and the reasoning
 * are in `tasks/ui-hierarchy.md`; the short version:
 *
 *   - ONE tier-1 element per screen, chosen from player state where the state
 *     changes what matters (a promotion you can take, a disease you can
 *     treat, the goal closest to done). Everything else is tier 2 or lower.
 *   - Asymmetry changes at least two axes (scale + position, weight + colour,
 *     span + density). One axis looks accidental.
 *   - Whitespace explains grouping: `micro` and `tight` inside one thing,
 *     `section` and `major` between hierarchy changes. The steps are the
 *     existing `responsiveSpacing` values under names that say what the gap
 *     MEANS - no new numbers, no second ladder (see the note in
 *     `lib/config/theme.ts` about why `spacing` was deleted).
 *   - Colour is never the only axis and never decoration: the primary action
 *     and semantic state, nothing else.
 *
 * Text styles are plain objects so they spread into any `StyleSheet.create`
 * entry; every size is `fontScale`d and every line box is scaled with it
 * (`__tests__/render/hudLegibility.test.ts` sweeps for the raw-line-box bug).
 */
import type { TextStyle } from 'react-native';
import { fontScale, responsiveSpacing, scale } from '@/utils/scaling';
import { accent } from '@/lib/config/theme';

/** Tier 1 - the one dominant element: a headline that names the situation. */
export const tier1Title: TextStyle = {
  fontSize: fontScale(20),
  lineHeight: fontScale(26),
  fontWeight: '700',
  letterSpacing: -0.3,
};

/** Tier 1 - the one dominant NUMBER (net worth, take-home, salary). */
export const tier1Value: TextStyle = {
  fontSize: fontScale(28),
  lineHeight: fontScale(34),
  fontWeight: '600',
  letterSpacing: -0.4,
  fontVariant: ['tabular-nums'],
};

/** Tier 2 - primary supporting content: card titles, section headings. */
export const tier2: TextStyle = {
  fontSize: fontScale(15),
  lineHeight: fontScale(20),
  fontWeight: '600',
};

/** Tier 3 - secondary content: body copy, list rows. Regular weight so that
 *  bold means something again. */
export const tier3: TextStyle = {
  fontSize: fontScale(13),
  lineHeight: fontScale(18),
  fontWeight: '400',
};

/** Tier 4 - metadata: captions, fractions, timestamps. Always muted colour. */
export const tier4: TextStyle = {
  fontSize: fontScale(11),
  lineHeight: fontScale(15),
  fontWeight: '500',
};

/** Tier 4 kicker - the small-caps label above a tier-1 or tier-2 title. */
export const kicker: TextStyle = {
  fontSize: fontScale(10),
  lineHeight: fontScale(14),
  fontWeight: '600',
  letterSpacing: 0.8,
  textTransform: 'uppercase',
};

/**
 * Vertical rhythm. Named by what the gap separates, not by size, so a reader
 * of a style sheet can tell whether two things are one thought or two.
 */
export const rhythm = {
  /** Inside one fact: a label and its value, an icon and its word. */
  micro: responsiveSpacing.xs,
  /** Between related rows of one component. */
  tight: responsiveSpacing.sm,
  /** Between cards in one band - the `Card` primitive's own margin. */
  group: scale(12),
  /** Between bands of different kinds of content. */
  section: responsiveSpacing.md,
  /** A hierarchy change: after the dominant element, before "everything else". */
  major: responsiveSpacing.lg,
} as const;

/**
 * THE vital-state model (Program 5). Nine different answers to "when is a
 * vital low" lived in the app - 25 in the tips, 30 in the issues card, 40 in
 * a dead HUD grader, 50 on the pet rail - so the same number could be silent
 * on Home, amber on Health and red in the HUD at once. One ladder now:
 *
 *   critical  <= 20   danger   the HUD glows, the number goes red, a tip fires
 *   low       <= 40   warning  listed as an issue, amber
 *   fair      <  80   quiet
 *   good      >= 80   quiet    (the word exists; the colour does not - a number
 *                               that is fine says nothing, like the HUD's)
 *
 * The rule the HUD already followed: a stat's IDENTITY colour (STAT_IDENTITY)
 * paints its icon, ring and label; the graded STATE paints only the number
 * and any badge. Identity says which stat; state says how it is doing.
 */
export const CRITICAL_VITAL = 20;
export const LOW_VITAL = 40;
export const GOOD_VITAL = 80;

export type VitalLevel = 'critical' | 'low' | 'fair' | 'good';

export interface VitalState {
  level: VitalLevel;
  /** Danger / warning from `accent`; undefined for fair AND good - only a
   *  problem takes a colour, so a screen full of fine numbers stays quiet. */
  color: string | undefined;
  /** The one word every surface uses for the band. */
  word: 'Critical' | 'Low' | 'Fair' | 'Good';
}

export function vitalState(value: number | undefined | null): VitalState {
  const v = typeof value === 'number' && Number.isFinite(value) ? value : 100;
  if (v <= CRITICAL_VITAL) return { level: 'critical', color: accent.danger, word: 'Critical' };
  if (v <= LOW_VITAL) return { level: 'low', color: accent.warning, word: 'Low' };
  if (v < GOOD_VITAL) return { level: 'fair', color: undefined, word: 'Fair' };
  return { level: 'good', color: undefined, word: 'Good' };
}
