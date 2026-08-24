/**
 * Per-slot save METADATA cache.
 *
 * The pre-game screens (MainMenu "Continue" card, SaveSlots list) only need a
 * tiny summary of each save — character name, age, money, weeks lived — to
 * render. Deriving that the old way meant HMAC-decoding and `JSON.parse`-ing the
 * ENTIRE multi-megabyte save blob on the JS thread on every screen visit, which
 * blocked first paint for seconds on older devices (the menu section rendered
 * invisible until the parse finished because the entrance animations couldn't
 * start).
 *
 * This module stores a small JSON summary next to each slot (`save_slot_meta_N`)
 * that the save pipeline keeps fresh on every write. Reading it is effectively
 * free, so the menu paints instantly. The expensive full decode+parse only ever
 * runs ONCE per slot, inside `ensureSaveSlotMeta`'s one-time legacy backfill (for
 * saves written before this cache existed), and that backfill is deliberately
 * scheduled off the first-paint path by its callers.
 */

import { safeGetItem, safeSetItem, safeRemoveItem } from '@/utils/safeStorage';
// Raw (non-swallowing) storage access for the existence probe below — unlike
// safeStorage/readSaveSlot, lazyAsyncStorage propagates thrown storage errors,
// which the probe must observe to report 'unknown' instead of 'empty'.
import { lazyAsyncStorage } from '@/utils/storageWrapper';
import { logger } from '@/utils/logger';
// saveSlotHelpers has NO static imports (it only lazily imports saveValidation
// inside its async functions), so reusing its shape guards here can't create a
// require cycle back into this module or the save pipeline.
import { hasSaveStateShape, hasMeaningfulSaveData } from '@/src/features/onboarding/saveSlotHelpers';

const log = logger.scope('SaveSlotMeta');

export interface SaveSlotMeta {
  name: string;
  age: number;
  money: number;
  /** Weeks lived — rendered by the SaveSlots card, so it lives on the meta too. */
  weeksLived: number;
  updatedAt: number;
}

/** Storage key for a slot's cached summary. */
export const saveSlotMetaKey = (slot: number): string => `save_slot_meta_${slot}`;

/** Money-style clamp: finite & non-negative, otherwise 0 (mirrors the raw-JSON
 *  clamping MainMenu/SaveSlots already apply, since no repair pass has run). */
const clampAmount = (n: unknown): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0;

/** Count-style clamp: floored, finite & non-negative (age / weeks). */
const clampCount = (n: unknown): number => Math.floor(clampAmount(n));

/**
 * Derive a compact summary from a parsed game-state object. Returns null when
 * the object isn't a real, meaningful save (so callers never cache or display a
 * placeholder). Defensive throughout - the input is raw persisted JSON.
 */
export function extractSaveSlotMeta(data: unknown): SaveSlotMeta | null {
  if (!hasSaveStateShape(data) || !hasMeaningfulSaveData(data)) {
    return null;
  }

  // hasSaveStateShape narrows to the snapshot shape; widen locally for the two
  // extra fields (weeksLived, updatedAt) that the summary also reads.
  const snap = data as {
    userProfile?: { firstName?: string; lastName?: string };
    date?: { age?: number };
    stats?: { money?: number };
    weeksLived?: number;
    updatedAt?: number;
  };

  const name = `${snap.userProfile?.firstName || ''} ${snap.userProfile?.lastName || ''}`.trim();
  const updatedAt =
    typeof snap.updatedAt === 'number' && Number.isFinite(snap.updatedAt) ? snap.updatedAt : Date.now();

  return {
    name,
    age: clampCount(snap.date?.age),
    money: clampAmount(snap.stats?.money),
    weeksLived: clampCount(snap.weeksLived),
    updatedAt,
  };
}

