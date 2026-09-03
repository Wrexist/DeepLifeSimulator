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
 * DETERMINISM. Selection is a pure function of the state: an urgency max for
 * NOW, and for SOON / DREAM a max that rotates through the eligible set on an
 * eight-week window derived from `weeksLived` (see `GOAL_SPOTLIGHT_WEEKS`), so
 * the same state always yields the same three goals. It is safe to call during
 * render (CLAUDE.md §35 — no randomness in the UI).
 */
import type { GameState } from '@/contexts/game/types';
import { weeksInThisLife } from '@/lib/progress/lifeChapters';

import { GOAL_CATALOGUE } from './catalogue';
import type {
  AchievedGoal,
  GoalDefinition,
  GoalHorizon,
  GoalRecommendation,
  RecommendedGoal,
} from './types';

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
  const ranked = rankHorizon(state, horizon, exclude);
  if (ranked.length === 0) return null;
  if (horizon === 'now') return ranked[0].goal;
  return spotlight(state, ranked);
}

/** Every eligible goal in a horizon, best score first, stable on ties by id. */
function rankHorizon(
  state: GameState,
  horizon: GoalHorizon,
  exclude: ReadonlySet<string>,
): { goal: RecommendedGoal; score: number }[] {
  const out: { goal: RecommendedGoal; score: number }[] = [];
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

    out.push({ goal: evaluated, score: priority + evaluated.progress * 10 });
  }
  // Strict score order plus a lexicographic id fallback keeps the result
  // stable when two goals score identically — otherwise catalogue order would
  // silently decide it and a reorder would change what players see.
  out.sort((a, b) => (b.score - a.score) || (a.goal.id < b.goal.id ? -1 : a.goal.id > b.goal.id ? 1 : 0));
  return out;
}

/**
 * Weeks a SOON / DREAM goal holds the spotlight before the next eligible one
 * takes a turn (Master Program 9).
 *
 * Measured on the persona simulator: the recommendation read "Earn your next
 * promotion / Reach a fortune" from week 6 to week 100 - identical for 90
 * weeks - while "Find someone", "Buy your first property" and "Raise a
 * family" were eligible the whole time and never shown, because the pure max
 * picks the same winner every week. A goal card that never changes stops
 * being read. Rotating through the eligible set on an eight-week cadence
 * shows every next possibility in turn, from existing content, with no state
 * (the window is derived from `weeksLived`, so it is deterministic and
 * reload-safe). The NOW horizon never rotates: it is an urgency ranking
 * (arrears before savings, health before both).
 */
export const GOAL_SPOTLIGHT_WEEKS = 8;

/**
 * Progress at or above which the best goal keeps the spotlight instead of
 * rotating away - a promotion at 80% is anticipation, not staleness.
 */
export const GOAL_SPOTLIGHT_HOLD_PROGRESS = 0.6;

function spotlight(
  state: GameState,
  ranked: { goal: RecommendedGoal; score: number }[],
): RecommendedGoal {
  const best = ranked[0].goal;
  if (ranked.length === 1 || best.progress >= GOAL_SPOTLIGHT_HOLD_PROGRESS) return best;
  const weeks = weeksInThisLife(state);
  const window = Math.floor(Math.max(0, weeks) / GOAL_SPOTLIGHT_WEEKS);
  return ranked[window % ranked.length].goal;
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

/**
 * Goals the player ADVANCED between two states.
 *
 * A goal is reached when its `achievementLevel` increases — rungs passed,
 * properties owned, career level, children. Comparing two states rather than
 * tracking a stored "done" flag is what keeps this free of claim state: there
 * is nothing to persist, so there is nothing to double-claim, and the same
 * transition observed twice yields the same answer rather than paying twice
 * (CLAUDE.md §4.4). It is also why this needs no `STATE_VERSION` bump.
 *
 * A DECREASE is never an achievement. Selling a property, losing a job or
 * spending back below a savings rung lowers the level, and lowering it must not
 * congratulate anyone — nor should it re-arm the acknowledgement, which is why
 * the comparison is strictly `>` on levels and not on equality.
 *
 * Goals with no `achievementLevel` are never reported, which is the right
 * default for anything whose completion is ambiguous.
 */
export function goalsAchievedBetween(
  previous: GameState | undefined | null,
  next: GameState | undefined | null,
): AchievedGoal[] {
  if (!previous || !next) return [];
  const out: AchievedGoal[] = [];

  for (const def of GOAL_CATALOGUE) {
    if (!def.achievementLevel) continue;
    try {
      const before = def.achievementLevel(previous);
      const after = def.achievementLevel(next);
      if (!Number.isFinite(before) || !Number.isFinite(after)) continue;
      if (after <= before) continue;
      out.push({ id: def.id, horizon: def.horizon, title: def.title, level: after });
    } catch {
      // One malformed goal must not swallow the rest of the list.
    }
  }

  // Catalogue order, which is already now → soon → dream, so the most immediate
  // acknowledgement leads. Deterministic, like every other output here.
  return out;
}
