/**
 * The load-time merge for `stats`, `date`, `settings` and `userProfile`.
 *
 * This was a `for (const key in defaults)` loop for a long time — a whitelist
 * keyed on `initialGameState`. Every carve-out field in CLAUDE.md §7 is
 * deliberately ABSENT from `initialGameState` (its stored default is
 * `undefined`), so each one was written to disk correctly and then dropped on
 * the very next load. Nothing threw and nothing logged; the field simply was
 * not there any more.
 */
import { initialGameState } from '@/contexts/game/initialState';
import { mergeLoadedSlice } from '@/utils/loadedStateMerge';

describe('mergeLoadedSlice', () => {
  it('keeps the saved value over the default', () => {
    const out = mergeLoadedSlice({ a: 2 }, { a: 1 });
    expect(out.a).toBe(2);
  });

  it('falls back to the default for a missing or null saved value', () => {
    // Null is what a half-written or hand-edited save leaves where a number
    // belongs; letting it through poisons the arithmetic downstream.
    expect(mergeLoadedSlice({} as { a: number }, { a: 1 }).a).toBe(1);
    expect(mergeLoadedSlice({ a: null } as unknown as { a: number }, { a: 1 }).a).toBe(1);
    expect(mergeLoadedSlice(null, { a: 1 }).a).toBe(1);
  });

  it('keeps a falsy-but-real saved value', () => {
    expect(mergeLoadedSlice({ a: 0 }, { a: 5 }).a).toBe(0);
    expect(mergeLoadedSlice({ a: false }, { a: true }).a).toBe(false);
    expect(mergeLoadedSlice({ a: '' }, { a: 'x' }).a).toBe('');
  });

  it('keeps a saved key the defaults object does not have', () => {
    // The whole point. Without this the field round-trips to disk and back
    // into nothing.
    const out = mergeLoadedSlice({ a: 1, extra: 'kept' } as Record<string, unknown>, { a: 9 });
    expect(out.extra).toBe('kept');
  });

  it('drops a null under a key with no default, since there is nothing to keep', () => {
    const out = mergeLoadedSlice({ extra: null } as Record<string, unknown>, {});
    expect('extra' in out).toBe(false);
  });

  it('does not mutate either input', () => {
    const saved = { a: 1 };
    const defaults = { a: 0, b: 2 };
    mergeLoadedSlice(saved, defaults);
    expect(saved).toEqual({ a: 1 });
    expect(defaults).toEqual({ a: 0, b: 2 });
  });
});

describe('the carve-out fields survive a load', () => {
  /**
   * Each of these is a §7 carve-out living INSIDE one of the four merged
   * sub-objects, so each was being erased. They are asserted by name because
   * the failure is invisible at runtime — the feature just stops working.
   */
  it('keeps userProfile.avatar, the face the player designed', () => {
    expect('avatar' in initialGameState.userProfile).toBe(false);
    const out = mergeLoadedSlice(
      { ...initialGameState.userProfile, firstName: 'Ada', avatar: 'a1.5n804631300' },
      initialGameState.userProfile
    );
    expect((out as { avatar?: string }).avatar).toBe('a1.5n804631300');
  });

  it('keeps userProfile.avatarId, which seeds the derived face for old saves', () => {
    const out = mergeLoadedSlice(
      { ...initialGameState.userProfile, avatarId: 'm4' },
      initialGameState.userProfile
    );
    expect((out as { avatarId?: string }).avatarId).toBe('m4');
  });

  it('keeps the settings markers that close the restart-farm exploits', () => {
    // `lastNoFillGrantWeek` (v28) replaced a module-level boolean BECAUSE that
    // reset on restart and made the ad orb's courtesy grant farmable. Dropping
    // it on load reopened the same exploit through a different door.
    // `deepLifePlusLastGemClaimWeek` (v40) is the same shape: the game-week gate
    // on the free daily-gem faucet. If the load erased it, the forward-clock farm
    // it closes would reopen on the next app launch.
    // `lastWelcomeBackWeek` (v44) is the game-week gate on the welcome-back cash
    // bonus. Erasing it on load would reopen the forward-clock scrub it closes on
    // the very next launch — the same failure `lastNoFillGrantWeek` already had.
    // `deepLifePlusLastMemberClaimWeek` (v45) caps the DeepLife+ MEMBER grace at
    // one unplayed claim per played week. Erasing it on load would re-arm that
    // banked claim on every launch — the compounding forward-scrub it closes.
    expect('deepLifePlusLastGemClaimWeek' in initialGameState.settings).toBe(false);
    expect('deepLifePlusLastMemberClaimWeek' in initialGameState.settings).toBe(false);
    expect('lastWelcomeBackWeek' in initialGameState.settings).toBe(false);
    const out = mergeLoadedSlice(
      {
        ...initialGameState.settings,
        lastNoFillGrantWeek: 41,
        quickActionWeeks: { hustle: 41 },
        deepLifePlusLastGemClaimWeek: 41,
        deepLifePlusLastMemberClaimWeek: 41,
        lastWelcomeBackWeek: 41,
      },
      initialGameState.settings
    );
    expect((out as { lastNoFillGrantWeek?: number }).lastNoFillGrantWeek).toBe(41);
    expect((out as { quickActionWeeks?: unknown }).quickActionWeeks).toEqual({ hustle: 41 });
    expect((out as { deepLifePlusLastGemClaimWeek?: number }).deepLifePlusLastGemClaimWeek).toBe(41);
    expect(
      (out as { deepLifePlusLastMemberClaimWeek?: number }).deepLifePlusLastMemberClaimWeek,
    ).toBe(41);
    expect((out as { lastWelcomeBackWeek?: number }).lastWelcomeBackWeek).toBe(41);
  });
});
