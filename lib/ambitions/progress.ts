/**
 * Life Ambitions — pure progress + payout helpers.
 *
 * No React, no context, no side effects. The in-game `AmbitionCard` and the
 * unit tests both drive these, so behaviour (including one-time-payoff
 * idempotency) is verified without a running app.
 */

import type { GameState } from '@/contexts/game/types';
import { LIFE_AMBITIONS } from './catalog';
import type { AmbitionCompletion, AmbitionMilestoneState, LifeAmbition } from './types';

/** JS Number safe cap — mirrors MONEY_CEILING used elsewhere. */
const CEILING = Number.MAX_SAFE_INTEGER;

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

const safeBool = (fn: () => boolean): boolean => {
  try {
    return !!fn();
  } catch {
    return false;
  }
};

const safeNum = (fn: () => number): number => {
  try {
    const v = fn();
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
};

/** Look up an ambition by id. Returns undefined for absent/unknown ids. */
export function getAmbitionById(id: string | undefined | null): LifeAmbition | undefined {
  if (!id) return undefined;
  return LIFE_AMBITIONS.find((a) => a.id === id);
}

/**
 * The set of milestone ids currently considered reached for `state`:
 * anything already persisted in `ambitionCompletedMilestones` UNION anything
 * whose predicate is satisfied right now. Milestones are "sticky" — once
 * reached they stay reached even if the underlying stat later dips.
 */
export function reconcileReachedMilestones(state: GameState): string[] {
  const ambition = getAmbitionById(state.ambitionId);
  if (!ambition) return [];
  const valid = new Set(ambition.milestones.map((m) => m.id));
  const reached = new Set<string>(
    // Drop any stale ids that no longer belong to the chosen ambition.
    (state.ambitionCompletedMilestones ?? []).filter((id) => valid.has(id))
  );
  for (const m of ambition.milestones) {
    if (safeBool(() => m.checkComplete(state))) reached.add(m.id);
  }
  // Return in catalogue order for stable, comparable output.
  return ambition.milestones.filter((m) => reached.has(m.id)).map((m) => m.id);
}

/**
 * Full UI-ready evaluation of the active ambition, or null when the life has
 * no chosen ambition (old saves and freeform lives — perfectly valid).
 */
export function getAmbitionCompletion(state: GameState): AmbitionCompletion | null {
  const ambition = getAmbitionById(state.ambitionId);
  if (!ambition) return null;

  const persisted = new Set(state.ambitionCompletedMilestones ?? []);
  const milestones: AmbitionMilestoneState[] = ambition.milestones.map((m) => {
    const complete = persisted.has(m.id) || safeBool(() => m.checkComplete(state));
    const progress = complete
      ? 1
      : clamp01(m.checkProgress ? safeNum(() => m.checkProgress!(state)) : 0);
    return { id: m.id, title: m.title, description: m.description, complete, progress };
  });

  const reachedCount = milestones.filter((m) => m.complete).length;
  const totalCount = ambition.milestones.length;
  const allComplete = totalCount > 0 && reachedCount >= totalCount;
  // Claimed if EITHER the per-life flag is set OR this ambitionId was already
  // paid out in a PREVIOUS life (cross-life stamp preserved through prestige).
  // The per-life flag resets on prestige, so the cross-life set is what stops
  // the same ambition being re-fulfilled for gems/prestige points every cycle.
  const claimedCrossLife = (state.prestige?.claimedAmbitions ?? []).includes(ambition.id);
  const alreadyClaimed = !!state.ambitionRewardClaimed || claimedCrossLife;

  return {
    ambition,
    milestones,
    reachedCount,
    totalCount,
    allComplete,
    alreadyClaimed,
    readyToClaim: allComplete && !alreadyClaimed,
  };
}

const sameIds = (a: string[], b: string[] | undefined): boolean => {
  const bb = b ?? [];
  if (a.length !== bb.length) return false;
  const setB = new Set(bb);
  return a.every((id) => setB.has(id));
};

/**
 * Persist newly-reached milestones onto the state WITHOUT granting the payoff.
 * Returns the same reference when nothing changed (safe for setState identity
 * checks). This is what locks staged progress in as the life plays out.
 */
export function reconcileAmbitionProgress(state: GameState): GameState {
  if (!getAmbitionById(state.ambitionId)) return state;
  const reached = reconcileReachedMilestones(state);
  if (sameIds(reached, state.ambitionCompletedMilestones)) return state;
  return { ...state, ambitionCompletedMilestones: reached };
}

/**
 * Grant the ambition's one-time payoff if (and only if) every milestone is
 * reached and it has not already been granted. Pure and IDEMPOTENT — calling
 * it repeatedly grants the reward at most once. Rewards route through the real
 * currency fields (stats.money, stats.gems, prestige.prestigePoints).
 *
 * When the ambition is not yet complete this still folds in any freshly-reached
 * milestones (progress persistence) but grants nothing.
 */
export function grantAmbitionPayout(state: GameState): GameState {
  const completion = getAmbitionCompletion(state);
  if (!completion) return state;

  // Not ready (or already claimed): only persist staged progress, never pay out.
  if (!completion.readyToClaim) {
    return reconcileAmbitionProgress(state);
  }

  const { payoff } = completion.ambition;
  const reached = reconcileReachedMilestones(state);

  const baseStats = state.stats ?? ({} as GameState['stats']);
  const nextStats = {
    ...baseStats,
    money: Math.min(CEILING, (baseStats.money ?? 0) + (payoff.money ?? 0)),
    gems: Math.min(CEILING, (baseStats.gems ?? 0) + (payoff.gems ?? 0)),
  };

  // Prestige points only when a prestige record exists (fresh lives always have
  // one; ultra-legacy/partial states without it simply skip the PP portion).
  // Also stamp the ambitionId into the cross-life `claimedAmbitions` set so this
  // payoff (gems + prestige points, both preserved through prestige) can never be
  // granted again in a future life. `getAmbitionCompletion` reads this set, so a
  // stamped ambition reports `alreadyClaimed` and never returns to `readyToClaim`.
  let nextPrestige = state.prestige;
  const pp = payoff.prestigePoints ?? 0;
  if (nextPrestige) {
    const priorClaimed = nextPrestige.claimedAmbitions ?? [];
    nextPrestige = {
      ...nextPrestige,
      prestigePoints:
        pp > 0
          ? Math.min(CEILING, (nextPrestige.prestigePoints ?? 0) + pp)
          : nextPrestige.prestigePoints ?? 0,
      claimedAmbitions: priorClaimed.includes(completion.ambition.id)
        ? priorClaimed
        : [...priorClaimed, completion.ambition.id],
    };
  }

  return {
    ...state,
    stats: nextStats,
    prestige: nextPrestige,
    ambitionCompletedMilestones: reached,
    ambitionRewardClaimed: true,
  };
}
