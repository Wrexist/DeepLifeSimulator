/**
 * Aircraft — the top of the transport ladder, and the thing that finally makes
 * a $65M private jet do something.
 *
 * THE GAP THIS FILLS
 * ------------------
 * `lib/travel/transportation.ts` already turns transport into trip cost and
 * duration, reading the active vehicle's `speedBonus`. The luxury private jet
 * contributed **nothing** to it: a player could own the fastest transport in the
 * game and still travel at civilian speed for civilian prices. And
 * `VEHICLE_TEMPLATES` had `type: 'plane'` in its union with zero aircraft in it,
 * so there was no rung between a $22k SUV and a $65M jet.
 *
 * THE LADDER
 * ----------
 *   helicopter ($2.5M)  → short hops, needs a helipad
 *   light jet  ($12M)   → real range, wants an airstrip
 *   private jet ($65M)  → the luxury item, transformed by an airstrip
 *
 * BASING IS THE POINT
 * -------------------
 * An aircraft with nowhere of its own to land is parked at a commercial field:
 * you still fly, but you queue, you file, you drive out there first. Build a
 * helipad or an airstrip on a property (`ROOM_ADDITIONS` in
 * `lib/realEstate/housing.ts`, reachable on the island minted by the luxury
 * purchase) and the same aircraft becomes dramatically better.
 *
 * That is the mechanic worth having: two expensive purchases that are each
 * merely good, and together are something else. Neither is wasted without the
 * other — an unbased aircraft is still the fastest thing you own.
 *
 * Pure module: no React, no state mutation, no RNG.
 */

import type { GameState, RealEstate } from '@/contexts/game/types';

/** Aircraft, worst → best. `none` means the player owns no aircraft at all. */
export type AircraftTier = 'none' | 'helicopter' | 'light_jet' | 'private_jet';

/** Licence to fly anything. Mirrors DRIVERS_LICENSE in vehicles.ts. */
export const PILOT_LICENSE = {
  cost: 45_000,
  minAge: 18,
  description:
    'Required to own and fly any aircraft. Hundreds of hours, written exams, and a medical.',
};

/** Room-addition ids that count as somewhere to base an aircraft. */
export const HELIPAD_ROOM_ID = 'helipad';
export const AIRSTRIP_ROOM_ID = 'airstrip';

export interface AircraftProfile {
  tier: AircraftTier;
  label: string;
  /**
   * Trip-duration multiplier when the aircraft has a home base.
   * Lower is faster; 1 means no effect.
   */
  basedDurationMultiplier: number;
  /**
   * Trip-duration multiplier with no base — flying commercial fields. Always
   * worse than `based`, never worse than 1 (an aircraft is never a downgrade).
   */
  unbasedDurationMultiplier: number;
  /** Which room addition bases this aircraft. */
  basedBy: typeof HELIPAD_ROOM_ID | typeof AIRSTRIP_ROOM_ID | null;
}

/**
 * The ladder. Numbers chosen so each rung is a real jump and the floor in
 * `transportationMods` (0.25) is never the binding constraint on its own.
 */
const AIRCRAFT_PROFILES: Record<AircraftTier, AircraftProfile> = {
  none: {
    tier: 'none',
    label: 'No aircraft',
    basedDurationMultiplier: 1,
    unbasedDurationMultiplier: 1,
    basedBy: null,
  },
  helicopter: {
    tier: 'helicopter',
    label: 'Helicopter',
    // Short hops: skips the drive and the terminal, but it is not crossing an
    // ocean. A modest, always-useful saving.
    basedDurationMultiplier: 0.75,
    unbasedDurationMultiplier: 0.9,
    basedBy: HELIPAD_ROOM_ID,
  },
  light_jet: {
    tier: 'light_jet',
    label: 'Light Jet',
    basedDurationMultiplier: 0.55,
    unbasedDurationMultiplier: 0.8,
    basedBy: AIRSTRIP_ROOM_ID,
  },
  private_jet: {
    tier: 'private_jet',
    label: 'Private Jet',
    // With your own strip: wheels up when you arrive. This is the payoff for a
    // $65M item plus an $18M runway.
    basedDurationMultiplier: 0.4,
    unbasedDurationMultiplier: 0.7,
    basedBy: AIRSTRIP_ROOM_ID,
  },
};

