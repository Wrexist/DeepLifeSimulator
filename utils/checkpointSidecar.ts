/**
 * Checkpoint sidecar — Time Machine checkpoints stored NEXT TO the slot save
 * instead of inside it.
 *
 * WHY (2026-08-26 perf pass): at week 600 the three slimmed checkpoint
 * snapshots measured 291KB of a 469KB save — 62% of every payload — and they
 * change once per game-YEAR while the save is written every week (plus
 * autosaves). Every weekly save was therefore re-stringifying, re-CRC32ing,
 * re-HMAC-signing and re-writing ~52 copies of bytes that had not changed.
 * Moving them to their own key cuts the hot save path (and the load path, and
 * the double-buffer read-back verify) to roughly a third, and writes the
 * checkpoint bytes only when a checkpoint is actually created or consumed.
 *
 * SCOPE — deliberately narrow:
 * - Only the LOCAL SLOT payload (`save_slot_N` via the save queue) is
 *   stripped. The in-memory GameState keeps `checkpoints` exactly as before,
 *   so the weekly tick, the Time Machine UI and rewind are untouched.
 * - Backups (`createBackupFromState`) and cloud sync serialize the in-memory
 *   state, so they remain SELF-CONTAINED with checkpoints inline. A backup or
 *   cloud restore needs no sidecar.
 * - Old saves with inline `checkpoints` keep working forever: the load path
 *   only consults the sidecar when the parsed save has NO `checkpoints` key,
 *   and inline always wins.
 *
 * NO STATE_VERSION BUMP, on purpose. `checkpoints` has been optional on
 * GameState for its whole life and every reader defaults an absent key
 * (`?? []`), so a payload without the key is legal under every version back
 * to v10 — this changes WHERE the field is persisted, not the shape any
 * reader must handle. A bump would buy nothing on load (inline checkpoints
 * are honored as-is, so there is nothing to transform) and would cost real
 * behavior: every TestFlight downgrade would hit the "save is from a newer
 * app version" refusal for a payload the old app could in fact read
 * perfectly. The v38 story-mode note in CLAUDE.md documents the same trade.
 *
 * INTEGRITY: the sidecar is written through the same signed envelope as a
 * save (CRC32 + HMAC-SHA256). Without that it would be a state-injection
 * vector — craft a snapshot, relaunch, pay 500 gems, and rewind turns the
 * forgery into live state. Anything that fails verification is treated as
 * ABSENT, never as an error: checkpoints are a convenience rewind target, and
 * a load must not fail because of them.
 *
 * WRONG-LIFE GUARD: the sidecar is paired with its slot's save only by key
 * name. If the slot is overwritten (new game / prestige) and the sidecar
 * write that accompanies the first save of the new life is lost (crash or
 * quota failure between the two writes), a later load could see the OLD
 * life's checkpoints. `filterCheckpointsForState` therefore drops, at attach
 * time, any checkpoint that cannot belong to the loaded save: a different
 * `lifeStartWeek` inside the snapshot, or a `weeksLived` beyond the save's
 * own. The first successful save of a session always rewrites the sidecar
 * (see the session cache below), which also self-heals that state.
 */
import type { GameState } from '@/contexts/game/types';
import { safeSetItem, safeGetItem, safeRemoveItem } from '@/utils/safeStorage';
import { logger } from '@/utils/logger';

type Checkpoints = NonNullable<GameState['checkpoints']>;

const log = logger.scope('CheckpointSidecar');

/**
 * Storage key for a slot's sidecar. Deliberately NOT under the `save_slot_`
 * prefix: the double-buffer machinery owns `save_slot_N{,_A,_B,_active}`, the
 * orphan sweep matches `^save_slot_\d+_temp_`, and quota cleanup sweeps
 * `cloud_save_slot_*` / `*_cache*` — this name matches none of them.
 * `deleteSaveSlot` (utils/saveValidation.ts) removes this key by its literal
 * shape; `checkpointSidecarKeyParity.test` pins the two in step.
 */
export const checkpointSidecarKey = (slot: number): string =>
  `checkpoint_sidecar_slot_${slot}`;

/**
 * Fingerprint of a checkpoints array: the ids, which are minted per creation
 * (`cp_<week>_<Date.now()>`) and never edited in place. Cheap enough to run
 * on every save; any add/remove/replace changes it.
 */
function fingerprint(checkpoints: Checkpoints | undefined): string {
  if (!Array.isArray(checkpoints) || checkpoints.length === 0) return 'empty';
  try {
    return checkpoints.map((cp) => String(cp?.id ?? '?')).join('|');
  } catch {
    return `unfingerprintable_${Date.now()}`;
  }
}

/**
 * What this session last wrote per slot. Starts empty, so the FIRST save of
 * every session always writes the sidecar — that is what reconciles it after
 * a new-game/prestige overwrite of the slot, and after any earlier lost write.
 */
