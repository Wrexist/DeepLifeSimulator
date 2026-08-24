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

describe('returnFromTrip - dropped benefits', () => {
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

describe('returnFromTrip - passport milestones', () => {
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

  it('is same-batch double-tap safe - the second return changes nothing', () => {
    /**
     * The STATE is the property that matters, and it is unchanged: the tier is
     * recorded once, the stats and event money are applied once.
     *
     * This used to also assert `second.success === false`, which was satisfied
     * by a `let applied` flag read after `setGameState`. That flag was removed
     * on 2026-08-15: it is only readable for the FIRST functional update of a
     * React batch, so on any deferred dispatch a LEGITIMATE return read `false`
     * — and because the flag also gated the payout, the trip was cleared while
     * every stat, the event money and the milestone were skipped. Losing a
     * trip's entire reward is far worse than a duplicated message on a double
     * tap, which is all that is given up here.
     */
    const snap = stateOnTrip({ destinationId: 'tokyo', visited: ['paris', 'bali'], passportMilestones: [] });
    const { setState, get } = makeBatchedSetState(snap);
    const first = returnFromTrip(snap, setState, deps);
    const statsAfterFirst = JSON.stringify(get().stats);

    const second = returnFromTrip(snap, setState, deps); // stale snapshot → trip already ended

    expect(first.success).toBe(true);
    expect(get().travel!.passportMilestones).toEqual(['jetsetter']);
    // Nothing landed twice — the second updater found no matching currentTrip.
    expect(JSON.stringify(get().stats)).toBe(statsAfterFirst);
    expect(get().travel!.currentTrip).toBeUndefined();
    // Documenting the accepted reporting trade rather than leaving it unstated.
    expect(second.success).toBe(true);
  });

  it('pays the trip reward even when the updater is DEFERRED (the 2026-08-15 bug)', () => {
    /**
     * The failure the flag caused, pinned. With the dispatch queued rather than
     * run — React's ordinary path for any update that is not first in its batch
     * — the old code reported "You are not on a trip" and granted nothing,
     * while the queued updater went on to end the trip anyway.
     */
    const snap = stateOnTrip({ destinationId: 'tokyo', visited: ['paris', 'bali'], passportMilestones: [] });
    let state = snap;
    const queue: React.SetStateAction<GameState>[] = [];
    const setState = ((u: React.SetStateAction<GameState>) => {
      queue.push(u);
    }) as React.Dispatch<React.SetStateAction<GameState>>;

    const res = returnFromTrip(snap, setState, deps);
    expect(res.success).toBe(true);
    expect(res.milestonesEarned?.map((t) => t.id)).toEqual(['jetsetter']);

    while (queue.length) {
      const u = queue.shift()!;
      state = typeof u === 'function' ? (u as (p: GameState) => GameState)(state) : u;
    }

    // The reward really landed: trip cleared AND the milestone recorded AND the
    // happiness total applied.
    expect(state.travel!.currentTrip).toBeUndefined();
    expect(state.travel!.passportMilestones).toEqual(['jetsetter']);
    expect(state.stats.happiness).toBeGreaterThan(snap.stats.happiness);
  });
});
