/**
 * Writing a face back into the save.
 *
 * The identity chapter had no in-game write path at all: a face was built once
 * during onboarding by `gameStateBuilder` and then frozen for the rest of the
 * run. There was no way to change it, and no way to refresh the baked portrait
 * as the character aged — `portraitWeek` was written and read by nothing.
 *
 * The state change is a pure function so both callers can share it and neither
 * has to know the shape: the creator re-opened from the character card, and the
 * automatic re-bake that keeps the portrait the character's current age.
 */

import type { GameState } from '../types';
import { normalizeIdentity, type FaceGenome } from '@/lib/identity';
import { MAX_PORTRAIT_BYTES } from '@/lib/identity';

/**
 * How stale a baked portrait may get before it is re-rendered, in weeks.
 *
 * Two years. Short enough that a portrait never lags the character by a visible
 * generation, long enough that the re-bake is a rare event rather than something
 * the player's battery notices — it costs one GL context and one frame.
 *
 * The alternative considered and rejected was re-baking on every birthday: the
 * face barely changes in a year, and `applyAging` is continuous, so it would
 * have been fifty renders across a run to show what two years shows once.
 */
export const PORTRAIT_MAX_AGE_WEEKS = 104;

/**
 * True when a built portrait exists and no longer matches the character's age.
 *
 * Returns false when there is NO built portrait: the starter-portrait pool ages
 * on its own by picking a different image per age band, so a character without a
 * built face has nothing to re-bake and must not be given a GL context for it.
 */
export function isPortraitStale(
  identity: GameState['identity'] | undefined,
  weeksLived: number,
): boolean {
  const uri = identity?.portraitUri;
  if (typeof uri !== 'string' || !uri.startsWith('data:image')) return false;
  const baked = identity?.portraitWeek;
  // A portrait with no bake week is from a build that did not record one. Treat
  // it as stale rather than as fresh: unknown age is exactly the case this
  // exists to correct, and one re-bake makes it known forever after.
  if (typeof baked !== 'number' || !isFinite(baked)) return true;
  // `weeksLived` is the absolute counter — never `week`, which cycles 1-4.
  return weeksLived - baked >= PORTRAIT_MAX_AGE_WEEKS;
}

/**
 * Apply a face edit to the save.
 *
 * `portraitUri` of `null` means "the capture failed" — GL unavailable, snapshot
 * unusable, over the size cap. That must not wipe a portrait the player already
 * has: a blank circle is worse than a slightly stale face, and worse still than
 * the stock portrait it would otherwise fall back to. So a failed capture keeps
 * whatever was there, and only the genome changes.
 *
 * Pure, and returns `prev` unchanged when nothing would change, so a caller can
 * hand it straight to `setGameState` without a second affordability-style check
 * outside the updater — the gate-then-grant shape this codebase keeps re-learning.
 */
export function applyFaceEdit(
  prev: GameState,
  genome: FaceGenome,
  portraitUri: string | null,
  weeksLived: number,
): GameState {
  // Normalised on the way in, not on the way out. This is a write path into the
  // save, and `normalizeIdentity` is the one function that decides what a valid
  // identity is — going around it here is how the three call sites drift apart.
  const identity = normalizeIdentity(prev.identity);
  const next = { ...identity, face: genome };

  if (typeof portraitUri === 'string' && portraitUri.startsWith('data:image')) {
    // The same bound `normalizeIdentity` and the capture apply. Re-checked here
    // because this is the third door into the field and the failure it prevents
    // — a save that can never be written again — is unrecoverable.
    if (portraitUri.length <= MAX_PORTRAIT_BYTES) {
      next.portraitUri = portraitUri;
      next.portraitWeek = weeksLived;
    }
  }

  return { ...prev, identity: next };
}