const sessionWritten = new Map<number, string>();

/** Test hook: forget what this session wrote (simulates an app relaunch). */
export function resetCheckpointSidecarSessionCache(): void {
  sessionWritten.clear();
}

/**
 * Persist the sidecar for `slot` if it changed since this session last wrote
 * it (or unconditionally on the session's first save to the slot). Never
 * throws — checkpoint persistence must not fail a save.
 */
export async function persistCheckpointSidecar(
  slot: number,
  // `unknown` because the save queue's state payloads are untyped (`any` data
  // through `embedProtectedState`); everything below narrows via Array.isArray.
  checkpointsInput: unknown
): Promise<void> {
  try {
    const checkpoints = Array.isArray(checkpointsInput)
      ? (checkpointsInput as Checkpoints)
      : undefined;
    const fp = fingerprint(checkpoints);
    if (sessionWritten.get(slot) === fp) return;

    // Same envelope as a save: CRC32 + HMAC. An unsigned sidecar would be a
    // state-injection vector through rewind (the F-11 persisted-queue lesson).
    const { createSaveEnvelope } = await import('@/utils/saveValidation');
    const payload = JSON.stringify(Array.isArray(checkpoints) ? checkpoints : []);
    const ok = await safeSetItem(checkpointSidecarKey(slot), createSaveEnvelope(payload));
    if (ok) {
      sessionWritten.set(slot, fp);
    } else {
      log.warn(`Sidecar write failed for slot ${slot} (will retry on next save)`);
    }
  } catch (error) {
    // Includes createSaveEnvelope throwing on an unsigned-capable build:
    // refuse to store an unverifiable sidecar, keep the save itself intact.
    log.warn(`Sidecar persist error for slot ${slot} (non-critical):`, { error });
  }
}

/**
 * Read and verify a slot's sidecar. Returns null when absent, unverifiable,
 * or malformed — all three mean "no checkpoints", never an error.
 */
export async function readCheckpointSidecar(slot: number): Promise<Checkpoints | null> {
  try {
    const raw = await safeGetItem(checkpointSidecarKey(slot));
    if (!raw) return null;
    const { decodePersistedSaveEnvelope } = await import('@/utils/saveValidation');
    // Strict: sidecars are only ever written by this module, always as signed
    // v2 envelopes — there is no legacy sidecar format to allow.
    const decoded = decodePersistedSaveEnvelope(raw, { allowLegacy: false });
    if (!decoded.valid || typeof decoded.data !== 'string') {
      log.warn(`Sidecar for slot ${slot} failed verification - ignoring it`);
      return null;
    }
    const parsed = JSON.parse(decoded.data);
    if (!Array.isArray(parsed)) return null;
    return parsed as Checkpoints;
  } catch (error) {
    log.warn(`Sidecar read error for slot ${slot} (treated as absent):`, { error });
    return null;
  }
}

/** Remove a slot's sidecar (slot deletion / cleanup). Never throws. */
export async function removeCheckpointSidecar(slot: number): Promise<void> {
  try {
    await safeRemoveItem(checkpointSidecarKey(slot));
    sessionWritten.delete(slot);
  } catch {
    // Best-effort; an orphaned sidecar is inert (verified before use, and
    // filtered against the loaded save's identity before attach).
  }
}

/**
 * Drop checkpoints that cannot belong to the save they are being attached to
 * (see WRONG-LIFE GUARD above):
 * - `weeksLived` beyond the save's own — a checkpoint "from the future" can
 *   only come from a different life or a rolled-back slot, and attaching one
 *   would make rewind a free fast-forward.
 * - a snapshot whose `lifeStartWeek` differs from the save's — a different
 *   life outright. Legacy string snapshots (pre-slimming saves) and pre-v43
 *   saves without `lifeStartWeek` skip this half of the check rather than be
 *   dropped: both sides undefined compares equal.
 */
export function filterCheckpointsForState(
  checkpoints: Checkpoints,
  state: { weeksLived?: number; lifeStartWeek?: number }
): Checkpoints {
  const stateWeeks = typeof state.weeksLived === 'number' ? state.weeksLived : undefined;
  return checkpoints.filter((cp) => {
    if (!cp || typeof cp !== 'object') return false;
    if (
      stateWeeks !== undefined &&
      typeof cp.weeksLived === 'number' &&
      cp.weeksLived > stateWeeks
    ) {
      return false;
    }
    const snapshot = cp.snapshot;
    if (snapshot && typeof snapshot === 'object') {
      const snapLife = (snapshot as { lifeStartWeek?: number }).lifeStartWeek;
      if (snapLife !== state.lifeStartWeek) return false;
    }
    return true;
  });
}
