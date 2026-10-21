/**
 * Weekly-tick audit (2026-10-21) - unit-level regressions.
 *
 *   TICK-1  the tick's decay multiplier (and, through it, the police fine) read
 *           a private net worth that counted SOLD properties.
 *   TICK-6  the yearly checkpoint snapshotted post-tick stats on top of
 *           pre-tick holdings, loans and banking.
 *   TICK-11 newborn ids and fallback names were derived from the wall clock.
 *   TICK-14 constant notification ids collapsed two people's / two programmes'
 *           same-week banners into one.
 *   TICK-15 a fully de-duplicated event roll still reset the event pity timer,
 *           and follow-ups bypassed the duplicate guard.
 */
import { computeDecayInputs } from '@/contexts/game/actions/weekly/preTick';
import { applyAutoCheckpoint } from '@/contexts/game/actions/weekly/applyAutoCheckpoint';
import { applyPregnancyProgression } from '@/contexts/game/actions/weekly/applyPregnancyProgression';
import { applyRelationshipHealth } from '@/contexts/game/actions/weekly/applyRelationshipHealth';
import {
  applyWeeklyEvents,
  dedupePendingEventsById,
} from '@/contexts/game/actions/weekly/applyWeeklyEvents';
import type { WeekContext, WeekNotification } from '@/contexts/game/actions/weekly/weekContext';
import * as engine from '@/lib/events/engine';
import type { WeeklyEvent } from '@/lib/events/engine';
import { netWorth } from '@/lib/progress/achievements';
import { sellProperty } from '@/lib/realEstate/operations';
import { PREGNANCY_DURATION_WEEKS } from '@/lib/config/gameConstants';
import type { EconomyState, GameStats, Relationship } from '@/contexts/game/types';
import { createTestGameState } from '../../helpers/createTestGameState';
import { makeRealEstate } from '../../helpers/makeRealEstate';
import { zeroPreRolls } from '../../helpers/zeroPreRolls';

function ctxWith(overrides: Partial<WeekContext> = {}): WeekContext {
  return {
    newStats: { health: 80, happiness: 80, energy: 80, fitness: 50, money: 10_000, reputation: 50, gems: 0 } as GameStats,
    notifications: [] as WeekNotification[],
    preRolls: zeroPreRolls({ relBreakup: Array(20).fill(0.99), relDisappointed: Array(20).fill(0.99) }),
    nextWeeksLived: 200,
    ...overrides,
  };
}

describe('TICK-1: the decay multiplier reads the canonical net worth', () => {
  it('a sold mansion does not halve decay', () => {
    const base = createTestGameState();
    const mansion = makeRealEstate({ id: 'mansion', name: 'Mansion', price: 3_500_000, owned: true });
    const sold = sellProperty([mansion], 'mansion', 0).properties;
    expect(sold[0]?.owned).toBe(false);
    const state = { ...base, realEstate: sold, stats: { ...base.stats, money: 1_000 } };

    const inputs = computeDecayInputs(state, { baseDecayRate: 4, prestigeMultiplier: 1 });
    expect(inputs.netWorth).toBe(Math.max(0, netWorth(state)));
    expect(inputs.netWorth).toBeLessThan(100_000);
    // Below $100k the multiplier sits at its 1.0 ceiling - full-rate decay.
    expect(inputs.wealthMultiplier).toBe(1);
  });
});

describe('TICK-6: the year checkpoint snapshots the assembled post-tick state', () => {
  it('uses postTickState when the tick passes it', () => {
    const prevState = createTestGameState({ weeksLived: 51, checkpoints: [] });
    const postTickState = {
      ...prevState,
      weeksLived: 52,
      stats: { ...prevState.stats, money: 777 },
      loans: [],
    };
    const result = applyAutoCheckpoint({
      prevState,
      newStats: { ...prevState.stats, money: 999 },
      nextWeeksLived: 52,
      postTickState,
    });
    const cp = result.partial.checkpoints?.[result.partial.checkpoints.length - 1];
    expect(cp).toBeDefined();
    const snap = (cp as unknown as { snapshot?: { stats?: GameStats; weeksLived?: number } }).snapshot;
    expect(snap?.weeksLived).toBe(52);
    expect(snap?.stats?.money).toBe(777);
  });
});

