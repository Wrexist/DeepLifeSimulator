/**
 * Karma / Morality System
 *
 * Tracks cumulative moral weight of player choices across the game.
 * Karma is NOT a simple "good vs evil" bar — it's a multidimensional
 * reputation system that affects NPC reactions, event availability,
 * career paths, and legacy narrative.
 *
 * Score ranges:
 *   -100 (ruthless) ← 0 (neutral) → +100 (virtuous)
 *
 * Dimensions tracked:
 *   - generosity:  Charity, gifts, helping NPCs
 *   - honesty:     Truthful event choices, fair business
 *   - violence:    Crime severity, fights, aggression
 *   - loyalty:     Relationship fidelity, keeping promises
 *   - ambition:    Ruthless career moves, exploitation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KarmaEvent {
  /** What triggered the karma change */
  reason: string;
  /** Change amount (-20 to +20 per event) */
  amount: number;
  /** Which dimension this affects */
  dimension: KarmaDimension;
  /** When it happened (weeksLived) */
  week: number;
}

export type KarmaDimension =
  | 'generosity'
  | 'honesty'
  | 'violence'
  | 'loyalty'
  | 'ambition';

export interface KarmaState {
  /** Overall karma score, -100 to 100 */
  score: number;
  /** Per-dimension scores, -100 to 100 */
  dimensions: Record<KarmaDimension, number>;
  /** Recent karma events (last 50) */
  history: KarmaEvent[];
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const INITIAL_KARMA: KarmaState = {
  score: 0,
  dimensions: {
    generosity: 0,
    honesty: 0,
    violence: 0,
    loyalty: 0,
    ambition: 0,
  },
  history: [],
};

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

const KARMA_MIN = -100;
const KARMA_MAX = 100;
const MAX_HISTORY = 50;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Apply a karma change and return the new KarmaState.
 * Does NOT mutate the input.
 */
export function applyKarmaChange(
  karma: KarmaState,
  dimension: KarmaDimension,
  amount: number,
  reason: string,
  weeksLived: number,
): KarmaState {
  const clamped = clamp(amount, -20, 20);

  const newDimensions = { ...karma.dimensions };
  newDimensions[dimension] = clamp(
    newDimensions[dimension] + clamped,
    KARMA_MIN,
    KARMA_MAX,
  );

  // Overall score is the average of all dimensions
  const dimValues = Object.values(newDimensions);
  const newScore = clamp(
    Math.round(dimValues.reduce((a, b) => a + b, 0) / dimValues.length),
    KARMA_MIN,
    KARMA_MAX,
  );

  const event: KarmaEvent = {
    reason,
    amount: clamped,
    dimension,
    week: weeksLived,
  };

  const newHistory = [...karma.history, event].slice(-MAX_HISTORY);

  return {
    score: newScore,
    dimensions: newDimensions,
    history: newHistory,
  };
}

// ---------------------------------------------------------------------------
// Karma tier labels (for UI display)
// ---------------------------------------------------------------------------

export type KarmaTier =
  | 'saint'
  | 'virtuous'
  | 'good'
  | 'neutral'
  | 'questionable'
  | 'corrupt'
  | 'ruthless';

export function getKarmaTier(score: number): KarmaTier {
  if (score >= 75) return 'saint';
  if (score >= 40) return 'virtuous';
  if (score >= 15) return 'good';
  if (score >= -15) return 'neutral';
  if (score >= -40) return 'questionable';
  if (score >= -75) return 'corrupt';
  return 'ruthless';
}

export function getKarmaLabel(tier: KarmaTier): string {
  switch (tier) {
    case 'saint': return 'Saint';
    case 'virtuous': return 'Virtuous';
    case 'good': return 'Good-hearted';
    case 'neutral': return 'Neutral';
    case 'questionable': return 'Questionable';
    case 'corrupt': return 'Corrupt';
    case 'ruthless': return 'Ruthless';
  }
}

export function getKarmaColor(tier: KarmaTier): string {
  switch (tier) {
    case 'saint': return '#FBBF24';      // gold
    case 'virtuous': return '#34D399';    // emerald
    case 'good': return '#60A5FA';        // blue
    case 'neutral': return '#9CA3AF';     // gray
    case 'questionable': return '#F97316'; // orange
    case 'corrupt': return '#F87171';     // red
    case 'ruthless': return '#991B1B';    // dark red
  }
}

// ---------------------------------------------------------------------------
// Gameplay modifiers based on karma
// ---------------------------------------------------------------------------

/**
 * Returns multipliers/modifiers that other systems can use.
 */
export function getKarmaModifiers(karma: KarmaState) {
  const tier = getKarmaTier(karma.score);

  return {
    /** NPC trust modifier — affects relationship gain speed */
    npcTrustMultiplier:
      tier === 'saint' ? 1.3 :
      tier === 'virtuous' ? 1.15 :
      tier === 'good' ? 1.05 :
      tier === 'neutral' ? 1.0 :
      tier === 'questionable' ? 0.9 :
      tier === 'corrupt' ? 0.75 :
      0.6,

    /** Crime success modifier — corrupt characters are better criminals.
     *  BUGFIX: order was reversed — `violence < -30` matched first for any
     *  value below -60, so the 0.25 tier was unreachable. Now checks the
     *  more extreme bound first. */
    crimeSuccessBonus:
      karma.dimensions.violence < -60 ? 0.25 :
      karma.dimensions.violence < -30 ? 0.15 :
      0,

    /** Political approval modifier */
    politicalApprovalModifier:
      karma.score > 40 ? 5 :
      karma.score > 15 ? 2 :
      karma.score < -40 ? -5 :
      karma.score < -15 ? -2 :
      0,

    // `canAccessHonestCareers`, `canAccessCorruptCareers` and
    // `reputationMultiplier` were deleted (LATE-15): computed here, read by
    // nothing anywhere, so karma promised career gates and a reputation
    // multiplier the game never applied. Every modifier left in this object
    // has a production reader, and `karmaEffectLines` describes exactly these.
  };
}

/**
 * Weekly scandal odds negative karma adds for an office-holder: 0.1 points per
 * karma point below zero. Mirrors the karma term of `scandalProbability`
 * (lib/politics/scandals.ts), which is what the politics tick applies.
 */
export function karmaScandalRiskPct(score: number): number {
  const s = typeof score === 'number' && isFinite(score) ? score : 0;
  return Math.max(0, -s) * 0.1;
}

/** One line of what karma is doing to this life right now. */
export interface KarmaEffectLine {
  text: string;
  /** True for a help, false for a hindrance. */
  upside: boolean;
}

const pctText = (n: number) => `${Math.round(n * 10) / 10}%`;

/**
 * What the player's karma ACTUALLY does, generated from the same modifiers the
 * systems read (LATE-15). Karma moved election odds, bond growth, street-crime
 * success and scandal risk while no screen showed it; the identity card lists
 * these lines so a hidden stat stops changing outcomes the player cannot see.
 * Only non-neutral effects are listed: an empty list means karma is changing
 * nothing right now.
 */
export function karmaEffectLines(karmaIn: KarmaState | null | undefined): KarmaEffectLine[] {
  // A render path: a partial or missing karma record reads as neutral rather
  // than throwing on `dimensions.violence`.
  const karma: KarmaState = {
    ...INITIAL_KARMA,
    ...(karmaIn ?? {}),
    dimensions: { ...INITIAL_KARMA.dimensions, ...(karmaIn?.dimensions ?? {}) },
  };
  const m = getKarmaModifiers(karma);
  const lines: KarmaEffectLine[] = [];
  if (m.npcTrustMultiplier !== 1) {
    const pct = Math.round((m.npcTrustMultiplier - 1) * 100);
    lines.push({
      text: `Bonds grow ${Math.abs(pct)}% ${pct > 0 ? 'faster' : 'slower'} when you reach out`,
      upside: pct > 0,
    });
  }
  if (m.politicalApprovalModifier !== 0) {
    lines.push({
      text: `${m.politicalApprovalModifier > 0 ? '+' : '-'}${Math.abs(m.politicalApprovalModifier)} points on your election odds`,
      upside: m.politicalApprovalModifier > 0,
    });
  }
  if (m.crimeSuccessBonus > 0) {
    lines.push({
      text: `+${Math.round(m.crimeSuccessBonus * 100)}% success on street jobs (a record of violence)`,
      upside: true,
    });
  }
  const scandal = karmaScandalRiskPct(karma.score);
  if (scandal > 0) {
    lines.push({
      text: `+${pctText(scandal)} weekly scandal risk while in office`,
      upside: false,
    });
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Predefined karma impacts for common actions
// ---------------------------------------------------------------------------

/** Use these when calling applyKarmaChange from action files */
export const KARMA_ACTIONS = {
  // Generosity
  DONATE_SMALL: { dimension: 'generosity' as const, amount: 3, reason: 'Made a charitable donation' },
  DONATE_LARGE: { dimension: 'generosity' as const, amount: 8, reason: 'Made a generous donation' },
  GIFT_PARTNER: { dimension: 'generosity' as const, amount: 2, reason: 'Gave a gift to partner' },
  HELP_NPC: { dimension: 'generosity' as const, amount: 4, reason: 'Helped someone in need' },
  REFUSE_HELP: { dimension: 'generosity' as const, amount: -3, reason: 'Refused to help someone' },

  // Honesty
  HONEST_CHOICE: { dimension: 'honesty' as const, amount: 3, reason: 'Made an honest choice' },
  DISHONEST_CHOICE: { dimension: 'honesty' as const, amount: -4, reason: 'Chose deception' },
  FAIR_BUSINESS: { dimension: 'honesty' as const, amount: 2, reason: 'Conducted fair business' },
  EXPLOIT_WORKERS: { dimension: 'honesty' as const, amount: -6, reason: 'Exploited workers' },

  // Violence / Crime
  COMMIT_CRIME: { dimension: 'violence' as const, amount: -5, reason: 'Committed a crime' },
  COMMIT_SERIOUS_CRIME: { dimension: 'violence' as const, amount: -12, reason: 'Committed a serious crime' },
  FIGHT: { dimension: 'violence' as const, amount: -4, reason: 'Got in a fight' },
  DEFEND_SOMEONE: { dimension: 'violence' as const, amount: 3, reason: 'Defended someone' },

  // Loyalty
  CHEAT_PARTNER: { dimension: 'loyalty' as const, amount: -10, reason: 'Cheated on partner' },
  STAY_FAITHFUL: { dimension: 'loyalty' as const, amount: 2, reason: 'Stayed faithful' },
  BREAK_PROMISE: { dimension: 'loyalty' as const, amount: -5, reason: 'Broke a promise' },
  KEEP_PROMISE: { dimension: 'loyalty' as const, amount: 4, reason: 'Kept a promise' },

  // Ambition
  RUTHLESS_BUSINESS: { dimension: 'ambition' as const, amount: -5, reason: 'Made a ruthless business move' },
  ETHICAL_BUSINESS: { dimension: 'ambition' as const, amount: 3, reason: 'Made an ethical business decision' },
  SABOTAGE_RIVAL: { dimension: 'ambition' as const, amount: -7, reason: 'Sabotaged a rival' },
} as const;
