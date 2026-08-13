/**
 * Merging one slice of a loaded save over its defaults.
 *
 * Used on load for the four sub-objects that are merged key-by-key rather than
 * by spread — `stats`, `date`, `settings` and `userProfile`. Two jobs:
 *
 *   1. A `null` in the save must not override a real default. Null is what a
 *      half-written or hand-edited save puts where a number belongs, and
 *      letting it through poisons arithmetic downstream.
 *   2. A key the SAVE has must survive even when the defaults object has no
 *      such key.
 *
 * Job 2 is the one this file exists for. The original was a single
 * `for (const key in defaults)` loop, which is a whitelist: any field absent
 * from `initialGameState` was dropped on the way in. That is the exact shape of
 * every carve-out field in CLAUDE.md §7 — a field whose stored default is
 * `undefined` is deliberately NOT written into `initialGameState`, so each one
 * was saved correctly and then erased on the next load.
 *
 * Two that were live:
 *
 *   - `userProfile.avatar` (v39) — the face the player designed in the
 *     creator. It reached disk and never came back, so `resolveAvatar` fell
 *     through to the derived fallback and the character who walked into the
 *     game was a different person from the one on the creation screen.
 *   - `settings.lastNoFillGrantWeek` (v28) — the marker capping the ad orb's
 *     no-fill courtesy reward. It replaced a module-level boolean precisely
 *     because that reset on restart and made the grant farmable; dropping the
 *     field on load reopened the same exploit through the same door.
 *
 * The cost is that an unknown key inside one of these four objects now
 * survives a load. That is not a new hole — every other slice of the save is
 * already merged by spread, and tampering is answered by the signed save
 * envelope rather than by whitelisting four objects out of dozens.
 */

export function mergeLoadedSlice<T extends Record<string, any>>(
  saved: T | null | undefined,
  defaults: T
): T {
  const merged: any = {};

  for (const key in defaults) {
    const savedValue = saved?.[key];
    merged[key] = savedValue !== null && savedValue !== undefined ? savedValue : defaults[key];
  }

  if (saved && typeof saved === 'object') {
    for (const key in saved) {
      // `key in merged` rather than a truthiness check: a default of
      // `undefined` still claims its key above, and re-visiting it here would
      // be harmless but confusing.
      if (key in merged) continue;
      const savedValue = (saved as Record<string, unknown>)[key];
      // No default exists for this key, so a null carries no information —
      // dropping it is the same answer as "absent".
      if (savedValue !== null && savedValue !== undefined) merged[key] = savedValue;
    }
  }

  return merged as T;
}
