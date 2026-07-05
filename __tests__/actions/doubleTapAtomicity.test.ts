/**
 * Same-batch double-tap atomicity — regression tests for the 2026-07-05 audit
 * fixes. Each test threads ONE mutable state ref through a functional
 * setGameState while passing BOTH calls the same stale snapshot (exactly what
 * two taps in one React batch see). The assertion is the exact money/resource
 * delta, not just the resulting flag (per tasks/lessons.md).
 */
import { GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { watchAdForFollowerBoost } from '@/contexts/game/actions/PulseActions';
import { purchasePassport, investInBusinessOpportunity } from '@/contexts/game/actions/TravelActions';
import { buyAccessory } from '@/contexts/game/actions/ContentActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';

/** Functional-setState harness: updaters run against the LIVE ref (like React
 *  processing a batch), while callers hold the stale snapshot. */
function makeHarness(initial: GameState) {
  const ref = { state: initial };
  const setGameState = ((update: GameState | ((prev: GameState) => GameState)) => {
    ref.state = typeof update === 'function' ? update(ref.state) : update;
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { ref, setGameState };
}

describe('same-batch double-tap atomicity (2026-07-05 audit fixes)', () => {
  it('watchAdForFollowerBoost grants followers exactly once per week', () => {
    const state = createTestGameState();
    state.weeksLived = 10;
    const { ref, setGameState } = makeHarness(state);
    const stale = state; // both taps see the same snapshot

    const r1 = watchAdForFollowerBoost(setGameState, stale);
    const r2 = watchAdForFollowerBoost(setGameState, stale);

    // Both taps pass the stale outer gate (r2.success is computed from the
    // stale snapshot) — the updater must be the authoritative gate.
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    const followers = ref.state.socialMedia?.followers ?? 0;
    const baseline = stale.socialMedia?.followers ?? 0;
    expect(followers - baseline).toBe(r1.followersGained); // exactly ONE grant
    expect(ref.state.socialMedia?.lastAdBoostWeek).toBe(10);
  });

  it('purchasePassport charges $500 exactly once', () => {
    const state = createTestGameState();
    state.stats.money = 1_100;
    state.travel = undefined as any;
    if (state.items) state.items = state.items.filter(i => i.id !== 'passport');
    const { ref, setGameState } = makeHarness(state);
    const stale = state;

    purchasePassport(stale, setGameState, { updateMoney });
    purchasePassport(stale, setGameState, { updateMoney });

    expect(ref.state.travel?.passportOwned).toBe(true);
    expect(ref.state.stats.money).toBe(600); // 1100 - 500, charged ONCE (old code: 100)
  });

  it('investInBusinessOpportunity charges the cost exactly once', () => {
    const state = createTestGameState();
    state.stats.money = 2_500;
    state.travel = {
      visitedDestinations: [],
      travelHistory: [],
      passportOwned: true,
      businessOpportunities: {
        opp1: {
          id: 'opp1',
          name: 'Beach Bar',
          cost: 1_000,
          weeklyIncome: 50,
          unlocked: true,
          invested: false,
        },
      },
    } as any;
    const { ref, setGameState } = makeHarness(state);
    const stale = state;

    investInBusinessOpportunity(stale, setGameState, 'opp1', { updateMoney });
    investInBusinessOpportunity(stale, setGameState, 'opp1', { updateMoney });

    expect(ref.state.travel?.businessOpportunities?.opp1?.invested).toBe(true);
    expect(ref.state.stats.money).toBe(1_500); // 2500 - 1000, charged ONCE (old code: 500)
  });

  it('buyAccessory charges the price exactly once', () => {
    const state = createTestGameState();
    state.stats.money = 450;
    const { ref, setGameState } = makeHarness(state);
    const stale = state;

    buyAccessory(stale, setGameState, 'microphone', 200, { updateMoney });
    buyAccessory(stale, setGameState, 'microphone', 200, { updateMoney });

    expect(ref.state.gamingStreaming?.equipment?.microphone).toBe(true);
    expect(ref.state.stats.money).toBe(250); // 450 - 200, charged ONCE (old code: 50)
  });
});
