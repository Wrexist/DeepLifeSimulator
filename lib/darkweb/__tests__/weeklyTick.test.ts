import { DarkWebState } from '@/contexts/game/types';
import { runDarkWebWeeklyTick } from '../weeklyTick';

function emptyDw(overrides: Partial<DarkWebState> = {}): DarkWebState {
  return {
    heat: 0,
    lastHeatDecayWeek: 0,
    dirtyBtc: 0,
    cleanBtc: 0,
    playerReputation: 0,
    vendors: [
      { id: 'v1', handle: 'a', reputation: 50, reviewCount: 10 },
    ],
    listings: [],
    activeJobs: [],
    jobHistory: [],
    laundering: [],
    skills: {
      hacking:    { level: 1, xp: 0, nextLevelXp: 100 },
      social:     { level: 1, xp: 0, nextLevelXp: 100 },
      opsec:      { level: 1, xp: 0, nextLevelXp: 100 },
      laundering: { level: 1, xp: 0, nextLevelXp: 100 },
    },
    recentEvents: [],
    ...overrides,
  };
}

/**
 * Build a rollFor that returns a fixed value for `darkweb.policeEvent` (forces
 * the event to fire) and a fixed `kind` roll that lands in a specific bucket.
 *
 * Buckets: <0.30 sting · <0.55 raid · <0.80 informant · else surveillance.
 */
function policeRoll(kindRoll: number): (key: string) => number {
  return (key) => {
    if (key === 'darkweb.policeEvent') return 0.001; // always fire
    if (key === 'darkweb.policeEvent.kind') return kindRoll;
    return 0.5;
  };
}

describe('runDarkWebWeeklyTick - heat decay', () => {
  it('decays heat over time', () => {
    const dw = emptyDw({ heat: 50, lastHeatDecayWeek: 0 });
    const r = runDarkWebWeeklyTick({
      darkWeb: dw,
      currentWeek: 1,
      rollFor: () => 0.99, // never fire police events
    });
    expect(r.darkWeb.heat).toBeLessThan(50);
  });
});

describe('runDarkWebWeeklyTick - police events (sting bucket)', () => {
  it('seizes dirty BTC and bumps heat by 5', () => {
    const dw = emptyDw({ heat: 90, dirtyBtc: 1 });
    const r = runDarkWebWeeklyTick({
      darkWeb: dw,
      currentWeek: 1,
      rollFor: policeRoll(0.10), // <0.30 → sting
    });
    expect(r.dirtyBtcSeized).toBeGreaterThan(0);
    expect(r.darkWeb.dirtyBtc).toBeLessThan(dw.dirtyBtc);
    expect(r.notifications.find((n) => n.id === 'darkweb-sting')).toBeDefined();
  });
});

describe('runDarkWebWeeklyTick - police events (raid bucket)', () => {
  it('adds jail weeks and decays heat by 25', () => {
    const dw = emptyDw({ heat: 90 });
    const r = runDarkWebWeeklyTick({
      darkWeb: dw,
      currentWeek: 1,
      rollFor: policeRoll(0.40), // 0.30-0.55 → raid
    });
    expect(r.jailWeeksAdded).toBeGreaterThanOrEqual(1);
    // Heat was decayed first (-3 ish), then raid bumped -25 → < 90 - 25 + decay
    expect(r.darkWeb.heat).toBeLessThan(90);
    expect(r.notifications.find((n) => n.id === 'darkweb-raid')).toBeDefined();
  });
});

describe('runDarkWebWeeklyTick - police events (informant bucket)', () => {
  it('drains clean BTC as payoff and bumps heat by 3', () => {
    const dw = emptyDw({ heat: 90, cleanBtc: 2 });
    const r = runDarkWebWeeklyTick({
      darkWeb: dw,
      currentWeek: 1,
      rollFor: policeRoll(0.65), // 0.55-0.80 → informant
    });
    expect(r.darkWeb.cleanBtc).toBeLessThan(dw.cleanBtc);
    expect(r.notifications.find((n) => n.id === 'darkweb-informant')).toBeDefined();
  });

  it('falls through to surveillance when there is no clean BTC to pay off', () => {
    const dw = emptyDw({ heat: 90, cleanBtc: 0 });
    const r = runDarkWebWeeklyTick({
      darkWeb: dw,
      currentWeek: 1,
      rollFor: policeRoll(0.65),
    });
    // Sub-roll 0.65 was informant, but with no cleanBtc the else branch (surveillance) fires.
    expect(r.notifications.find((n) => n.id === 'darkweb-surveillance')).toBeDefined();
  });
});

