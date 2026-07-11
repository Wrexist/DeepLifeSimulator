import { rollTripEvents, summarizeEvents, eligibleTripEvents, TRAVEL_EVENTS } from '../events';
import { DESTINATIONS } from '../destinations';

function makeRoller(values: Record<string, number>): (key: string) => number {
  return (k: string) => values[k] ?? 0;
}

describe('rollTripEvents', () => {
  it('returns no events when first roll exceeds 0.6 threshold', () => {
    const roll = makeRoller({ 'travel.event.1': 0.95 });
    expect(rollTripEvents(2000, roll)).toEqual([]);
  });

  it('returns one event when first roll passes', () => {
    const roll = makeRoller({
      'travel.event.1': 0.1,
      'travel.event.1.idx': 0,
      'travel.event.2': 0.9,
    });
    const events = rollTripEvents(0, roll);
    expect(events.length).toBe(1);
  });

  it('returns two distinct events when both rolls pass', () => {
    const roll = makeRoller({
      'travel.event.1': 0.1,
      'travel.event.1.idx': 0,
      'travel.event.2': 0.1,
      'travel.event.2.idx': 0.5,
    });
    const events = rollTripEvents(3000, roll);
    expect(events.length).toBe(2);
    expect(events[0].id).not.toBe(events[1].id);
  });

  it('filters eligible pool by minTripCost', () => {
    const roll = makeRoller({ 'travel.event.1': 0.1, 'travel.event.1.idx': 0.99 });
    const cheap = rollTripEvents(100, roll);
    // Cheap pool should only include events with minTripCost === 0
    expect(cheap.every((e) => e.minTripCost === 0)).toBe(true);
  });

  it('returns empty if no events are eligible', () => {
    // minTripCost values in pool include some at 0, so this is sanity-only.
    // Force by negative cost.
    const roll = makeRoller({ 'travel.event.1': 0.1, 'travel.event.1.idx': 0 });
    const evts = rollTripEvents(-1, roll);
    expect(evts).toEqual([]);
  });
});

describe('summarizeEvents', () => {
  it('sums deltas across multiple events', () => {
    const events = [
      TRAVEL_EVENTS.find((e) => e.id === 'lost-wallet')!,
      TRAVEL_EVENTS.find((e) => e.id === 'souvenir')!,
    ];
    const totals = summarizeEvents(events);
    expect(totals.moneyDelta).toBe(-200);
    expect(totals.happinessDelta).toBe(3);
  });

  it('returns zero totals for empty array', () => {
    expect(summarizeEvents([])).toEqual({
      happinessDelta: 0,
      healthDelta: 0,
      energyDelta: 0,
      moneyDelta: 0,
    });
  });
});

describe('eligibleTripEvents (destination-flavored pool)', () => {
  it('includes a destination-specific event only for its own destination', () => {
    const londonPool = eligibleTripEvents(2800, 'london');
    const romePool = eligibleTripEvents(2800, 'rome');
    expect(londonPool.some((e) => e.id === 'london_theatre')).toBe(true);
    expect(romePool.some((e) => e.id === 'london_theatre')).toBe(false);
  });

  it('excludes every curated event when no destinationId is given (generic pool unchanged)', () => {
    const generic = eligibleTripEvents(8000); // high cost, but no destination
    expect(generic.every((e) => !e.destinationId)).toBe(true);
  });

  it('still returns the generic pool for a destination with no curated events', () => {
    // local_resort ($500) has no events[]; it should still draw the cheap generic pool.
    const pool = eligibleTripEvents(500, 'local_resort');
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((e) => !e.destinationId)).toBe(true);
    expect(pool.some((e) => e.id === 'souvenir')).toBe(true);
  });

  it('every id referenced by DESTINATIONS.events exists and is tagged to that destination', () => {
    for (const dest of DESTINATIONS) {
      for (const id of dest.events || []) {
        const def = TRAVEL_EVENTS.find((e) => e.id === id);
        expect(def).toBeDefined();
        expect(def!.destinationId).toBe(dest.id);
      }
    }
  });

  it('every curated (destinationId-tagged) event is listed by its destination', () => {
    for (const e of TRAVEL_EVENTS) {
      if (!e.destinationId) continue;
      const dest = DESTINATIONS.find((d) => d.id === e.destinationId);
      expect(dest).toBeDefined();
      expect(dest!.events || []).toContain(e.id);
    }
  });
});

describe('rollTripEvents with a destination', () => {
  it('can roll a curated event for its destination', () => {
    // london pool = 7 generic (<=2800) + london_theatre + london_museum = 9;
    // idx 0.78 → floor(7.02) = 7 → the first curated event.
    const roll = makeRoller({
      'travel.event.1': 0.1,
      'travel.event.1.idx': 0.78,
      'travel.event.2': 0.99,
    });
    const events = rollTripEvents(2800, roll, 'london');
    expect(events).toHaveLength(1);
    expect(events[0].destinationId).toBe('london');
  });

  it('never rolls another destination\'s curated event', () => {
    // Sweep idx across the whole pool; nothing outside london/generic may appear.
    for (let i = 0; i < 40; i++) {
      const roll = makeRoller({
        'travel.event.1': 0.1,
        'travel.event.1.idx': i / 40,
        'travel.event.2': 0.99,
      });
      const events = rollTripEvents(2800, roll, 'london');
      for (const e of events) {
        if (e.destinationId) expect(e.destinationId).toBe('london');
      }
    }
  });

  it('rolled events are always a subset of the preview pool (preview == outcome)', () => {
    // Regression guard for the detail "What could happen" card, which renders
    // eligibleTripEvents(cost, id) — the roll must never surface anything the
    // preview did not list.
    const dest = DESTINATIONS.find((d) => d.id === 'maldives')!;
    const preview = eligibleTripEvents(dest.cost, dest.id).map((e) => e.id);
    for (let i = 0; i < 40; i++) {
      const roll = makeRoller({
        'travel.event.1': 0.1,
        'travel.event.1.idx': i / 40,
        'travel.event.2': 0.2,
        'travel.event.2.idx': (39 - i) / 40,
      });
      const rolled = rollTripEvents(dest.cost, roll, dest.id);
      for (const e of rolled) expect(preview).toContain(e.id);
    }
  });
});