/** Persist a slot's summary. `null` clears any stale entry. Never throws. */
export async function writeSaveSlotMeta(slot: number, meta: SaveSlotMeta | null): Promise<void> {
  try {
    if (!meta) {
      await safeRemoveItem(saveSlotMetaKey(slot));
      return;
    }
    await safeSetItem(saveSlotMetaKey(slot), JSON.stringify(meta));
  } catch (error) {
    log.warn('Failed to write save slot meta (non-critical)', {
      slot,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Read a slot's cached summary. Malformed / missing → null. Never throws. */
export async function readSaveSlotMeta(slot: number): Promise<SaveSlotMeta | null> {
  try {
    const raw = await safeGetItem(saveSlotMetaKey(slot));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SaveSlotMeta> | null;
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      age: clampCount(parsed.age),
      money: clampAmount(parsed.money),
      weeksLived: clampCount(parsed.weeksLived),
      updatedAt:
        typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : 0,
    };
  } catch {
    // Malformed JSON - treat as absent.
    return null;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Per-slot backfill guards. `backfillInFlight` dedupes concurrent cold-path
// decodes (both pre-game screens can miss the cache for the same slot at once);
// `slotDeletionGen` makes deletion win over an in-flight backfill - a delete
// that lands between the blob read and the meta write bumps the generation, so
// the late write is skipped instead of resurrecting metadata for a deleted or
// just-overwritten blob.
// ───────────────────────────────────────────────────────────────────────────
const backfillInFlight = new Map<number, Promise<SaveSlotMeta | null>>();
const slotDeletionGen = new Map<number, number>();

/** Remove a slot's cached summary. Never throws. */
export async function deleteSaveSlotMeta(slot: number): Promise<void> {
  // Bump FIRST so any in-flight backfill for this slot discards its result.
  slotDeletionGen.set(slot, (slotDeletionGen.get(slot) ?? 0) + 1);
  try {
    await safeRemoveItem(saveSlotMetaKey(slot));
  } catch (error) {
    log.warn('Failed to delete save slot meta (non-critical)', {
      slot,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Result of probing a slot's raw blob without decoding it. */
export type SlotBlobProbe = 'exists' | 'empty' | 'unknown';

/** Raw existence probe: does a persisted blob exist for this slot at all? Reads
 *  the three raw slot keys (double-buffer A/B + legacy) directly - no envelope
 *  decode, no HMAC verification, no JSON.parse - so it is genuinely cheap even
 *  for multi-MB saves. A thrown storage read reports 'unknown' rather than
 *  'empty' (readSaveSlot can't be used here: it swallows storage errors into
 *  null, which would make a transient failure indistinguishable from a truly
 *  empty slot). Callers must never treat 'unknown' as safely overwritable.
 *  Never throws. */
export async function probeSaveSlotBlob(slot: number): Promise<SlotBlobProbe> {
  try {
    const key = `save_slot_${slot}`;
    const [bufferA, bufferB, legacy] = await Promise.all([
      lazyAsyncStorage.getItem(`${key}_A`),
      lazyAsyncStorage.getItem(`${key}_B`),
      lazyAsyncStorage.getItem(key),
    ]);
    return bufferA != null || bufferB != null || legacy != null ? 'exists' : 'empty';
  } catch {
    return 'unknown';
  }
}

/**
 * Return a slot's cached summary, backfilling it ONCE from the legacy full save
 * blob if the cache is empty (saves written before this cache existed). The
 * heavy decode + `JSON.parse` only happens on this cold path; once written, all
 * future reads go through `readSaveSlotMeta`. Concurrent callers for the same
 * slot share one in-flight backfill, and a slot deletion during the backfill
 * wins (the late meta write is skipped). Returns null for an absent or
 * unreadable / non-meaningful blob. Never throws.
 */
export async function ensureSaveSlotMeta(slot: number): Promise<SaveSlotMeta | null> {
  const inFlight = backfillInFlight.get(slot);
  if (inFlight) return inFlight;

  const task = (async (): Promise<SaveSlotMeta | null> => {
    try {
      const existing = await readSaveSlotMeta(slot);
      if (existing) return existing;

      // Capture the deletion generation BEFORE touching the blob; compare again
      // before writing so a delete that raced the decode can't be resurrected.
      const gen = slotDeletionGen.get(slot) ?? 0;

      // One-time backfill: decode + parse the legacy blob exactly the way the
      // onboarding screens used to, then cache the derived summary.
      const { readSaveSlot, decodePersistedSaveEnvelope, shouldAllowUnsignedLegacySaves } = await import(
        '@/utils/saveValidation'
      );
      const allowLegacy = shouldAllowUnsignedLegacySaves();

      const raw = await readSaveSlot(slot, undefined, { allowLegacy });
      if (!raw) return null;

      const decoded = decodePersistedSaveEnvelope(raw, { allowLegacy });
      if (!decoded.valid || typeof decoded.data !== 'string') return null;

      let parsed: unknown;
      try {
        parsed = JSON.parse(decoded.data);
      } catch {
        return null;
      }

      const meta = extractSaveSlotMeta(parsed);
      if (!meta) return null;

      if ((slotDeletionGen.get(slot) ?? 0) !== gen) {
        // The slot was deleted/overwritten while we were decoding - discard.
        return null;
      }
      await writeSaveSlotMeta(slot, meta);
      return meta;
    } catch (error) {
      log.warn('Failed to ensure save slot meta (non-critical)', {
        slot,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  })();

  backfillInFlight.set(slot, task);
  try {
    return await task;
  } finally {
    backfillInFlight.delete(slot);
  }
}
