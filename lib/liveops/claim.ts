/**
 * The claim - a PURE reducer, so the one dangerous operation is testable.
 *
 * THIS IS THE FILE THAT COULD COST REAL MONEY IF IT IS WRONG. The single most
 * repeated bug class in this repo is gate-then-grant: checking a claim flag
 * OUTSIDE a `setGameState` updater and mutating inside it, so a double tap in
 * the same React batch passes the gate twice and pays twice (CLAUDE.md 4.4).
 * The shape that prevents it is a pure function of `prev`:
 *
 *   setGameState(prev => {
 *     const result = applyLiveEventClaim(prev, definition, Date.now());
 *     return result.ok ? { ...prev, ...result.patch } : prev;   // reject atomically
 *   });
 *
 * Every gate below reads the state PASSED IN, never a captured value, so the
 * second invocation in a batch sees the ledger the first one wrote and refuses.
 * Returning `prev` unchanged is the rejection.
 *
 * THE FOUR GATES, in the order they run and for the reasons they run in it:
 *  1. CLAIMABLE. Window, eligibility and completion, resolved from `prev`.
 *  2. LEDGER. The instance id is already recorded - the double-tap guard, and
 *     also what a device clock scrubbed back into a claimed window hits.
 *  3. BUDGET. The rolling weekly cap across ALL events. Refused, never scaled:
 *     paying a fraction of an advertised number costs more trust than the gems
 *     are worth, and the event stays claimable until the window clears.
 *  4. GRANT. Currencies moved and the ledger written in ONE patch, so there is
 *     no interleaving in which a payout happens without being recorded.
 */
import type { GameState } from '@/contexts/game/types';
import { bundleValueInGems, fitsBudget } from './rewards';
import { readLiveOpsState, withClaim, withSeen } from './state';
import { instanceId, isClaimable, resolveState } from './schedule';
import { isEligible, type EligibilityContext } from './eligibility';
import { evaluateObjective } from './objectives';
import { MONEY_CEILING } from '@/lib/economy/moneyDelta';
import type { LiveEventDefinition } from './types';

/** Why a claim was refused. Surfaced to the player and to analytics. */
export type ClaimRefusal =
  | 'not_claimable'
  | 'already_claimed'
  | 'budget_exhausted'
  | 'invalid_state';

export type ClaimResult =
  | { ok: true; patch: Partial<GameState>; valueGems: number }
  | { ok: false; reason: ClaimRefusal };

/**
 * Decide and compute a claim against `prev`. PURE - it mutates nothing.
 *
 * Returns a PATCH rather than a whole state, so the caller spreads it onto
 * `prev` inside the updater. Handing back a full state would mean this function
 * had to know about every other field, and any field added later would be
 * silently reverted by a claim.
 */
export function applyLiveEventClaim(
  prev: GameState,
  definition: LiveEventDefinition,
  context: EligibilityContext,
  nowMs: number,
): ClaimResult {
  if (!prev || typeof prev !== 'object') return { ok: false, reason: 'invalid_state' };

  const liveOps = readLiveOpsState(prev);
  const id = instanceId(definition);

  // Gate 2 first as a cheap exact answer, and again implicitly via `resolveState`
  // below. Checking the ledger before doing any objective work also means the
  // common double-tap path costs one array lookup.
  if (liveOps.claimedInstanceIds?.includes(id)) {
    return { ok: false, reason: 'already_claimed' };
  }

  // Gate 1: recompute completion from `prev`. NEVER from a value the caller
  // resolved earlier - that value was computed outside the updater, which is
  // precisely the stale read this whole shape exists to eliminate.
  let readable = 0;
  let met = 0;
  for (const ref of definition.objectives) {
    const progress = evaluateObjective(ref.objectiveId, ref.target, prev);
    if (!progress) continue;
    readable += 1;
    if (progress.met) met += 1;
  }
  const complete = readable > 0 && met === readable;

  const { state } = resolveState({
    definition,
    nowMs,
    complete,
    claimed: false,
    eligible: isEligible(definition, context, liveOps),
  });
  if (!isClaimable(state)) return { ok: false, reason: 'not_claimable' };

  // Gate 3: the rolling weekly budget across every event.
  if (!fitsBudget(definition.rewards, liveOps.budget ?? [], nowMs)) {
    return { ok: false, reason: 'budget_exhausted' };
  }

  // Gate 4: grant. One patch, built from `prev`.
  let gems = prev.stats?.gems ?? 0;
  let money = prev.stats?.money ?? 0;
  let legacyPoints = prev.legacyPoints ?? 0;

  for (const reward of definition.rewards) {
    const amount = Number.isFinite(reward.amount) ? Math.max(0, Math.trunc(reward.amount)) : 0;
    if (amount === 0) continue;
    if (reward.kind === 'gems') gems += amount;
    else if (reward.kind === 'cash') money += amount;
    else if (reward.kind === 'legacyPoints') legacyPoints += amount;
  }

  const valueGems = bundleValueInGems(definition.rewards);

  return {
    ok: true,
    valueGems,
    patch: {
      stats: {
        ...prev.stats,
        gems,
        // The same ceiling every other money path respects. Without it a
        // late-game balance near the ceiling could overflow to Infinity, which
        // `validateGameState` treats as critical and RESETS to 0 on next load -
        // a worse outcome than capping (see MONEY_CEILING).
        money: Math.min(MONEY_CEILING, money),
      },
      legacyPoints,
      liveOps: withClaim(liveOps, id, valueGems, nowMs),
    },
  };
}

/**
 * Record that the player opened an event. PURE.
 *
 * Separate from the claim on purpose: opening is idempotent bookkeeping that
 * runs on a render path, and folding it into the claim updater would put a
 * write on every hub render. It also must never be able to affect a payout,
 * which is easiest to guarantee when it cannot reach the currencies at all.
 */
export function applyLiveEventSeen(
  prev: GameState,
  definition: LiveEventDefinition,
  weeksThisLife: number,
): Partial<GameState> | null {
  if (!prev || typeof prev !== 'object') return null;
  const liveOps = readLiveOpsState(prev);
  const next = withSeen(liveOps, definition.id, instanceId(definition), weeksThisLife);
  // Reference equality means nothing changed, so the caller can return `prev`
  // untouched and skip a re-render for a no-op.
  return next === liveOps ? null : { liveOps: next };
}
