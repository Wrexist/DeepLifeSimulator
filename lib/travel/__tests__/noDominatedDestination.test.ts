/**
 * ECO-13 (v57): every destination has a reason to go.
 *
 * A dominance scan found New York beaten on every stat by three cheaper trips
 * (Paris, London, Rome) and Paris beaten by Rome. A destination that another
 * matches-or-beats on every axis, and strictly beats on at least one, is a trip
 * no player should ever take - so the catalogue may not hold one.
 */
import { DESTINATIONS, type TravelDestination } from '../destinations';
import { buildTripReturnSummary, tripPartnerHappiness } from '../operations';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

/** Every axis, oriented so that HIGHER is better. */
function axes(d: TravelDestination): Record<string, number> {
  const b = d.benefits;
  return {
    cheaper: -d.cost,
    shorter: -d.duration,
    noPassport: d.requirements?.items?.length ? 0 : 1,
    happiness: b.happiness ?? 0,
    health: b.health ?? 0,
    energy: b.energy ?? 0,
    intelligence: b.intelligence ?? 0,
    reputation: b.reputation ?? 0,
    lessStress: -(b.stress ?? 0),
    partnerHappiness: b.partnerHappiness ?? 0,
  };
}

function weaklyDominates(a: TravelDestination, b: TravelDestination): boolean {
  const x = axes(a);
  const y = axes(b);
  const keys = Object.keys(x);
  return keys.every((k) => x[k] >= y[k]) && keys.some((k) => x[k] > y[k]);
}

describe('no destination is weakly dominated (ECO-13)', () => {
  it.each(DESTINATIONS.map((d) => [d.id, d] as const))('%s has a reason to go', (_id, d) => {
    const dominators = DESTINATIONS.filter((o) => o.id !== d.id && weaklyDominates(o, d)).map((o) => o.id);
    expect(dominators).toEqual([]);
  });

  it('the decided perks are in place', () => {
    const by = (id: string) => DESTINATIONS.find((d) => d.id === id)!.benefits;
    expect(by('new_york')).toMatchObject({ reputation: 8, intelligence: 10, energy: -5 });
    expect(by('london').intelligence).toBe(12);
    expect(by('paris').partnerHappiness).toBe(8);
  });
});

describe('the Paris partner bonus is paid only with a partner', () => {
  const paris = DESTINATIONS.find((d) => d.id === 'paris')!;

  function onTrip(relationships: GameState['relationships']): GameState {
    const base = createTestGameState();
    return createTestGameState({
      relationships,
      travel: {
        ...(base.travel ?? { visitedDestinations: [], passportOwned: true, businessOpportunities: {}, travelHistory: [] }),
        currentTrip: { destinationId: 'paris', startWeek: 100, returnWeek: 101 },
      } as GameState['travel'],
    });
  }

  const partner = {
    ...createTestGameState().relationships?.[0],
    id: 'p1',
    name: 'Alex',
    type: 'partner',
    relationshipScore: 70,
  } as GameState['relationships'][number];

  it('single: no bonus', () => {
    expect(tripPartnerHappiness(paris.benefits, { relationships: [] })).toBe(0);
  });

  it('with a partner: +8, and it reaches the return summary', () => {
    expect(tripPartnerHappiness(paris.benefits, { relationships: [partner] })).toBe(8);
    const roll = () => 0.999; // no random trip events
    const alone = buildTripReturnSummary(onTrip([]), roll);
    const together = buildTripReturnSummary(onTrip([partner]), roll);
    expect(alone).not.toBeNull();
    expect(together!.totals.happinessDelta - alone!.totals.happinessDelta).toBe(8);
  });
});
