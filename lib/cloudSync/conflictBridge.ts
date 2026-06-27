/**
 * Cloud-sync conflict bridge.
 *
 * Decouples the conflict *UI* (CloudSyncConflictModal, mounted in the render
 * tree) from the conflict *resolution logic* (GameActionsContext, which owns
 * setGameState + the migrate/repair/validate pipeline). The sync layer asks for
 * a decision via `requestConflictResolution()` and awaits the user's choice; the
 * modal renders the pending conflict and reports the choice via
 * `resolvePendingConflict()`.
 *
 * Kept as a tiny external store (no Context, no provider) so it can be consumed
 * with `useSyncExternalStore` from a single mounted modal without widening any
 * game-state subscription.
 */
import type { GameState } from '@/contexts/game/types';
import type { SyncConflict, ConflictResolution } from '@/services/CloudSyncService';

export type PendingConflict = SyncConflict & {
  remoteState: GameState;
  localState: GameState;
};

let pending: PendingConflict | null = null;
let resolver: ((resolution: ConflictResolution | null) => void) | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * Ask the user to resolve a conflict. Resolves with their choice, or `null` if
 * the prompt is dismissed/superseded (callers treat `null` as "keep local" —
 * the safe, non-destructive default, since the next save re-pushes local).
 */
export function requestConflictResolution(
  conflict: PendingConflict
): Promise<ConflictResolution | null> {
  // If a prompt is already open, supersede it (resolve the old promise as null)
  // so we never leak a dangling resolver.
  if (resolver) {
    const stale = resolver;
    resolver = null;
    stale(null);
  }
  pending = conflict;
  emit();
  return new Promise((resolve) => {
    resolver = resolve;
  });
}

/** Report the user's decision (or `null` to dismiss). Idempotent / safe to call once. */
export function resolvePendingConflict(resolution: ConflictResolution | null): void {
  const r = resolver;
  resolver = null;
  pending = null;
  emit();
  r?.(resolution);
}

export function getPendingConflict(): PendingConflict | null {
  return pending;
}

export function subscribePendingConflict(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
