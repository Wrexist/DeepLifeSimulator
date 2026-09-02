/**
 * Attribute IDENTITY - the one place that says what colour and icon a stat
 * wears anywhere in the app.
 *
 * The HUD (`components/TopStatsBar`) taught players these pairings: a red
 * heart is health, a yellow face is happiness, a blue bolt is energy, a green
 * wallet is money, an indigo gem is gems. Every other surface that shows a
 * stat should reuse them, because recognition is the whole point - a player
 * who has learned "yellow = happiness" from the HUD should not have to re-read
 * the word on a popup.
 *
 * Before this module there were THREE disagreeing answers and none of them was
 * the HUD's:
 *
 *   - `theme.ts`'s `palette.health/happiness/energy` (green / amber / blue) -
 *     health GREEN, where the HUD paints it red. Zero consumers, so nothing
 *     rendered wrong, but it is the value a future reader would reach for.
 *   - `src/features/onboarding/perksFlow.ts:getStatColor` - happiness RED and
 *     energy AMBER, i.e. the HUD's colours swapped onto the wrong stats. It
 *     delegates here now. The Health screen, its cards, the sickness modal
 *     and the Statistics app were the last hold-outs (health green, energy
 *     amber, happiness green, "Mood" in gold) - closed in Program 5. The
 *     graded STATE of a vital (critical / low / fair / good) is a separate
 *     axis: `vitalState` in `lib/config/hierarchy.ts` paints the number; this
 *     file paints the icon.
 *   - `TopStatsBar` itself, as hard-coded literals with the comment
 *     "Yellow to match bar color" - the real source, now re-exported from here
 *     so the HUD and everything else cannot drift apart.
 *
 * `palette` in `theme.ts` stays the general design palette; THIS is stat
 * identity. When they disagree about a stat, this file is what players see.
 */
import {
  Heart,
  Smile,
  Zap,
  Wallet,
  Gem,
  Dumbbell,
  Star,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';

export interface StatIdentity {
  /** The colour this stat wears everywhere. Matches the HUD. */
  color: string;
  /** The glyph this stat wears everywhere. Matches the HUD. */
  Icon: LucideIcon;
  /** Human label, for surfaces that don't carry their own copy. */
  label: string;
}

/**
 * Every stat a player can see move. Keys are the `stat` values used by
 * life-moment effects (`lib/lifeMoments`) and the stats block on GameState.
 */
export const STAT_IDENTITY: Record<string, StatIdentity> = {
  health:     { color: '#EF4444', Icon: Heart,    label: 'Health' },
  happiness:  { color: '#F59E0B', Icon: Smile,    label: 'Happiness' },
  energy:     { color: '#3B82F6', Icon: Zap,      label: 'Energy' },
  money:      { color: '#22C55E', Icon: Wallet,   label: 'Money' },
  gems:       { color: '#6366F1', Icon: Gem,      label: 'Gems' },
  fitness:    { color: '#8B5CF6', Icon: Dumbbell, label: 'Fitness' },
  reputation: { color: '#EC4899', Icon: Star,     label: 'Reputation' },
};

/** Anything not in the table renders as a neutral sparkle rather than nothing. */
export const FALLBACK_STAT_IDENTITY: StatIdentity = {
  color: '#94A3B8',
  Icon: Sparkles,
  label: 'Effect',
};

/**
 * Identity for a stat key. Never throws and never returns undefined - an
 * unknown stat (a new one, or a corrupted save) still gets a readable chip.
 */
export function statIdentity(stat: string | undefined | null): StatIdentity {
  if (!stat) return FALLBACK_STAT_IDENTITY;
  return STAT_IDENTITY[stat] ?? FALLBACK_STAT_IDENTITY;
}

/**
 * The two DIRECTION colours: is this change good or bad for me?
 *
 * Deliberately separate from the identity colours above so the two readings
 * never collide - the chip's tint and icon say WHICH stat, the arrow says
 * WHICH WAY. A green "+6" printed on an amber happiness chip muddles both.
 */
export const DIRECTION_COLOR = {
  positive: '#10B981',
  negative: '#EF4444',
} as const;

/** Translucent tint of a stat's colour, for chip fills and borders. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (!isFinite(r) || !isFinite(g) || !isFinite(b)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
