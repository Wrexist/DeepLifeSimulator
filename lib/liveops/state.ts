/**
 * Reading and writing the persisted live-ops state.
 *
 * EVERY READ DEGRADES TO THE EMPTY ANSWER. `liveOps` is an optional field on a
 * save that may have been written by an older build, corrupted, or partially
 * repaired, and it is read on every render of the hub and inside the claim
 * updater. A malformed shape must produce "nothing claimed, nothing seen",
 * never a throw - the alternative is a crash in the middle of the week loop
 * for a field that holds bookkeeping.
 *
 * WHAT IS NOT HERE: PROGRESS. Objectives are recomputed from `GameState` on
 * every read and never stored. That is the `legacyContracts` (v33) reasoning:
 * every objective reads a value the save already tracks, so nothing can drift
 * out of sync, a tick that runs twice cannot double-credit, and an existing
 * save loads with its events already part-complete rather than reset to zero.
 * Only the irreversible facts are persisted - what was claimed, what was seen,
 * and what has been paid inside the rolling budget window.
 */
import type { GameState } from '@/contexts/game/types';
import type { LiveOpsState } from './types';
import { entriesInWindow, type BudgetEntry } from './rewards';

/** The empty state. Frozen so a caller cannot accidentally make it a shared bin. */
const EMPTY: Readonly<LiveOpsState> = Object.freeze({});

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && !!v) : [];

/**
 * Read the live-ops state off a save, normalising anything malformed away.
 *
 * Returns a NEW object every call rather than the save's own, so a caller that
 * mutates what it gets back cannot reach into `GameState` - the "never mutate"
 * rule (CLAUDE.md 4.1) is easy to keep when the shape handed out is already
 * a copy.
 */
export function readLiveOpsState(state: GameState | undefined | null): LiveOpsState {
  const raw = state?.liveOps;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...EMPTY };

  const lastSeenWeek: Record<string, number> = {};
  const rawSeen = (raw as LiveOpsState).lastSeenWeek;
  if (rawSeen && typeof rawSeen === 'object' && !Array.isArray(rawSeen)) {
    for (const [key, value] of Object.entries(rawSeen)) {
      if (typeof value === 'number' && Number.isFinite(value)) lastSeenWeek[key] = value;
    }
  }

  const budget: BudgetEntry[] = [];
  const rawBudget = (raw as LiveOpsState).budget;
  if (Array.isArray(rawBudget)) {
    for (const entry of rawBudget) {
      const at = (entry as { at?: unknown })?.at;
      const value = (entry as { value?: unknown })?.value;
      if (typeof at === 'number' && Number.isFinite(at) && typeof value === 'number' && Number.isFinite(value)) {
        budget.push({ at, value: Math.max(0, value) });
      }
    }
  }

  return {
    claimedInstanceIds: stringArray((raw as LiveOpsState).claimedInstanceIds),
    seenInstanceIds: stringArray((raw as LiveOpsState).seenInstanceIds),
    lastSeenWeek,
    budget,
  };
}

/** Whether an instance has already paid out. The ledger read. */
export function hasClaimed(state: LiveOpsState | undefined, instanceId: string): boolean {
  return !!state?.claimedInstanceIds?.includes(instanceId);
}

/** Whether the player has opened this instance, for the "new" badge. */
export function hasSeen(state: LiveOpsState | undefined, instanceId: string): boolean {
  return !!state?.seenInstanceIds?.includes(instanceId);
}

/**
 * How many ids each list keeps.
 *
 * Bounded because these are written into every save, and a save that grows
 * without limit is the checkpoint problem again (62% of a late-game save before
 * the sidecar). Oldest-first eviction is safe for both: a claim id old enough
 * to fall off is from a window that closed long ago, so nothing can re-enter
 * it, and a forgotten "seen" flag costs one re-shown badge.
 */
export const MAX_TRACKED_IDS = 200;

const trimIds = (ids: string[]): string[] =>
  ids.length > MAX_TRACKED_IDS ? ids.slice(ids.length - MAX_TRACKED_IDS) : ids;

/**
 * Record a claim. PURE - returns the next state, writes nothing.
 *
 * Idempotent: claiming an instance already in the ledger returns the state
 * unchanged, which is what lets the caller detect the no-op and refuse to pay.
 * The budget entry is appended in the same step, so there is no ordering in
 * which a payout is recorded without its cost.
 */
export function withClaim(
  state: LiveOpsState,
  instanceId: string,
  valueInGems: number,
  nowMs: number,
): LiveOpsState {
  const claimed = state.claimedInstanceIds ?? [];
  if (claimed.includes(instanceId)) return state;

  const value = Number.isFinite(valueInGems) ? Math.max(0, valueInGems) : 0;
  const at = Number.isFinite(nowMs) ? nowMs : Date.now();

  return {
    ...state,
    claimedInstanceIds: trimIds([...claimed, instanceId]),
    // Pruned on write, so the list stays a handful of entries rather than
    // growing with the life. Pruning on READ instead would leave the save
    // carrying every payout ever made.
    budget: entriesInWindow([...(state.budget ?? []), { at, value }], at),
  };
}

/** Record that the player opened an instance, and when. PURE. */
export function withSeen(
  state: LiveOpsState,
  eventId: string,
  instanceId: string,
  weeksThisLife: number,
): LiveOpsState {
  const seen = state.seenInstanceIds ?? [];
  const week = Number.isFinite(weeksThisLife) ? Math.max(0, Math.trunc(weeksThisLife)) : 0;
  if (seen.includes(instanceId) && state.lastSeenWeek?.[eventId] === week) return state;

  return {
    ...state,
    seenInstanceIds: seen.includes(instanceId) ? seen : trimIds([...seen, instanceId]),
    lastSeenWeek: { ...(state.lastSeenWeek ?? {}), [eventId]: week },
  };
}