describe('TICK-11: a newborn is a function of the life and the week, not the clock', () => {
  it('same pre-rolls at different wall-clock times give the same child', () => {
    const partner = {
      id: 'p1', name: 'Pat', type: 'partner', relationshipScore: 80, personality: 'kind',
      gender: 'female', age: 25, datesCount: 3, isPregnant: true, pregnancyStartWeek: 100,
    } as Relationship;
    const at = (timestamp: number) =>
      applyPregnancyProgression(
        partner,
        ctxWith({
          nextWeeksLived: 100 + PREGNANCY_DURATION_WEEKS,
          preRolls: zeroPreRolls({ childIdSuffix: 'k3f9a2', timestamp }),
        }),
      );
    const a = at(1_700_000_000_000);
    const b = at(1_800_000_000_123);
    expect(a?.newborn).toBeTruthy();
    expect(a?.newborn?.id).toBe(b?.newborn?.id);
    expect(a?.newborn?.name).toBe(b?.newborn?.name);
    expect(a?.newborn?.id).not.toContain('1700000000000');
  });
});

describe('TICK-14: relationship notifications name their relationship', () => {
  it('two neglected friends in one week produce two distinct ids', () => {
    const ctx = ctxWith();
    const friend = (id: string, name: string) =>
      ({ id, name, type: 'friend', relationshipScore: 10, personality: 'kind', gender: 'male', age: 30, datesCount: 0 }) as Relationship;
    applyRelationshipHealth(friend('f1', 'Ana'), 0, ctx);
    applyRelationshipHealth(friend('f2', 'Ben'), 1, ctx);
    const ids = ctx.notifications.map((n) => n.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('holdBreakup skips the breakup roll for a pregnant partner', () => {
    const ctx = ctxWith({ preRolls: zeroPreRolls({ relBreakup: Array(20).fill(0), relDisappointed: Array(20).fill(0.99) }) });
    const partner = {
      id: 'p1', name: 'Pat', type: 'partner', relationshipScore: 5, weeksAtLowRelationship: 3,
      personality: 'kind', gender: 'female', age: 25, datesCount: 3,
    } as Relationship;
    expect(applyRelationshipHealth(partner, 0, ctxWith({ preRolls: ctx.preRolls })).rel).toBeNull();
    const held = applyRelationshipHealth(partner, 0, ctx, { holdBreakup: true });
    expect(held.rel).not.toBeNull();
    expect(held.rel?.weeksAtLowRelationship).toBe(4);
    expect(ctx.notifications.some((n) => n.id.startsWith('relationship-breakup'))).toBe(false);
  });
});

describe('TICK-15: duplicate events do not count and do not survive', () => {
  const anEvent = (id: string): WeeklyEvent =>
    ({ id, description: id, choices: [{ id: 'ok', text: 'OK', effects: {} }] }) as WeeklyEvent;

  it('a roll whose only event was already queued reports zero new events', () => {
    const spy = jest.spyOn(engine, 'rollWeeklyEvents').mockReturnValue([anEvent('wedding')] as never);
    try {
      const result = applyWeeklyEvents({
        prevState: { ...createTestGameState(), pendingEvents: [anEvent('wedding')], weeksLived: 100 },
        updatedEconomy: {} as EconomyState,
        nextWeeksLived: 101,
        nextWeek: 1,
      });
      expect(result.newEventCount).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('dedupePendingEventsById keeps the first copy of each id', () => {
    const queued = { ...anEvent('sequel'), generatedAtWeeksLived: 90 };
    const followUp = { ...anEvent('sequel'), generatedAtWeeksLived: 101 };
    const out = dedupePendingEventsById([anEvent('a'), queued, anEvent('b'), followUp]);
    expect(out.map((e) => e.id)).toEqual(['a', 'sequel', 'b']);
    expect(out[1]).toBe(queued);
  });
});
