/**
 * First Week Guide spawn gate — `shouldShowFirstWeekGuide`.
 *
 * Playtester report (2026-08): "The First Week Guide only appears after the
 * first prestige, not when first starting the game."
 *
 * Root cause: the spawner gated on `weeksInThisLife(state) <= 3`, but
 * `lifeStartWeek` is a v43 carve-out with NO backfill (CLAUDE.md §7), so every
 * save created earlier has no baseline and `weeksSinceLifeStart` falls back to
 * the ABSOLUTE `weeksLived` — 104+ for any starting age above 18. The gate
 * could never pass in life 1 of those saves. The first prestige stamps
 * `lifeStartWeek` (lib/prestige/prestigeExecution.ts), the counter reads
 * newborn-small, and the guide finally appeared — at exactly the wrong moment.
 *
 * Desired semantics: FIRST few weeks of the FIRST life only.
 */

import { shouldShowFirstWeekGuide } from '@/components/FirstWeekGuide';
import { createTestGameState } from '../helpers/createTestGameState';

describe('shouldShowFirstWeekGuide', () => {
  it('shows for a fresh age-18 first life', () => {
    const state = createTestGameState({ weeksLived: 0, lifeStartWeek: 0 });
    expect(shouldShowFirstWeekGuide(state)).toBe(true);
  });

  it('shows on frame one of an OLDER-age first life (the §4.2 case)', () => {
    // An age-25 start seeds weeksLived at (25-18)*52 = 364 and stamps the same
    // baseline, so "weeks into this life" is 0 — the guide must not be hidden
    // by the absolute counter.
    const state = createTestGameState({ weeksLived: 364, lifeStartWeek: 364 });
    expect(shouldShowFirstWeekGuide(state)).toBe(true);
  });

  it('stops after the third week of a first life', () => {
    expect(
      shouldShowFirstWeekGuide(createTestGameState({ weeksLived: 3, lifeStartWeek: 0 }))
    ).toBe(true);
    expect(
      shouldShowFirstWeekGuide(createTestGameState({ weeksLived: 4, lifeStartWeek: 0 }))
    ).toBe(false);
  });

  it('REGRESSION: never shows in a freshly prestigidated generation', () => {
    // The playtester's exact observation. Both prestige paths re-stamp
    // `lifeStartWeek`, so a post-prestige state reads newborn — indistinguishable
    // from a new player by the week number alone. Only the prestige counter
    // tells them apart.
    expect(
      shouldShowFirstWeekGuide(
        createTestGameState({
          weeksLived: 0,
          lifeStartWeek: 0,
          prestige: { prestigeLevel: 1 },
        })
      )
    ).toBe(false);
    expect(
      shouldShowFirstWeekGuide(
        createTestGameState({
          weeksLived: 364,
          lifeStartWeek: 364,
          prestige: { prestigeLevel: 1 },
        })
      )
    ).toBe(false);
  });

  it('REGRESSION: a pre-v43 first-life save still qualifies', () => {
    // No `lifeStartWeek` (the v43 carve-out leaves it absent), so the counter
    // falls back to the absolute value. The week is unknowable, but "still in
    // the first life" is knowable — show rather than hide forever.
    const preV43 = createTestGameState({ weeksLived: 300 });
    expect(preV43.lifeStartWeek).toBeUndefined();
    expect(shouldShowFirstWeekGuide(preV43)).toBe(true);
  });

  it('a pre-v43 save that HAS prestiged stays suppressed', () => {
    expect(
      shouldShowFirstWeekGuide(
        createTestGameState({ weeksLived: 50, prestige: { prestigeLevel: 2 } })
      )
    ).toBe(false);
  });

  it('treats a corrupt baseline like an absent one, per weekCounters', () => {
    expect(
      shouldShowFirstWeekGuide(createTestGameState({ weeksLived: 10, lifeStartWeek: NaN }))
    ).toBe(true);
    expect(
      shouldShowFirstWeekGuide(createTestGameState({ weeksLived: -1, lifeStartWeek: -5 }))
    ).toBe(true);
    expect(
      shouldShowFirstWeekGuide(
        createTestGameState({ weeksLived: 10, lifeStartWeek: NaN, prestige: { prestigeLevel: 1 } })
      )
    ).toBe(false);
  });

  it('a state with no prestige record at all counts as a first life', () => {
    // `initialState.prestige` is present, but the gate must degrade the same way
    // the rest of the app does (`s.prestige?.prestigeLevel ?? 0`) if it were not.
    const state = createTestGameState({ weeksLived: 0, lifeStartWeek: 0 });
    expect(state.prestige?.prestigeLevel).toBe(0);
    expect(shouldShowFirstWeekGuide({ ...state, prestige: undefined })).toBe(true);
  });

  it('fails closed on a missing game state', () => {
    expect(shouldShowFirstWeekGuide(null)).toBe(false);
    expect(shouldShowFirstWeekGuide(undefined)).toBe(false);
  });
});
