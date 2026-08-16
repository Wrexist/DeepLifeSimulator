/**
 * Aircraft — the top of the transport ladder.
 *
 * Two properties matter most here and both are about the payoff finally
 * existing: a $65M private jet must actually change how the player travels, and
 * building a runway must make it meaningfully better. The rest is making sure
 * neither purchase is wasted without the other.
 */

import {
  PILOT_LICENSE,
  AIRCRAFT_VEHICLE_TIERS,
  PRIVATE_JET_LUXURY_ID,
  HELIPAD_ROOM_ID,
  AIRSTRIP_ROOM_ID,
  isAircraftVehicleId,
  getAircraftTier,
  getAirTravelStatus,
  airDurationMultiplier,
  hasBaseRoom,
} from '../aircraft';
import { AIRCRAFT_TEMPLATES, VEHICLE_TEMPLATES } from '../vehicles';
import { transportationMods } from '@/lib/travel/transportation';
import type { GameState, RealEstate, Vehicle } from '@/contexts/game/types';
import { createTestGameState, type TestGameStateOverrides } from '@/__tests__/helpers/createTestGameState';

const aircraft = (id: string): Vehicle => ({ id, owned: true, type: 'plane' }) as unknown as Vehicle;

const propertyWith = (rooms: string[]): RealEstate =>
  ({ id: 'luxury_private_island', name: 'Island', owned: true, rooms }) as unknown as RealEstate;

function makeState(overrides: TestGameStateOverrides = {}): GameState {
  const { stats, ...rest } = overrides;
  return createTestGameState({
    weeksLived: 400,
    vehicles: [],
    realEstate: [],
    luxuryItems: [],
    ...rest,
    stats: { money: 1_000_000, energy: 100, ...(stats ?? {}) },
  });
}

describe('aircraft catalog', () => {
  it('fills the gap between an SUV and a $65M jet', () => {
    const heli = AIRCRAFT_TEMPLATES.find((t) => t.id === 'utility_helicopter')!;
    const jet = AIRCRAFT_TEMPLATES.find((t) => t.id === 'light_jet')!;

    expect(heli.price).toBeLessThan(jet.price);
    // The helicopter is the reachable rung — well under the luxury jet's $65M.
    expect(heli.price).toBeLessThan(5_000_000);
    expect(jet.price).toBeLessThan(65_000_000);
  });

  it('registers aircraft in the main vehicle catalog so the garage finds them', () => {
    for (const template of AIRCRAFT_TEMPLATES) {
      expect(VEHICLE_TEMPLATES.find((v) => v.id === template.id)).toBeTruthy();
      expect(template.type).toBe('plane');
    }
  });

  it('costs real money to keep in the air', () => {
    for (const template of AIRCRAFT_TEMPLATES) {
      expect(template.weeklyMaintenanceCost + template.weeklyFuelCost).toBeGreaterThan(1000);
    }
  });

  it('identifies aircraft ids and nothing else', () => {
    expect(isAircraftVehicleId('utility_helicopter')).toBe(true);
    expect(isAircraftVehicleId('light_jet')).toBe(true);
    expect(isAircraftVehicleId('economy_sedan')).toBe(false);
    expect(isAircraftVehicleId(undefined)).toBe(false);
  });

  it('prices the pilot licence far above the driving one', () => {
    expect(PILOT_LICENSE.cost).toBeGreaterThan(10_000);
    expect(PILOT_LICENSE.minAge).toBeGreaterThanOrEqual(18);
  });
});

describe('getAircraftTier', () => {
  it('is none with nothing owned', () => {
    expect(getAircraftTier(makeState())).toBe('none');
  });

  it('reads owned aircraft out of the garage', () => {
    expect(getAircraftTier(makeState({ vehicles: [aircraft('utility_helicopter')] }))).toBe('helicopter');
    expect(getAircraftTier(makeState({ vehicles: [aircraft('light_jet')] }))).toBe('light_jet');
  });

  it('reads the private jet out of the luxury collection', () => {
    expect(getAircraftTier(makeState({ luxuryItems: [PRIVATE_JET_LUXURY_ID] }))).toBe('private_jet');
  });

  it('takes the best when several are owned', () => {
    const state = makeState({
      vehicles: [aircraft('utility_helicopter'), aircraft('light_jet')],
      luxuryItems: [PRIVATE_JET_LUXURY_ID],
    });
    expect(getAircraftTier(state)).toBe('private_jet');
  });

  it('ignores unowned aircraft and malformed state', () => {
    const unowned = { id: 'light_jet', owned: false } as unknown as Vehicle;
    expect(getAircraftTier(makeState({ vehicles: [unowned] }))).toBe('none');
    expect(getAircraftTier(null)).toBe('none');
    // DELIBERATE-CORRUPTION: `vehicles` as a string is the malformed-save shape
    // this assertion exists to prove survivable; no valid GameState expresses it.
    expect(getAircraftTier({ vehicles: 'nope' } as unknown as GameState)).toBe('none');
  });

  it('covers every catalogued aircraft id', () => {
    for (const template of AIRCRAFT_TEMPLATES) {
      expect(AIRCRAFT_VEHICLE_TIERS[template.id]).toBeTruthy();
    }
  });
});

