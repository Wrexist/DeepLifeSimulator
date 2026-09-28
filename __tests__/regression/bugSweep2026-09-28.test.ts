/**
 * Regressions from the 2026-09-28 bug sweep (the DeepLife+ ads report, and the
 * findings the follow-up sweep confirmed). One `describe` per bug; each test
 * fails on the code before its fix.
 */
import type React from 'react';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { SCENARIOS } from '@/lib/scenarios/scenarioDefinitions';
import { validateOnboardingInputs } from '@/src/features/onboarding/gameInitializer';
import { applyChoiceConsequences } from '@/lib/lifeMoments/consequenceTracker';
import { hydrateLoadedState } from '@/utils/hydrateLoadedState';
import { recoverFromScandal, boostPostWithGems, startLiveStream } from '@/contexts/game/actions/PulseActions';
import { isRollCommitted, commitDeterministicRolls } from '@/lib/randomness/deterministicRng';

/** Two taps in one React batch: shared live state, the same stale snapshot. */
function batched(initial: GameState) {
  let state = initial;
  const setState = ((update: React.SetStateAction<GameState>) => {
    state = typeof update === 'function' ? update(state) : update;
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { setState, get: () => state };
}

describe("Athlete's Journey can be started", () => {
  it('its starting age passes the onboarding validator', () => {
    const def = SCENARIOS.find((s) => s.id === 'athletes_journey');
    expect(def).toBeDefined();
    const age = def!.startingConditions.age ?? 18;
    const res = validateOnboardingInputs({
      scenario: { id: def!.id, start: { age, cash: def!.startingConditions.money ?? 0 } },
      firstName: 'A',
      lastName: 'B',
      sex: 'male',
      sexuality: 'straight',
    });
    expect(res.valid).toBe(true);
  });

  it('no challenge scenario starts below 18', () => {
    for (const s of SCENARIOS) {
      expect(s.startingConditions.age ?? 18).toBeGreaterThanOrEqual(18);
    }
  });
});

describe('a resolved life-moment payoff consumes its unlock flag', () => {
  it('clears unlockedEvents so a trimmed choiceHistory cannot re-arm it', () => {
    const state = createTestGameState({
      consequenceState: {
        consequences: [],
        unlockedEvents: ['startup_payout'],
        lockedEvents: [],
        relationshipFlags: {},
        hiddenTraits: [],
        eventWeightModifiers: {},
        choiceHistory: [],
      },
    } as Partial<GameState>);
    const res = applyChoiceConsequences(state, 'startup_payout', 'cash_out');
    expect(res.updatedState.unlockedEvents).toEqual([]);
  });
});

describe('an heir with no relationships stays that way across a reload', () => {
  it('an empty relationships array is not replaced by the seeded parents', () => {
    const heir = createTestGameState({ relationships: [] });
    const { state } = hydrateLoadedState(JSON.parse(JSON.stringify(heir)), { source: 'test' });
    expect(state.relationships).toEqual([]);
  });
});

describe('Pulse double taps', () => {
  const withSocial = (over: Partial<NonNullable<GameState['socialMedia']>>, stats: Partial<GameState['stats']> = {}) => {
    const base = createTestGameState();
    return createTestGameState({
      weeksLived: 40,
      stats: { ...base.stats, money: 20_000, gems: 1_000, energy: 45, ...stats },
      socialMedia: { ...(base.socialMedia ?? {}), ...over } as never,
    });
  };

  it('a lawsuit charges its fee once', () => {
    const snap = withSocial({
      activeScandal: {
        id: 'sc', type: 'deepfake', severity: 50, weeksRemaining: 3, startedWeek: 38,
        reputationLossThisWeek: 2, followerLossThisWeek: 10, headline: 'x',
      },
      scandalHistory: [],
    });
    const { setState, get } = batched(snap);
    recoverFromScandal(setState, snap, 'lawsuit');
    recoverFromScandal(setState, snap, 'lawsuit');
    expect(20_000 - get().stats.money).toBe(5_000);
  });

  it('an apology is applied once', () => {
    const snap = withSocial({
      followers: 10_000,
      activeScandal: {
        id: 'sc', type: 'bad_take', severity: 50, weeksRemaining: 3, startedWeek: 38,
        reputationLossThisWeek: 2, followerLossThisWeek: 10, headline: 'x',
      },
      scandalHistory: [],
    });
    const { setState, get } = batched(snap);
    recoverFromScandal(setState, snap, 'apology');
    recoverFromScandal(setState, snap, 'apology');
    expect(snap.stats.energy - get().stats.energy).toBe(10);
    expect(get().socialMedia?.followers).toBe(9_800);
  });

  it('a post boost charges once per post per week', () => {
    const snap = withSocial({
      recentPosts: [{ id: 'p1', contentType: 'photo', likes: 1, reposts: 0, views: 1 } as never],
      pendingBoosts: [],
    });
    const { setState, get } = batched(snap);
    boostPostWithGems(setState, snap, 'p1');
    boostPostWithGems(setState, snap, 'p1');
    expect(1_000 - (get().stats.gems ?? 0)).toBe(200);
  });

  it('going live twice in one batch takes 30 energy once', () => {
    const snap = withSocial({ followers: 5_000, liveSession: null } as never);
    const { setState, get } = batched(snap);
    startLiveStream(setState, snap, 'hi');
    startLiveStream(setState, snap, 'hi');
    expect(snap.stats.energy - get().stats.energy).toBe(30);
  });
});

describe('isRollCommitted', () => {
  it('reports a key only after it is committed', () => {
    const s = createTestGameState();
    expect(isRollCommitted(s, 'proposal:1:p:r')).toBe(false);
    const log = commitDeterministicRolls(s, ['proposal:1:p:r'], 1);
    expect(isRollCommitted({ ...s, rngCommitLog: log }, 'proposal:1:p:r')).toBe(true);
  });
});
