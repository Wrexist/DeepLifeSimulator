/**
 * The one definition of "is this a slot we may write to".
 *
 * Deliberately a leaf with no imports. It used to live in `saveQueue`, which
 * meant every suite that mocked the save queue silently lost the guard — and a
 * guard that disappears under a mock is a guard you cannot trust in the code
 * that consumes it.
 *
 * Four separate places used to answer this question by COERCING: a NaN,
 * undefined or out-of-range slot became slot 1, and the write went ahead. That
 * is exactly backwards — an unknown target is the one case where you must not
 * write at all (2026-07-29 audit SAVE-OW-6).
 */

export const MIN_SAVE_SLOT = 1;
export const MAX_SAVE_SLOT = 3;

/** The only slot numbers a save may ever be written to. */
export function isWritableSlot(slot: unknown): slot is number {
  return (
    typeof slot === 'number' &&
    Number.isInteger(slot) &&
    slot >= MIN_SAVE_SLOT &&
    slot <= MAX_SAVE_SLOT
  );
}
