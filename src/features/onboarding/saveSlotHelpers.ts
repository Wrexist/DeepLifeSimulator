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
 * Check whether all 3 save slots contain meaningful data.
 * Async because it lazily imports saveValidation to read each slot.
 */
export const checkIfAllSlotsFull = async (): Promise<boolean> => {
  try {
    const { readSaveSlot, decodePersistedSaveEnvelope, shouldAllowUnsignedLegacySaves } = await import(
      '@/utils/saveValidation'
    );
    const allowLegacy = shouldAllowUnsignedLegacySaves();
    let fullSlots = 0;

    for (let i = 1; i <= 3; i++) {
      const data = await readSaveSlot(i, undefined, { allowLegacy });
      if (!data) continue;

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
