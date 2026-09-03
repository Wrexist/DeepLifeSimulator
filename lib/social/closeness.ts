/**
 * What a bond score MEANS — one definition, for every system that asks.
 *
 * ## The measurement this exists to answer
 *
 * Program 12 ran nine cohorts through 250 weeks of the real tick, identical in
 * every respect except who was in the life and at what bond, with the bonds
 * re-stamped weekly so decay could not confound the comparison
 * (`__tests__/simulation/relationshipValue.sim.test.ts`). The result:
 *
 *   cohort        netWorth  happiness  meanHappiness  health  energy
 *   NOBODY          14,856         96           81.7       0      96
 *   ONE AT 60       17,656         96           81.7       0      96
 *   ONE AT 100      17,656         96           81.7       0      96
 *   FIFTY AT 45     14,856         96           81.7       0      96
 *
 * Happiness, health and energy are BYTE-IDENTICAL whether a life contains
 * nobody, one soulmate, or fifty acquaintances. The entire mechanical value of
 * every relationship in the game was the $2,800 Chapter 2 bundle, paid once,
 * for crossing 60 once — and 60, 75, 90 and 100 were indistinguishable.
 *
 * The cause was not that the wiring was weak. It was that the ONLY wire between
 * relationships and wellbeing ran in one direction: `applyRelationshipHealth`
 * levies −25 on a breakup, −10 on a disappointed partner, −8 on a friendship
 * fading and a standing −1/week (capped −3) for estrangement, and has no
 * counterpart of any kind. The game modelled relationships as a pure liability.
 *
 * ## The model
 *
 * A bond buys two things, and neither is a payout:
 *
 *   RESILIENCE — a close bond makes the bad weeks less bad. This is the
 *     missing half of the wire above, capped with the same shape and the same
 *     magnitude as the drag it mirrors, so a large circle cannot out-earn a
 *     small one and no amount of friendship offsets an unlived life.
 *
 *   POSSIBILITY — a close bond puts things on the screen that are not there
 *     otherwise: somebody shows up when the floor falls out, and somebody can
 *     be asked for a favour. Those are decisions and stories, not statistics.
 *
 * What a bond deliberately does NOT buy is income. Program 11 removed the one
 * relationship that paid a salary (a partner's annual income spent weekly, up
 * to $62,500/wk) and nothing here re-opens that door: no tier below grants
 * money on a timer.
 */

import type { GameState, Relationship } from '@/contexts/game/types';

/**
 * The bands, named.
 *
 * `close` is 60 because that number was already load-bearing in three places
 * before this module existed — `strongRelationshipCount` (`lib/goals/playstyle.ts`,
 * which drives the goal engine's social emphasis and the
 * `soon_deepen_friendships` goal), `ch2_someone_close`, and the life story's
 * "friendships the life kept" line. Adding a fourth threshold would have made
 * "close" mean two things; this module is the one definition and those callers
 * keep their own predicate only where it is already exported and shared.
 */
export const BOND = {
  /** Below this a relationship is decaying out of the life (NEGLECT_THRESHOLD). */
  estranged: 25,
  /** Known, not close. Where a met acquaintance and a fresh Spark friend start. */
  known: 45,
  /** A real relationship — the one the rest of the game already calls "strong". */
  close: 60,
  /** The people a life is actually built on. */
  trusted: 80,
} as const;

export type BondTier = 'estranged' | 'known' | 'close' | 'trusted';

/** Which band a score sits in. */
export function bondTier(score: number | undefined): BondTier {
  const n = typeof score === 'number' && Number.isFinite(score) ? score : 0;
  if (n >= BOND.trusted) return 'trusted';
  if (n >= BOND.close) return 'close';
  if (n >= BOND.estranged) return 'known';
  return 'estranged';
}

/** Is this somebody the player has actually built something with? */
export function isCloseBond(rel: Pick<Relationship, 'relationshipScore'> | null | undefined): boolean {
  return (rel?.relationshipScore ?? 0) >= BOND.close;
}

/**
 * The people who would show up for you, closest first.
 *
 * Family counts: a parent at 70 is somebody in your corner, and excluding them
 * would mean a player who never used a social app has nobody — which is exactly
 * the "relationships are optional" rule pointing the wrong way. A CHILD is
 * excluded: a seven-year-old is not who you lean on, and every child starts at
 * a high bond by construction (`NEWBORN_BOND` is 75), so counting them would
 * hand the whole model to anyone who had a baby.
 */
export function closeCircle(state: GameState | null | undefined): Relationship[] {
  return (state?.relationships ?? [])
    .filter((r): r is Relationship => !!r && r.type !== 'child' && isCloseBond(r))
    .sort((a, b) => (b.relationshipScore ?? 0) - (a.relationshipScore ?? 0));
}

/**
 * The people who would actually turn up if the floor fell out.
 *
 * `trusted` (80), not `close` (60), and the distinction is the point: a close
 * bond changes how a life FEELS week to week; a trusted one changes what
 * happens to it when things go wrong. That is what makes 80 mean something 60
 * does not — the §5 question this module was written to answer — and it is why
 * the band is not decoration.
 *
 * Reaching it is roughly fifteen weeks of actually keeping in touch from where
 * a new friend starts (40-45 at +3 a Call, plus the want bonus), which is the
 * price of somebody being that person for you.
 */
export function supportCircle(state: GameState | null | undefined): Relationship[] {
  return closeCircle(state).filter((r) => (r.relationshipScore ?? 0) >= BOND.trusted);
}

/**
 * Weekly happiness a single close bond contributes.
 *
 * Deliberately the same magnitude as `NEGLECT_HAPPINESS_DRAG` (−1), because
 * this is that wire's missing half rather than a new reward: one point for
 * somebody you are close to, one point off for somebody you have let go.
 */
export const CLOSE_BOND_HAPPINESS = 1;

/**
 * Ceiling on the TOTAL weekly happiness a circle can contribute.
 *
 * The mirror of `NEGLECT_HAPPINESS_DRAG_CAP` (−3), and the reason quantity
 * cannot beat quality: three close bonds reach the cap, and the fiftieth
 * acquaintance is worth exactly as much as the fourth, which is nothing. It is
 * also why this cannot become a strategy — natural decay is 4/week
 * (`lib/economy/statDecay.ts`), so a maxed circle offsets three quarters of one
 * stat's drift and nothing else. A player still has to live.
 */
export const CLOSE_BOND_HAPPINESS_CAP = 3;

/**
 * What the circle is worth this week: +1 per close bond, capped.
 *
 * Pure, so the HUD breakdown and the tick can call the same function and cannot
 * disagree about the number — the rule `statDecay.ts` established for decay.
 */
export function closeCircleHappiness(state: GameState | null | undefined): number {
  const n = closeCircle(state).length;
  return Math.min(CLOSE_BOND_HAPPINESS_CAP, n * CLOSE_BOND_HAPPINESS);
}
