/**
 * Shared save-slot utilities for onboarding screens.
 *
 * Extracted from MainMenu.tsx and SaveSlots.tsx to eliminate duplication.
 * Uses the stricter SaveSlots version that validates the `date` field.
 */

export type SaveSlotSnapshot = {
  weeksLived?: number;
  stats?: { money?: number };
  date?: { age?: number; month?: string };
  userProfile?: { firstName?: string; lastName?: string };
  achievements?: { completed?: boolean }[];
  relationships?: unknown[];
  items?: { owned?: boolean }[];
};

export interface SaveSlotData extends SaveSlotSnapshot {
  id: number;
  hasData: boolean;
  error?: boolean;
}

/** Type guard: does the parsed blob have the expected save-state shape? */
export const hasSaveStateShape = (state: unknown): state is SaveSlotSnapshot => {
  if (!state || typeof state !== 'object') return false;
  const candidate = state as Record<string, unknown>;
  return (
    typeof candidate.userProfile === 'object' &&
    candidate.userProfile !== null &&
    typeof candidate.stats === 'object' &&
    candidate.stats !== null &&
    typeof candidate.date === 'object' &&
    candidate.date !== null
  );
};

/** Returns true when a snapshot contains any sign of real gameplay. */
export const hasMeaningfulSaveData = (state: SaveSlotSnapshot): boolean => {
  return Boolean(
    (typeof state.weeksLived === 'number' && state.weeksLived > 0) ||
      (typeof state.stats?.money === 'number' && state.stats.money > 0) ||
      (Array.isArray(state.achievements) && state.achievements.some((a) => a?.completed)) ||
      (Array.isArray(state.relationships) && state.relationships.length > 0) ||
      (Array.isArray(state.items) && state.items.some((item) => item?.owned)) ||
      state.userProfile?.firstName ||
      state.userProfile?.lastName
  );
};

/**
 * Find the first save slot (1-3) that is safe to start a new life in, so a new
 * game can never silently overwrite an existing save. A slot counts as empty
 * when it has no data or no meaningful gameplay; unreadable/corrupt slots are
 * treated as OCCUPIED (skipped) so we never clobber a save that might still be
 * recoverable from a backup. Returns null when all 3 slots are occupied.
 */
export const findFirstEmptySlot = async (): Promise<number | null> => {
  try {
    const { probeSaveSlotBlob } = await import('@/utils/saveSlotMeta');
    const { readSaveSlot, decodePersistedSaveEnvelope, shouldAllowUnsignedLegacySaves } = await import(
      '@/utils/saveValidation'
    );
    const allowLegacy = shouldAllowUnsignedLegacySaves();

    for (let i = 1; i <= 3; i++) {
      // The raw probe first, because `readSaveSlot` returns the SAME null for
      // "nothing stored", "stored but failed CRC32/HMAC verification" and "the
      // storage read threw". Branching on that null called an unverifiable save
      // empty and handed the slot to New Game — one HMAC key rotation would have
      // made every slot on the device look free. `probeSaveSlotBlob` reads the
      // three raw keys and never confuses a failure with an absence.
      const probe = await probeSaveSlotBlob(i);
      if (probe === 'empty') return i; // nothing stored → safe to use
      if (probe === 'unknown') continue; // read failed → assume occupied

      const data = await readSaveSlot(i, undefined, { allowLegacy });
      // A blob exists (we just saw it) but did not verify → recoverable, skip.
      if (!data) continue;

      try {
        const decoded = decodePersistedSaveEnvelope(data, { allowLegacy });
        // Unreadable envelope: treat as occupied (don't risk a recoverable save).
        if (!decoded.valid || typeof decoded.data !== 'string') continue;

        const parsed = JSON.parse(decoded.data);
        if (!(hasSaveStateShape(parsed) && hasMeaningfulSaveData(parsed))) {
          return i; // present but empty/placeholder → safe to use
        }
      } catch {
        // Corrupt JSON → treat as occupied, skip it.
        continue;
      }
    }

    return null; // all 3 occupied
  } catch {
    return null;
  }
};

/**
 * Check whether all 3 save slots contain meaningful data.
 * Async because it lazily imports saveValidation to read each slot.
 */
export const checkIfAllSlotsFull = async (): Promise<boolean> => {
  try {
    const { probeSaveSlotBlob } = await import('@/utils/saveSlotMeta');
    const { readSaveSlot, decodePersistedSaveEnvelope, shouldAllowUnsignedLegacySaves } = await import(
      '@/utils/saveValidation'
    );
    const allowLegacy = shouldAllowUnsignedLegacySaves();
    let fullSlots = 0;

    for (let i = 1; i <= 3; i++) {
      // Same rule as findFirstEmptySlot: only a confirmed 'empty' is empty.
      // An unverifiable or unreadable slot counts as FULL, so the "all slots
      // full" backstop can still see it.
      const probe = await probeSaveSlotBlob(i);
      if (probe === 'empty') continue;
      if (probe === 'unknown') {
        fullSlots++;
        continue;
      }

      const data = await readSaveSlot(i, undefined, { allowLegacy });
      if (!data) {
        fullSlots++;
        continue;
      }

      try {
        const decoded = decodePersistedSaveEnvelope(data, { allowLegacy });
        if (!decoded.valid || typeof decoded.data !== 'string') {
          fullSlots++;
          continue;
        }
        const parsed = JSON.parse(decoded.data);
        if (hasSaveStateShape(parsed) && hasMeaningfulSaveData(parsed)) {
          fullSlots++;
        }
      } catch {
        fullSlots++;
      }
    }

    return fullSlots >= 3;
  } catch {
    return false;
  }
};
