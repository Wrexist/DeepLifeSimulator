/**
 * The last line of defence between a new life and somebody's real save.
 *
 * A player wrote in after losing a prestiged run: they opened the app, found a
 * brand-new Week 1 / Age 18 / Generation 1 character sitting where their save
 * had been, and the file validated clean — because it *was* clean. It was a
 * legitimate new game written to the wrong slot.
 *
 * The old flow decided the target slot four screens before it wrote anything:
 *
 *   MainMenu "New Game"  → picks the first empty slot   ✅
 *   SaveSlots "New Game" → checks occupancy at ENTRY    ⚠️ not at the write
 *   DeathPopup "New Life" → sets no slot at all         ❌
 *
 * and then `Perks` closed the gap with `state.slot || 1`. Any route into the
 * onboarding stack that skipped the slot picker — the death screen, a deep
 * link, a draft rehydrated after iOS reaped the app — inherited the context
 * default of 1 and overwrote slot 1 without a single prompt.
 *
 * Picking the slot early and writing late is the bug. The check has to live
 * against the same read the write is about to clobber, the way every other
 * destructive path in this codebase re-checks inside its updater. So this
 * module is consulted *immediately before* `forceSave`, and it refuses to
 * guess: no chosen slot is an error, never a default.
 */

import { hasSaveStateShape, hasMeaningfulSaveData, type SaveSlotSnapshot } from './saveSlotHelpers';

/** `slot` value meaning "the player has not chosen one yet". Never write to it. */
export const NEW_LIFE_SLOT_UNSET = 0;

export const MIN_SLOT = 1;
export const MAX_SLOT = 3;

export type SlotInspection =
  /** Nothing meaningful stored — safe to start a life here. */
  | { status: 'free' }
  /** A real save lives here. `label` describes the character we would destroy. */
  | { status: 'occupied'; label: string }
  /**
   * Present but undecodable. Deliberately NOT treated as free: a corrupt
   * envelope is often still recoverable from a backup, and overwriting it
   * throws that away permanently.
   */
  | { status: 'unreadable' };

interface OccupantSnapshot extends SaveSlotSnapshot {
  generationNumber?: number;
  prestige?: { prestigeLevel?: number };
}

/**
 * A short human description of the save that occupies a slot, so the refusal
 * can name what it is protecting instead of saying "slot occupied". Losing a
 * generation-4 heir and losing an untouched tutorial run are not the same
 * event, and the message should not read the same either.
 */
export function describeOccupant(snapshot: OccupantSnapshot): string {
  const first = snapshot.userProfile?.firstName?.trim();
  const last = snapshot.userProfile?.lastName?.trim();
  const name = [first, last].filter(Boolean).join(' ') || 'An existing character';

  const parts: string[] = [];
  const age = snapshot.date?.age;
  if (typeof age === 'number' && Number.isFinite(age)) parts.push(`age ${Math.floor(age)}`);

  const generation = snapshot.generationNumber;
  if (typeof generation === 'number' && generation > 1) parts.push(`generation ${generation}`);

  const prestigeLevel = snapshot.prestige?.prestigeLevel;
  if (typeof prestigeLevel === 'number' && prestigeLevel > 0) parts.push(`prestige ${prestigeLevel}`);

  return parts.length > 0 ? `${name} (${parts.join(', ')})` : name;
}

/** Is `slot` a slot number we are willing to write to at all? */
export function isValidSlotNumber(slot: unknown): slot is number {
  return typeof slot === 'number' && Number.isInteger(slot) && slot >= MIN_SLOT && slot <= MAX_SLOT;
}

/**
 * Read a slot and decide whether a new life may be written over it.
 *
 * `free` is only ever returned on POSITIVE evidence — either no blob exists at
 * all, or one exists, decodes cleanly, and contains no gameplay. Everything
 * else is `unreadable`. "I could not tell" must never authorise a destructive
 * write.
 *
 * That is why the raw probe comes first and `readSaveSlot` does not: readSaveSlot
 * flattens *three* different outcomes into one `null` — nothing stored, stored
 * but failing CRC32/HMAC verification, and the storage read threw. Branching on
 * that null would call a save that merely failed to verify "empty" and delete
 * it, which is the whole failure mode this module exists to prevent. A key
 * rotation alone would have made every slot on the device look free.
 */
export async function inspectSlotForNewLife(slot: number): Promise<SlotInspection> {
  if (!isValidSlotNumber(slot)) return { status: 'unreadable' };

  try {
    // Dynamic import: saveSlotMeta pulls in the save pipeline, and slotSafety is
    // imported by OnboardingContext at app boot.
    const { probeSaveSlotBlob } = await import('@/utils/saveSlotMeta');
    const probe = await probeSaveSlotBlob(slot);
    // 'unknown' = the storage read threw. That proves nothing about emptiness.
    if (probe !== 'empty') {
      if (probe === 'unknown') return { status: 'unreadable' };
    } else {
      return { status: 'free' };
    }

    const { readSaveSlot, decodePersistedSaveEnvelope, shouldAllowUnsignedLegacySaves } = await import(
      '@/utils/saveValidation'
    );
    const allowLegacy = shouldAllowUnsignedLegacySaves();

    const data = await readSaveSlot(slot, undefined, { allowLegacy });
    // A blob demonstrably exists (the probe just saw it), so a null here means
    // it could not be verified — not that the slot is free.
    if (!data) return { status: 'unreadable' };

    const decoded = decodePersistedSaveEnvelope(data, { allowLegacy });
    if (!decoded.valid || typeof decoded.data !== 'string') return { status: 'unreadable' };

    let parsed: unknown;
    try {
      parsed = JSON.parse(decoded.data);
    } catch {
      return { status: 'unreadable' };
    }

    // Decoded cleanly and holds no gameplay: a placeholder, safe to reuse.
    if (!hasSaveStateShape(parsed) || !hasMeaningfulSaveData(parsed)) return { status: 'free' };

    return { status: 'occupied', label: describeOccupant(parsed as OccupantSnapshot) };
  } catch {
    return { status: 'unreadable' };
  }
}

export type NewLifeSlotResolution =
  | { ok: true; slot: number }
  | { ok: false; code: 'no-slot-chosen' | 'slot-occupied' | 'slot-unreadable'; title: string; message: string };

/**
 * Decide, at the moment of writing, whether this new life may be saved to
 * `requestedSlot`.
 *
 * Refuses rather than falls back. A fallback is what cost a player their
 * prestiged run: the write has no way to tell a deliberate choice of slot 1
 * from a context default of slot 1, so it must never accept the default.
 */
export async function resolveNewLifeSlot(requestedSlot: unknown): Promise<NewLifeSlotResolution> {
  if (!isValidSlotNumber(requestedSlot)) {
    return {
      ok: false,
      code: 'no-slot-chosen',
      title: 'Choose A Save Slot',
      message:
        'Pick the slot for this life before starting it, so nothing you have already played gets written over.',
    };
  }

  const inspection = await inspectSlotForNewLife(requestedSlot);

  if (inspection.status === 'occupied') {
    return {
      ok: false,
      code: 'slot-occupied',
      title: 'Slot Already In Use',
      message: `Slot ${requestedSlot} holds ${inspection.label}. Choose an empty slot, or delete that save first if you are sure.`,
    };
  }

  if (inspection.status === 'unreadable') {
    return {
      ok: false,
      code: 'slot-unreadable',
      title: 'Slot Could Not Be Read',
      message: `Slot ${requestedSlot} has save data we could not open, so we will not write over it — it may still be recoverable. Please choose another slot.`,
    };
  }

  return { ok: true, slot: requestedSlot };
}
