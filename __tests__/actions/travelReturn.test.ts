/**
 * WAVE A — TravelApp return flow: dropped benefits + passport milestones.
 *
 * returnFromTrip now (a) applies the folded stress-relief + intelligence
 * experience via buildTripReturnSummary (so happiness/energy actually move), and
 * (b) evaluates passport milestone tiers against the post-return distinct-
 * destination count, granting each bounded one-off reward exactly once and
 * recording the claimed id in travel.passportMilestones. Same-batch double-tap
 * safe: the second tap finds no active trip and no-ops.
 */
import { returnFromTrip } from '@/contexts/game/actions/TravelActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, TravelState } from '@/contexts/game/types';

function makeBatchedSetState(initial: GameState) {
  let state = initial;
  const setState: React.Dispatch<React.SetStateAction<GameState>> = (update) => {
    state = typeof update === 'function' ? update(state) : update;
  };
  return { setState, get: () => state };
}

function stateOnTrip(over: {
  destinationId: string;
  visited?: string[];
  passportMilestones?: string[];
  happiness?: number;
  reputation?: number;
}): GameState {
  const travel: TravelState = {
    currentTrip: { destinationId: over.destinationId, returnWeek: 12, startWeek: 11 },
    visitedDestinations: over.visited ?? [],
    passportOwned: true,
    businessOpportunities: {},
    travelHistory: [],
    passportMilestones: over.passportMilestones ?? [],
  };
  return createTestGameState({
    stats: { money: 100_000, happiness: over.happiness ?? 30, reputation: over.reputation ?? 10 } as never,
    weeksLived: 20,
    travel,
  });
}

const deps = { updateStats, updateMoney };

describe('returnFromTrip — dropped benefits', () => {
  it('applies stat benefits on a ready return (happiness rises)', () => {
    const snap = stateOnTrip({ destinationId: 'tokyo', visited: ['tokyo'], happiness: 30 });
    const { setState, get } = makeBatchedSetState(snap);
    const res = returnFromTrip(snap, setState, deps);
    expect(res.success).toBe(true);
    // tokyo confers happiness 25 + intel 10 + folded stress relief; no travel
    // event in the pool reduces happiness, so it can only rise.
    expect(get().stats.happiness).toBeGreaterThan(30);
    expect(get().travel!.currentTrip).toBeUndefined();
  });

  it('refuses when the trip is not yet ready', () => {
    const snap = stateOnTrip({ destinationId: 'tokyo' });
    snap.weeksLived = 11; // returnWeek 12 → still traveling
    const { setState, get } = makeBatchedSetState(snap);
    const res = returnFromTrip(snap, setState, deps);
    expect(res.success).toBe(false);
    expect(get().travel!.currentTrip).toBeDefined();
  });
});

describe('returnFromTrip — passport milestones', () => {
  it('grants a tier and records its id when the return crosses a threshold', () => {
    // 2 distinct visited + a NEW 3rd destination → crosses the "jetsetter" (3) tier.
    const snap = stateOnTrip({ destinationId: 'tokyo', visited: ['paris', 'bali'], passportMilestones: [] });
    const { setState, get } = makeBatchedSetState(snap);
    const res = returnFromTrip(snap, setState, deps);
    expect(res.success).toBe(true);
    expect(res.milestonesEarned?.map((t) => t.id)).toEqual(['jetsetter']);
    expect(get().travel!.passportMilestones).toContain('jetsetter');
  });

  it('grants no milestone when the return does not cross a threshold', () => {
    const snap = stateOnTrip({ destinationId: 'tokyo', visited: ['paris'], passportMilestones: [] });
    const { setState, get } = makeBatchedSetState(snap);
    const res = returnFromTrip(snap, setState, deps);
    expect(res.milestonesEarned).toEqual([]);
    expect(get().travel!.passportMilestones).toEqual([]);
  });

  it('does not re-grant a tier already claimed', () => {
    const snap = stateOnTrip({ destinationId: 'tokyo', visited: ['paris', 'bali'], passportMilestones: ['jetsetter'] });
    const { setState, get } = makeBatchedSetState(snap);
    const res = returnFromTrip(snap, setState, deps);
    expect(res.milestonesEarned).toEqual([]);
    expect(get().travel!.passportMilestones).toEqual(['jetsetter']);
  });

  it('is same-batch double-tap safe — second return no-ops, tier recorded once', () => {
    const snap = stateOnTrip({ destinationId: 'tokyo', visited: ['paris', 'bali'], passportMilestones: [] });
    const { setState, get } = makeBatchedSetState(snap);
    const first = returnFromTrip(snap, setState, deps);
    const second = returnFromTrip(snap, setState, deps); // stale snapshot → trip already ended
    expect(first.success).toBe(true);
    expect(second.success).toBe(false);
    expect(get().travel!.passportMilestones).toEqual(['jetsetter']);
  });
});