describe('runDarkWebWeeklyTick - police events (surveillance bucket)', () => {
  it('spikes heat without jail / btc seizure', () => {
    const dw = emptyDw({ heat: 60 });
    const r = runDarkWebWeeklyTick({
      darkWeb: dw,
      currentWeek: 1,
      rollFor: policeRoll(0.95), // >0.80 → surveillance
    });
    expect(r.jailWeeksAdded).toBe(0);
    expect(r.dirtyBtcSeized).toBe(0);
    expect(r.darkWeb.heat).toBeGreaterThanOrEqual(60); // heat went UP (or stayed roughly equal after small decay)
    expect(r.notifications.find((n) => n.id === 'darkweb-surveillance')).toBeDefined();
  });
});

describe('runDarkWebWeeklyTick - no police events when cold', () => {
  it('skips events entirely when heat is below 20', () => {
    const dw = emptyDw({ heat: 10 });
    const r = runDarkWebWeeklyTick({
      darkWeb: dw,
      currentWeek: 1,
      rollFor: policeRoll(0.10),
    });
    expect(r.jailWeeksAdded).toBe(0);
    expect(r.dirtyBtcSeized).toBe(0);
    expect(r.notifications.find((n) => n.id?.startsWith('darkweb-sting'))).toBeUndefined();
  });
});

describe('runDarkWebWeeklyTick - relationship discovery', () => {
  /** Roll source that returns 0.99 (no police events) but 0.001 for the discovery roll. */
  const discoveryRoll = (key: string) => {
    if (key === 'darkweb.policeEvent') return 0.99;
    if (key === 'darkweb.relationshipDiscovery') return 0.001;
    return 0.5;
  };

  it('emits a delta + notification when heat ≥ 50 and a partner exists', () => {
    const dw = emptyDw({ heat: 60 });
    const r = runDarkWebWeeklyTick({
      darkWeb: dw,
      currentWeek: 1,
      relationships: [
        { id: 'p1', name: 'Sam', type: 'partner', relationshipScore: 60, personality: 'kind', gender: 'female', age: 28 } as any,
      ],
      rollFor: discoveryRoll,
    });
    expect(r.relationshipDeltas).toHaveLength(1);
    expect(r.relationshipDeltas[0].id).toBe('p1');
    expect(r.relationshipDeltas[0].delta).toBeLessThan(0);
    expect(r.notifications.find((n) => n.id === 'darkweb-relationship-discovery')).toBeDefined();
  });

  it('does not fire when heat < 50', () => {
    const dw = emptyDw({ heat: 40 });
    const r = runDarkWebWeeklyTick({
      darkWeb: dw,
      currentWeek: 1,
      relationships: [
        { id: 'p1', name: 'Sam', type: 'partner', relationshipScore: 60, personality: 'kind', gender: 'female', age: 28 } as any,
      ],
      rollFor: discoveryRoll,
    });
    expect(r.relationshipDeltas).toHaveLength(0);
  });

  it('does not fire without a partner / spouse', () => {
    const dw = emptyDw({ heat: 80 });
    const r = runDarkWebWeeklyTick({
      darkWeb: dw,
      currentWeek: 1,
      relationships: [
        { id: 'f1', name: 'Joe', type: 'friend', relationshipScore: 80, personality: 'cool', gender: 'male', age: 30 } as any,
      ],
      rollFor: discoveryRoll,
    });
    expect(r.relationshipDeltas).toHaveLength(0);
  });

  it('trust buffer halves the drop for partners with rep ≥ 70', () => {
    const dw = emptyDw({ heat: 80 });
    const r = runDarkWebWeeklyTick({
      darkWeb: dw,
      currentWeek: 1,
      relationships: [
        { id: 'p1', name: 'Sam', type: 'spouse', relationshipScore: 80, personality: 'kind', gender: 'female', age: 28 } as any,
      ],
      rollFor: discoveryRoll,
    });
    expect(r.relationshipDeltas[0]?.delta).toBeGreaterThanOrEqual(-8);
  });
});
