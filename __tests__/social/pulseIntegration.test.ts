/**
 * Pulse integration — multi-week compose → tick → scandal → recover.
 *
 * Exercises the full Pulse loop across 8 simulated weeks:
 *   week 1-3: player composes posts, grows followers
 *   week 4:   scandal injected
 *   week 5:   tick decays scandal severity (no resolution chosen yet)
 *   week 6:   player chooses gem-based scandal recovery
 *   week 7-8: post-recovery growth resumes
 *
 * No React, no GameActionsContext. Just the pure tick + actions composed.
 */
import {
  composePost,
  recoverFromScandal,
} from '@/contexts/game/actions/PulseActions';
import { processPulseWeeklyTick } from '@/lib/social/pulseTick';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState, PulseActiveScandal } from '@/contexts/game/types';

function freshState(overrides: Partial<GameState> = {}): GameState {
  // The re-clones that used to live here (socialMedia / userProfile / stats)
  // are gone: `createTestGameState` now deep-clones its base, so nested state
  // is already private to this call. See the note in that factory.
  return createTestGameState(overrides);
}

function makeHarness(initial: GameState) {
  let current = initial;
  const setGameState = (updater: any) => {
    current = typeof updater === 'function' ? updater(current) : updater;
  };
  const getState = () => current;
  return { setGameState, getState };
}

/**
 * Advance one game week — apply the Pulse tick result to state so the next
 * week sees the new socialMedia, stats, etc. Mirrors what
 * GameActionsContext::nextWeek does (minus the rest of the life sim).
 */
function advanceWeek(getState: () => GameState, setGameState: (u: any) => void) {
  setGameState((prev: GameState) => {
    const nextWeeksLived = (prev.weeksLived ?? 0) + 1;
    const tick = processPulseWeeklyTick(prev, nextWeeksLived);
    return {
      ...prev,
      weeksLived: nextWeeksLived,
      socialMedia: tick.socialMedia,
      stats: {
        ...prev.stats,
        reputation: Math.max(0, prev.stats.reputation + tick.reputationDelta),
        money: prev.stats.money + tick.pulseEarnings,
      },
    };
  });
}

describe('Pulse 8-week integration: compose → grow → scandal → recover', () => {
  it('runs the full loop without throwing and produces sensible state', () => {
    const state = freshState({ weeksLived: 0 });
    state.stats.energy = 100;
    state.stats.gems = 1000;
    state.stats.reputation = 50; // headroom for the scandal cascade to drop us
    state.socialMedia!.followers = 500;
    state.userProfile.handle = 'demo';

    const { setGameState, getState } = makeHarness(state);

    // Week 1-3: player composes 3 posts to grow audience
    for (let i = 0; i < 3; i++) {
      composePost(setGameState, getState(), {
        content: `Update ${i}`,
        contentType: 'text',
        hashtags: ['#GrowthMindset'],
      });
      advanceWeek(getState, setGameState);
      // Restore energy each week so we can keep posting
      getState().stats.energy = 100;
    }

    expect(getState().socialMedia!.totalPosts).toBe(3);
    expect(getState().weeksLived).toBe(3);
    const followersAfterGrowth = getState().socialMedia!.followers;
    expect(followersAfterGrowth).toBeGreaterThanOrEqual(500);

    // Week 4: inject scandal directly (simulates fame event firing)
    const scandal: PulseActiveScandal = {
      id: 'integration-scandal',
      type: 'bad_take',
      severity: 80,
      weeksRemaining: 4,
      startedWeek: 3,
      reputationLossThisWeek: 0,
      followerLossThisWeek: 0,
      headline: 'A controversial take is spreading',
    };
    setGameState((prev: GameState) => ({
      ...prev,
      socialMedia: { ...prev.socialMedia!, activeScandal: scandal },
    }));

    const repBeforeScandal = getState().stats.reputation;
    const followersBeforeScandal = getState().socialMedia!.followers;

    // Week 5: tick decays the scandal - should drop reputation and followers
    advanceWeek(getState, setGameState);
    expect(getState().stats.reputation).toBeLessThan(repBeforeScandal);
    expect(getState().socialMedia!.followers).toBeLessThan(followersBeforeScandal);
    expect(getState().socialMedia!.activeScandal).not.toBeNull();

    // Week 6: player chooses gem-based recovery → instant clear
    const recovery = recoverFromScandal(setGameState, getState(), 'gems');
    expect(recovery.success).toBe(true);
    expect(getState().socialMedia!.activeScandal).toBeNull();
    expect(getState().socialMedia!.scandalHistory).toHaveLength(1);
    expect(getState().socialMedia!.lifetimeStats!.totalScandalsSurvived).toBe(1);
    expect(getState().stats.gems).toBe(500); // 1000 - 500

    // Week 7-8: posting resumes; followers should not be cascading down anymore
    getState().stats.energy = 100;
    composePost(setGameState, getState(), {
      content: 'Back at it.',
      contentType: 'text',
    });
    advanceWeek(getState, setGameState);
    getState().stats.energy = 100;
    composePost(setGameState, getState(), {
      content: 'Refocused.',
      contentType: 'text',
    });
    advanceWeek(getState, setGameState);

    // No active scandal, no further scandal-driven follower loss this week
    expect(getState().socialMedia!.activeScandal).toBeNull();
    // 3 growth weeks + 1 scandal-tick week + 2 recovery weeks = 6 advanceWeek calls
    expect(getState().weeksLived).toBe(6);
    expect(getState().socialMedia!.scandalHistory).toHaveLength(1);
  });

  it('apology recovery accelerates scandal severity decay vs. doing nothing', () => {
    // Two parallel runs differing only in the recovery method
    function runScandalFor(weeks: number, method: 'silence' | 'apology' | null) {
      const s = freshState({ weeksLived: 0 });
      s.socialMedia!.followers = 10_000;
      s.socialMedia!.activeScandal = {
        id: 'scandal',
        type: 'cancel',
        severity: 80,
        weeksRemaining: 10,
        startedWeek: 0,
        reputationLossThisWeek: 0,
        followerLossThisWeek: 0,
        headline: 'test',
      };
      const h = makeHarness(s);
      if (method === 'apology' || method === 'silence') {
        recoverFromScandal(h.setGameState, h.getState(), method);
      }
      for (let i = 0; i < weeks; i++) {
        advanceWeek(h.getState, h.setGameState);
      }
      return h.getState();
    }

    const apologyState = runScandalFor(2, 'apology');
    const silenceState = runScandalFor(2, 'silence');
    // Apology drops severity by 25/week, silence by 10/week - after 2 weeks
    // apology should have a lower severity (or be resolved entirely).
    const apologySev = apologyState.socialMedia?.activeScandal?.severity ?? 0;
    const silenceSev = silenceState.socialMedia?.activeScandal?.severity ?? 0;
    expect(apologySev).toBeLessThan(silenceSev);
  });
});
