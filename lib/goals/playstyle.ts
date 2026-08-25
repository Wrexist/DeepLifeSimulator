/**
 * Playstyle emphasis — "what kind of life is this player actually building?"
 *
 * A pure, continuous read over `GameState`, consumed by the goal catalogue's
 * `priority` functions so the SOON/DREAM recommendation leans toward what the
 * player already invests in: a founder's next goal is the second company, an
 * investor's the next portfolio rung, a social player's the people. Before
 * this, every catalogue priority was a constant literal — a landlord, a
 * careerist and a founder were shown identical goals in identical order.
 *
 * Scores, not buckets. The two classifiers that predate this
 * (`lib/offers/personalization.ts` `audienceFor` — monetization surfaces —
 * and `lib/legacy/ribbonSystem.ts` `classifyLife` — the death screen) both
 * collapse to a single label, which is the wrong shape here: a player can be
 * 0.8 business AND 0.6 social, and their goals should reflect both rather
 * than whichever label won. Neither existing consumer is changed.
 *
 * Deliberately BOUNDED (every emphasis is 0..1) and only ever ADDED to a
 * priority with a small coefficient, so personalization reorders goals within
 * a horizon but can never bury a safety goal — arrears/health sit in the NOW
 * band, whose priorities this module does not touch. It also never zeroes
 * anything: a goal outside the player's lane is demoted, not deleted, so the
 * catalogue keeps offering ways OUT of a rut (the brief's "do not lock the
 * player into a single playstyle").
 *
 * Stores nothing; same invariant as the rest of `lib/goals` (engine.ts).
 */
import type { GameState } from '@/contexts/game/types';

export interface PlaystyleEmphasis {
  /** Climbing a ladder: has a job, and how far up it they are. */
  career: number;
  /** Founding and running companies. */
  business: number;
  /** Holding financial assets: stocks, crypto, rental property. */
  investor: number;
  /** People: strong relationships, a spouse, children. */
  social: number;
}

const clamp01 = (n: number): number =>
  Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;

/** Market value of stock + crypto holdings — the "chosen to invest" number.
 *  Bank savings are deliberately excluded: cash accumulates by default. */
export function investedValue(state: GameState): number {
  const stockValue = (state.stocks?.holdings ?? []).reduce(
    (sum, h) => sum + Math.max(0, (h?.shares ?? 0) * (h?.currentPrice ?? 0)),
    0,
  );
  const cryptoValue = (state.cryptos ?? []).reduce(
    (sum, c) => sum + Math.max(0, (c?.owned ?? 0) * (c?.price ?? 0)),
    0,
  );
  const total = stockValue + cryptoValue;
  return Number.isFinite(total) ? total : 0;
}

/** Relationships the player has genuinely built (score ≥ 60). */
export function strongRelationshipCount(state: GameState): number {
  return (state.relationships ?? []).filter(
    (r) => r && typeof r.relationshipScore === 'number' && r.relationshipScore >= 60,
  ).length;
}

export function playstyleEmphasis(state: GameState): PlaystyleEmphasis {
  try {
    const currentCareer = (state.careers ?? []).find(
      (c) => c?.id === state.currentJob && c?.accepted,
    );
    const ladderLength = Math.max(1, (currentCareer?.levels?.length ?? 1) - 1);
    const career = currentCareer
      ? clamp01(0.4 + 0.6 * ((currentCareer.level ?? 0) / ladderLength))
      : 0;

    const business = clamp01((state.companies ?? []).length / 3);

    // A knee at the first holding, then scale: choosing to hold ANYTHING is
    // the signal; the dollar amount only deepens it.
    const invested = investedValue(state);
    const rentals = (state.realEstate ?? []).filter((r) => r?.owned !== false).length;
    const investor =
      invested <= 0 && rentals <= 1
        ? 0
        : clamp01(0.3 + 0.5 * Math.min(1, invested / 100_000) + 0.1 * Math.min(2, rentals));

    const strong = strongRelationshipCount(state);
    const social = clamp01(
      strong / 4 + (state.family?.spouse ? 0.25 : 0) + ((state.family?.children ?? []).length > 0 ? 0.15 : 0),
    );

    return { career, business, investor, social };
  } catch {
    return { career: 0, business: 0, investor: 0, social: 0 };
  }
}
