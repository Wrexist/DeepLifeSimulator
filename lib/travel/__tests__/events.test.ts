import { rollTripEvents, summarizeEvents, TRAVEL_EVENTS } from '../events';

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
