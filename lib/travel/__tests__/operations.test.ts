import { buildTripReturnSummary, isTripReady, quoteTrip } from '../operations';
import { DESTINATIONS } from '../destinations';
import { GameState } from '@/contexts/game/types';

function base(over: Partial<any> = {}): GameState {
  return {
    stats: { money: 100_000, happiness: 80 },
    travel: {
      currentTrip: undefined,
      visitedDestinations: [],
      passportOwned: true,
      businessOpportunities: {},
      travelHistory: [],
    },
    vehicles: [],
    activeVehicleId: undefined,
    politics: { activePolicyEffects: { transportation: {} } },
    items: [],
    weeksLived: 10,
    ...over,
  } as any;
}

describe('quoteTrip', () => {
  it('returns unknown-destination for bad id', () => {
    const r = quoteTrip('does-not-exist', base(), 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('unknown-destination');
  });

  it('rejects when already traveling', () => {
    const s = base();
    s.travel!.currentTrip = { destinationId: 'paris', returnWeek: 12, startWeek: 10 };
    const r = quoteTrip('paris', s, 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('already-traveling');
  });

  it('rejects passport-locked destination without passport', () => {
    const s = base();
    s.travel!.passportOwned = false;
    const r = quoteTrip('paris', s, 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('needs-passport');
  });

  it('rejects when player cannot afford trip', () => {
    const s = base({ stats: { money: 100, happiness: 80 } });
    const r = quoteTrip('paris', s, 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('needs-money');
  });

  it('produces an adjusted cost / duration on success', () => {
    const r = quoteTrip('local_resort', base(), 10);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.adjustedCost).toBe(500);
      expect(r.adjustedDuration).toBe(1);
      expect(r.returnWeek).toBe(11);
    }
  });

  it('applies politics travelCostReduction to cost', () => {
    const s = base();
    (s as any).politics.activePolicyEffects.transportation = { travelCostReduction: 0.5 };
    const r = quoteTrip('paris', s, 10);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // base 2500 → 50% off → 1250
      expect(r.adjustedCost).toBe(1250);
    }
  });

  it('applies vehicle speedBonus to duration', () => {
    const s = base();
    s.activeVehicleId = 'v1';
    (s as any).vehicles = [{ id: 'v1', speedBonus: 50, condition: 100, fuelLevel: 100 }];
    // Find a 2-week destination
    const twoWeek = DESTINATIONS.find((d) => d.duration === 2)!;
    const r = quoteTrip(twoWeek.id, s, 10);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // 2 * 0.5 = 1
      expect(r.adjustedDuration).toBe(1);
    }
  });
});

describe('isTripReady', () => {
  it('returns ready=true when current week >= returnWeek', () => {
    const r = isTripReady({ destinationId: 'paris', returnWeek: 10, startWeek: 9 }, 10);
    expect(r.ready).toBe(true);
  });

  it('returns remaining weeks when not ready', () => {
    const r = isTripReady({ destinationId: 'paris', returnWeek: 15, startWeek: 10 }, 12);
    expect(r.ready).toBe(false);
    expect(r.weeksRemaining).toBe(3);
  });

  it('tolerates legacy week-of-month returnWeek values', () => {
    const r = isTripReady({ destinationId: 'paris', returnWeek: 3, startWeek: 1 }, 50);
    expect(r.ready).toBe(true);
  });

  it('returns not-ready for empty trip', () => {
    expect(isTripReady(undefined, 10).ready).toBe(false);
  });
});

describe('buildTripReturnSummary', () => {
  it('returns null when no current trip', () => {
    expect(buildTripReturnSummary(base(), () => 0.5)).toBeNull();
  });

  it('combines destination benefits with rolled event deltas', () => {
    const s = base();
    s.travel!.currentTrip = { destinationId: 'local_resort', returnWeek: 11, startWeek: 10 };
    // Force one event to fire — 'souvenir' is first in pool, happinessDelta +3
    const roller = (k: string) => {
      if (k === 'travel.event.1') return 0.1;
      if (k === 'travel.event.1.idx') return 0; // first eligible event
      if (k === 'travel.event.2') return 0.99;
      return 0;
    };
    const r = buildTripReturnSummary(s, roller);
    expect(r).not.toBeNull();
    if (r) {
      // local_resort: happiness 10, plus event happiness 3 = 13
      expect(r.totals.happinessDelta).toBe(13);
      expect(r.firstVisit).toBe(true);
    }
  });

  it('flags first visit correctly when destination already visited', () => {
    const s = base();
    s.travel!.currentTrip = { destinationId: 'local_resort', returnWeek: 11, startWeek: 10 };
    s.travel!.visitedDestinations = ['local_resort'];
    const r = buildTripReturnSummary(s, () => 0.99); // no events
    expect(r).not.toBeNull();
    if (r) expect(r.firstVisit).toBe(false);
  });
});
