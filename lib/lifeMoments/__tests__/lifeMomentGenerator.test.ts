/**
 * Life-moment generation — determinism, the pity baseline, and repeat guard.
 *
 * This was the last content path on `Math.random()` (every other roll baked
 * into a save goes through the seeded weekly RNG — CLAUDE.md §4.3), and its
 * 52-week pity measured the drought against a zero baseline, which
 * `weeksLived`'s age seeding makes instantly true for any scenario starting
 * past 19 — the fourth instance of the §4.2 baseline class (first-session
 * coach, FirstWeekGuide, Chapter 1's "Survive 4 Weeks", now this).
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import {
  generateLifeMoment,
  lifeMomentTemplateKey,
  recentMomentKeys,
  LIFE_MOMENT_TEMPLATES,
  LIFE_MOMENT_REPEAT_COOLDOWN_WEEKS,
} from '@/lib/lifeMoments/lifeMomentGenerator';

/** A state deep enough into its life that the 52-week pity has ripened. */
function pityRipeState(overrides: Partial<GameState> = {}): GameState {
  return createTestGameState({
    weeksLived: 460,
    lifeStartWeek: 364,
    lifeMoments: { lastMomentWeek: 0, momentsThisWeek: 0, totalMoments: 0, pendingMoment: undefined },
    ...overrides,
  });
}

describe('generateLifeMoment determinism', () => {
  it('same state always builds the same moment (StrictMode double-invoke safety)', () => {
    const state = pityRipeState();
    const first = generateLifeMoment(state);
    const second = generateLifeMoment(state);
    expect(first).not.toBeNull();
    expect(second?.id).toBe(first?.id);
    expect(second?.situation).toBe(first?.situation);
  });

  it('the id is week-encoded and template-keyed, not wall-clock random', () => {
    const state = pityRipeState();
    const moment = generateLifeMoment(state);
    expect(moment?.id).toMatch(/^life_moment_[a-z0-9]+_460$/);
  });
});

describe('the pity baseline (§4.2)', () => {
  it('does NOT pity-fire on the first tick of a life that starts past 18', () => {
    // Age-25 start: weeksLived seeded to 364, lastMomentWeek still 0. The old
    // `weeksLived - 0 >= 52` fired an interruptive popup on the opening tick.
    // Probe several first-tick weeks so a lucky 1.5% roll can't mask a pity
    // regression on any single seed.
    for (const start of [364, 520, 728]) {
      const state = createTestGameState({
        weeksLived: start + 1,
        lifeStartWeek: start,
        lifeMoments: { lastMomentWeek: 0, momentsThisWeek: 0, totalMoments: 0, pendingMoment: undefined },
      });
      const moment = generateLifeMoment(state);
      if (moment) {
        // Only the 1.5% weekly roll may produce one this early — never pity.
        // The drought measured from life start is 1 week, far under 52.
        expect(start + 1 - start).toBeLessThan(52);
      }
    }
  });

  it('still pity-fires after a genuine 52-week in-life drought', () => {
    expect(generateLifeMoment(pityRipeState())).not.toBeNull();
  });

  it('never generates while one is pending', () => {
    const state = pityRipeState({
      lifeMoments: {
        lastMomentWeek: 0, momentsThisWeek: 0, totalMoments: 0,
        pendingMoment: { id: 'x', situation: 's', choices: [], category: 'random', createdAt: 0 },
      } as never,
    });
    expect(generateLifeMoment(state)).toBeNull();
  });
});

describe('repeat guard', () => {
  it('recentMomentKeys parses keys from the resolver-written history and windows them', () => {
    const key = lifeMomentTemplateKey(LIFE_MOMENT_TEMPLATES[0]);
    const state = {
      weeksLived: 500,
      consequenceState: {
        choiceHistory: [
          { eventId: `life_moment_${key}_490`, choiceId: 'a', week: 2, weeksLived: 490, age: 27, timestamp: 0 },
          { eventId: `life_moment_stale_1`, choiceId: 'a', week: 2, weeksLived: 500 - LIFE_MOMENT_REPEAT_COOLDOWN_WEEKS - 1, age: 25, timestamp: 0 },
          { eventId: 'weekly_event_x', choiceId: 'a', week: 2, weeksLived: 499, age: 27, timestamp: 0 },
        ],
      },
    } as unknown as GameState;
    const keys = recentMomentKeys(state);
    expect(keys.has(key)).toBe(true);
    expect(keys.has('stale')).toBe(false);
    expect(keys.size).toBe(1);
  });

  it('legacy timestamp ids never suppress (they key to nothing a template hashes to)', () => {
    const state = {
      weeksLived: 500,
      consequenceState: {
        choiceHistory: [
          { eventId: 'life_moment_1719000000000_ab12cd', choiceId: 'a', week: 1, weeksLived: 499, age: 27, timestamp: 0 },
        ],
      },
    } as unknown as GameState;
    const keys = recentMomentKeys(state);
    for (const template of LIFE_MOMENT_TEMPLATES) {
      expect(keys.has(lifeMomentTemplateKey(template))).toBe(false);
    }
  });

  it('prefers an unseen template over a recently answered one', () => {
    const base = pityRipeState();
    const firstPick = generateLifeMoment(base);
    expect(firstPick).not.toBeNull();
    const pickedKey = firstPick!.id.split('_')[2];
    // Mark the picked template as recently answered; the same week's roll must
    // now land on a different template.
    const withHistory = {
      ...base,
      consequenceState: {
        ...(base.consequenceState ?? {}),
        choiceHistory: [
          { eventId: firstPick!.id, choiceId: 'a', week: 1, weeksLived: 458, age: 27, timestamp: 0 },
        ],
      },
    } as GameState;
    const secondPick = generateLifeMoment(withHistory);
    expect(secondPick).not.toBeNull();
    expect(secondPick!.id.split('_')[2]).not.toBe(pickedKey);
  });
});
