/**
 * `GameState.dynasty` — the one field the four prestige-tier systems share.
 *
 * ## Why one field and not four
 *
 * Tiers 2–5 each needed a small amount of persisted bookkeeping: which luxury
 * pieces are in the Vault, which Endowment tranches have been taken, which
 * Trials are pending/active, which Seat wings are built. Four top-level keys
 * would have been four migrations' worth of surface for one feature set, and
 * four places for a partial save to be half-present.
 *
 * One optional object, default `undefined`, is a documented CARVE-OUT
 * (CLAUDE.md §7): STATE_VERSION bumped, NO backfill and NO `repairGameState`
 * mirror. An absent `dynasty` already means exactly the right thing for every
 * existing save — empty vault, nothing endowed, no trial running, no wings —
 * and writing an empty object onto every save would churn every slot for no
 * behavioural gain.
 *
 * Every read below goes through these accessors so an absent key, a `null`, or
 * a save hand-edited into a wrong shape all degrade to the empty answer instead
 * of throwing inside the week loop.
 */
import type { DynastyState, GameState } from '@/contexts/game/types';

const ids = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];

export function readDynasty(state: GameState | undefined | null): DynastyState {
  const d = state?.dynasty;
  return d && typeof d === 'object' ? d : {};
}

/** Luxury catalog ids currently preserved in the Vault (tier 2). */
export function vaultItemIds(state: GameState | undefined | null): string[] {
  return ids(readDynasty(state).vaultItemIds);
}

/** Endowment tranche ids already taken — once per id, forever (tier 3). */
export function endowmentIds(state: GameState | undefined | null): string[] {
  return ids(readDynasty(state).endowments);
}

/** Trials chosen for the NEXT life but not yet started (tier 4). */
export function pendingTrialIds(state: GameState | undefined | null): string[] {
  return ids(readDynasty(state).trials?.pending);
}

/** Trials the CURRENT life is being lived under (tier 4). */
export function activeTrialIds(state: GameState | undefined | null): string[] {
  return ids(readDynasty(state).trials?.active);
}

/** Seat wings built (tier 5). Permanent — they are never lost. */
export function seatWingIds(state: GameState | undefined | null): string[] {
  return ids(readDynasty(state).seatWings);
}

/**
 * A new `dynasty` value with `patch` merged over the current one.
 *
 * Returns a fresh object every time — the callers are all `setGameState`
 * updaters, and mutating `prev.dynasty` in place would be the mutation §4.1
 * forbids.
 */
export function withDynasty(
  state: GameState | undefined | null,
  patch: Partial<DynastyState>
): DynastyState {
  return { ...readDynasty(state), ...patch };
}
