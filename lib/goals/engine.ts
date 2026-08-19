/**
 * The goal engine — "what should I be working toward?"
 *
 * WHY THIS EXISTS. The game has two fixed progression ladders (Life Chapters
 * and Ambitions) and a rotating weekly challenge, but nothing that reads the
 * player's ACTUAL situation and says "here is the next thing worth doing". The
 * one system that tried (`utils/goalSystem.ts`) was deleted after it was shown
 * to be unreachable in every state. This replaces it with a derived
 * recommendation instead of a stored queue.
 *
 * WHY IT STORES NOTHING. A recommendation is a function of state, so persisting
 * it would create a second source of truth that can disagree with the game — and
 * a stored goal needs a claim flag, which is the single most-repeated bug class
 * in this repo (CLAUDE.md §4.4). Nothing here grants, so nothing here can be
 * farmed. No field, no migration, no `repairGameState` mirror, no version bump.
 *
 * DETERMINISM. Selection is a pure max over a fixed catalogue with a stable
 * id tie-break, so the same state always yields the same three goals. It is
 * safe to call during render (CLAUDE.md §35 — no randomness in the UI).
 */
import type { GameState } from '@/contexts/game/types';

import { GOAL_CATALOGUE } from './catalogue';
import type { GoalDefinition, GoalHorizon, GoalRecommendation, RecommendedGoal } from './types';

const HORIZON_ORDER: GoalHorizon[] = ['now', 'soon', 'dream'];

/** 0–1, and never NaN: a zero or negative target would otherwise divide badly. */
function fraction(current: number, target: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, Math.min(1, current / target));
}

function evaluate(def: GoalDefinition, state: GameState): RecommendedGoal | null {
  // A definition throwing must not take the home screen down with it. The
  // catalogue reads deep optional paths on a state that may be partial (cloud
  // download, mid-prestige), and a home-screen crash is the worst possible
  // outcome for a card whose entire job is encouragement.
  try {
    if (!def.isEligible(state)) return null;
    const { current, target } = def.measure(state);
    if (!Number.isFinite(target) || target <= 0) return null;
    const safeCurrent = Number.isFinite(current) ? current : 0;
    return {
      id: def.id,
      horizon: def.horizon,
      title: def.title,
      rationale: def.rationale,
      route: def.route,
      current: safeCurrent,
      target,
      progress: fraction(safeCurrent, target),
      progressLabel: def.format(safeCurrent, target),
    };
  } catch {
    return null;
  }
}

/**
 * The best-scoring eligible goal in one horizon, or null.
 *
 * Score is `priority` plus a small progress term, so a goal the player is
 * genuinely close to finishing edges out an equally-weighted one they have not
 * started. The term is capped at 10 — well under the gaps between priority
 * bands — so it only ever breaks ties and never reorders a deliberate ranking
 * (arrears must stay ahead of a nearly-finished savings rung).
 */
function bestInHorizon(
  state: GameState,
  horizon: GoalHorizon,
  exclude: ReadonlySet<string>,
): RecommendedGoal | null {
  let best: RecommendedGoal | null = null;
  let bestScore = -Infinity;

  for (const def of GOAL_CATALOGUE) {
    if (def.horizon !== horizon) continue;
    if (exclude.has(def.id)) continue;
    const evaluated = evaluate(def, state);
    if (!evaluated) continue;

    let priority = 0;
    try {
      priority = def.priority(state);
    } catch {
      priority = 0;
    }
    if (!Number.isFinite(priority)) priority = 0;

    const score = priority + evaluated.progress * 10;
    // Strict `>` plus a lexicographic id fallback keeps the result stable when
    // two goals score identically — otherwise catalogue order would silently
    // decide it and a reorder would change what players see.
    if (score > bestScore || (score === bestScore && best !== null && def.id < best.id)) {
      bestScore = score;
      best = evaluated;
    }
  }
  return best;
}

/**
 * Up to three goals — one NOW, one SOON, one DREAM — for this exact state.
 *
 * A horizon with nothing eligible is OMITTED rather than padded. A player who
 * has genuinely run out of near-term goals should see two lines, not a
 * make-work third; padding is how a goal card starts feeling like a chore list.
 */
export function recommendGoals(state: GameState | undefined | null): GoalRecommendation {
  if (!state) return [];
  const chosen = new Set<string>();
  const out: RecommendedGoal[] = [];
  for (const horizon of HORIZON_ORDER) {
    const goal = bestInHorizon(state, horizon, chosen);
    if (goal) {
      chosen.add(goal.id);
      out.push(goal);
    }
  }
  return out;
}

/** The single most urgent thing, for surfaces with room for one line. */
export function primaryGoal(state: GameState | undefined | null): RecommendedGoal | null {
  return recommendGoals(state)[0] ?? null;
}