/** Vehicle-catalog ids that are aircraft, mapped to their tier. */
export const AIRCRAFT_VEHICLE_TIERS: Readonly<Record<string, AircraftTier>> = {
  utility_helicopter: 'helicopter',
  light_jet: 'light_jet',
};

/** The luxury catalog id that grants the top tier. */
export const PRIVATE_JET_LUXURY_ID = 'private_jet';

const TIER_ORDER: AircraftTier[] = ['none', 'helicopter', 'light_jet', 'private_jet'];

/** True when this vehicle id is an aircraft (needs a pilot licence, not a driving one). */
export function isAircraftVehicleId(vehicleId: string | undefined | null): boolean {
  return !!vehicleId && vehicleId in AIRCRAFT_VEHICLE_TIERS;
}

export function getAircraftProfile(tier: AircraftTier): AircraftProfile {
  return AIRCRAFT_PROFILES[tier];
}

function properties(state: GameState | null | undefined): RealEstate[] {
  return Array.isArray(state?.realEstate) ? state!.realEstate! : [];
}

/**
 * Does the player have this room built on ANY property they own?
 *
 * Any owned property counts — an airstrip on the island bases the jet whether
 * or not the island is where they live.
 */
export function hasBaseRoom(state: GameState | null | undefined, roomId: string): boolean {
  return properties(state).some(
    (p) => p?.owned !== false && Array.isArray(p?.rooms) && p.rooms.includes(roomId),
  );
}

/** The best aircraft the player owns, across the vehicle garage and luxury. */
export function getAircraftTier(state: GameState | null | undefined): AircraftTier {
  let best: AircraftTier = 'none';
  const promote = (tier: AircraftTier) => {
    if (TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(best)) best = tier;
  };

  for (const v of Array.isArray(state?.vehicles) ? state!.vehicles! : []) {
    if (!v || v.owned === false) continue;
    const tier = AIRCRAFT_VEHICLE_TIERS[v.id];
    if (tier) promote(tier);
  }

  if ((state?.luxuryItems ?? []).includes(PRIVATE_JET_LUXURY_ID)) promote('private_jet');

  return best;
}

export interface AirTravelStatus {
  tier: AircraftTier;
  profile: AircraftProfile;
  /** Does the aircraft have somewhere of its own to land? */
  based: boolean;
  /** The duration multiplier actually in effect. */
  durationMultiplier: number;
  /** One line for the UI explaining the current state and the next step. */
  summary: string;
}

/**
 * What the player's aircraft is currently doing for their travel.
 *
 * Deliberately reports the UNBASED case as a working aircraft with an upgrade
 * available, not as a failure — a jet with no runway is still a jet.
 */
export function getAirTravelStatus(state: GameState | null | undefined): AirTravelStatus {
  const tier = getAircraftTier(state);
  const profile = AIRCRAFT_PROFILES[tier];

  if (tier === 'none') {
    return {
      tier,
      profile,
      based: false,
      durationMultiplier: 1,
      summary: 'No aircraft. Trips run at ground speed.',
    };
  }

  const based = !!profile.basedBy && hasBaseRoom(state, profile.basedBy);
  const durationMultiplier = based
    ? profile.basedDurationMultiplier
    : profile.unbasedDurationMultiplier;

  const cut = Math.round((1 - durationMultiplier) * 100);
  const summary = based
    ? `${profile.label} based at your own ${profile.basedBy === AIRSTRIP_ROOM_ID ? 'airstrip' : 'helipad'} — trips ${cut}% faster.`
    : `${profile.label} flying out of a commercial field — trips ${cut}% faster. Build ${
        profile.basedBy === AIRSTRIP_ROOM_ID ? 'an airstrip' : 'a helipad'
      } to base it properly.`;

  return { tier, profile, based, durationMultiplier, summary };
}

/** Convenience: the multiplier alone, for `transportationMods`. */
export function airDurationMultiplier(state: GameState | null | undefined): number {
  return getAirTravelStatus(state).durationMultiplier;
}