describe('basing', () => {
  it('finds a base room on any owned property', () => {
    const state = makeState({ realEstate: [propertyWith([AIRSTRIP_ROOM_ID])] });
    expect(hasBaseRoom(state, AIRSTRIP_ROOM_ID)).toBe(true);
    expect(hasBaseRoom(state, HELIPAD_ROOM_ID)).toBe(false);
  });

  it('ignores rooms on properties the player no longer owns', () => {
    const sold = { ...propertyWith([AIRSTRIP_ROOM_ID]), owned: false };
    expect(hasBaseRoom(makeState({ realEstate: [sold] }), AIRSTRIP_ROOM_ID)).toBe(false);
  });

  it('survives malformed properties', () => {
    const junk = [null, { id: 'x' }, { id: 'y', rooms: 'nope' }] as unknown as RealEstate[];
    expect(() => hasBaseRoom(makeState({ realEstate: junk }), AIRSTRIP_ROOM_ID)).not.toThrow();
  });
});

describe('getAirTravelStatus', () => {
  it('reports nothing with no aircraft, and does not slow travel down', () => {
    const status = getAirTravelStatus(makeState());
    expect(status.tier).toBe('none');
    expect(status.durationMultiplier).toBe(1);
  });

  it('an unbased jet is still a jet', () => {
    // A player who buys the $65M jet and no runway must not feel cheated — the
    // aircraft is never a downgrade, the runway is an upgrade.
    const status = getAirTravelStatus(makeState({ luxuryItems: [PRIVATE_JET_LUXURY_ID] }));
    expect(status.based).toBe(false);
    expect(status.durationMultiplier).toBeLessThan(1);
    expect(status.summary).toContain('airstrip');
  });

  it('building the airstrip makes the jet dramatically better', () => {
    const unbased = getAirTravelStatus(makeState({ luxuryItems: [PRIVATE_JET_LUXURY_ID] }));
    const based = getAirTravelStatus(
      makeState({ luxuryItems: [PRIVATE_JET_LUXURY_ID], realEstate: [propertyWith([AIRSTRIP_ROOM_ID])] }),
    );

    expect(based.based).toBe(true);
    expect(based.durationMultiplier).toBeLessThan(unbased.durationMultiplier);
    expect(based.summary).toContain('your own');
  });

  it('bases a helicopter on a helipad, not an airstrip', () => {
    const onPad = getAirTravelStatus(
      makeState({ vehicles: [aircraft('utility_helicopter')], realEstate: [propertyWith([HELIPAD_ROOM_ID])] }),
    );
    const onStrip = getAirTravelStatus(
      makeState({ vehicles: [aircraft('utility_helicopter')], realEstate: [propertyWith([AIRSTRIP_ROOM_ID])] }),
    );

    expect(onPad.based).toBe(true);
    expect(onStrip.based).toBe(false);
  });

  it('gets strictly faster up the ladder', () => {
    const strip = [propertyWith([AIRSTRIP_ROOM_ID, HELIPAD_ROOM_ID])];
    const heli = airDurationMultiplier(makeState({ vehicles: [aircraft('utility_helicopter')], realEstate: strip }));
    const light = airDurationMultiplier(makeState({ vehicles: [aircraft('light_jet')], realEstate: strip }));
    const jet = airDurationMultiplier(makeState({ luxuryItems: [PRIVATE_JET_LUXURY_ID], realEstate: strip }));

    expect(light).toBeLessThan(heli);
    expect(jet).toBeLessThan(light);
  });
});

describe('transportationMods integration', () => {
  it('the jet actually shortens trips — the whole point', () => {
    const without = transportationMods(makeState());
    const with_ = transportationMods(
      makeState({ luxuryItems: [PRIVATE_JET_LUXURY_ID], realEstate: [propertyWith([AIRSTRIP_ROOM_ID])] }),
    );

    expect(with_.durationMultiplier).toBeLessThan(without.durationMultiplier);
    expect(with_.breakdown.aircraftDurationCutPct).toBeGreaterThan(0);
    expect(with_.breakdown.aircraftSummary).toContain('Private Jet');
  });

  it('does not make travel cheaper — fuel and crew are expensive', () => {
    const without = transportationMods(makeState());
    const with_ = transportationMods(makeState({ luxuryItems: [PRIVATE_JET_LUXURY_ID] }));
    expect(with_.costMultiplier).toBe(without.costMultiplier);
  });

  it('never drives the duration multiplier below the existing floor', () => {
    // Aircraft stack multiplicatively with vehicle and politics bonuses; the
    // 0.25 floor exists so a trip always takes a real week.
    const stacked = makeState({
      luxuryItems: [PRIVATE_JET_LUXURY_ID],
      realEstate: [propertyWith([AIRSTRIP_ROOM_ID])],
      vehicles: [{ id: 'v', owned: true, speedBonus: 50, condition: 100, fuelLevel: 100 } as unknown as Vehicle],
      activeVehicleId: 'v',
      politics: { activePolicyEffects: { transportation: { commuteTimeReduction: 50 } } },
    } as Partial<GameState>);

    expect(transportationMods(stacked).durationMultiplier).toBeGreaterThanOrEqual(0.25);
  });

  it('leaves a player with no aircraft exactly as they were', () => {
    const mods = transportationMods(makeState());
    expect(mods.durationMultiplier).toBe(1);
    expect(mods.breakdown.aircraftDurationCutPct).toBe(0);
  });
});
