/**
 * Life Ambitions — types.
 *
 * A Life Ambition is a long-horizon aspiration the player CHOOSES at the start
 * of a life. It is deliberately DISTINCT from the neighbouring onboarding
 * systems:
 *   - Scenarios set starting CONDITIONS (age, cash, items) — the "where you begin".
 *   - Mindsets apply a per-transaction behavioural MODIFIER — an ongoing bonus/penalty.
 *   - Challenges are constrained runs with win-conditions + first-prestige gems.
 *   - Life Chapters are universal, time-gated goal groups everyone progresses through.
 *
 * An Ambition adds none of those. It is a single, themed, multi-stage GOAL for
 * the whole life (3–5 milestones) plus a one-time PAYOFF on fulfilment. It
 * reuses the goals evaluation *pattern* (pure `checkComplete` predicates over
 * GameState, surfaced in a card, granted once) without duplicating any of the
 * above content or mechanics.
 */

import type { GameState } from '@/contexts/game/types';

/** One stage of an ambition's path. Pure predicates over GameState. */
export interface AmbitionMilestone {
  id: string;
  title: string;
  description: string;
  /** True when this milestone's condition is met by the given state. Pure. */
  checkComplete: (state: GameState) => boolean;
  /**
   * Optional 0..1 fractional progress for a partial bar (e.g. wealth ramps).
   * When omitted the UI derives 0 or 1 from `checkComplete`.
   */
  checkProgress?: (state: GameState) => number;
}

/**
 * The one-time reward granted when every milestone is reached. Every field
 * routes through a REAL currency already on GameState — no parallel economy:
 *   - money → stats.money
 *   - gems → stats.gems
 *   - prestigePoints → prestige.prestigePoints (when a prestige record exists)
 */
export interface AmbitionPayoff {
  money?: number;
  gems?: number;
  prestigePoints?: number;
  /** Human label for the fulfilled-ambition trophy/badge. */
  badge?: string;
}

/** A selectable lifelong ambition. */
export interface LifeAmbition {
  id: string;
  name: string;
  /** Emoji icon — keeps the feature asset-free (no new art required). */
  emoji: string;
  /** One-line fantasy shown on the selection card. */
  tagline: string;
  /**
   * A themed, NON-mechanical starting nudge — a direction, not a power pick.
   * Purely informational (shown in UI); it grants no stats.
   */
  hint: string;
  /** Accent colour for the card (hex). */
  color: string;
  /** 3–5 ordered milestones toward the fantasy. */
  milestones: AmbitionMilestone[];
  /** One-time reward granted when every milestone is reached. */
  payoff: AmbitionPayoff;
}

/** A milestone's live evaluation, blended with persisted progress. */
export interface AmbitionMilestoneState {
  id: string;
  title: string;
  description: string;
  /** Reached — either persisted on GameState or currently satisfied. */
  complete: boolean;
  /** 0..1 progress toward the milestone. */
  progress: number;
}

/** The full, UI-ready evaluation of the active ambition. */
export interface AmbitionCompletion {
  ambition: LifeAmbition;
  milestones: AmbitionMilestoneState[];
  reachedCount: number;
  totalCount: number;
  allComplete: boolean;
  /** The one-time payoff has already been granted. */
  alreadyClaimed: boolean;
  /** All milestones reached AND payoff not yet granted. */
  readyToClaim: boolean;
}
