/**
 * Scooter rentals — the first rung of the transport ladder.
 *
 * THE GAP THIS FILLS
 * ------------------
 * Delivery work ("Delivery Cycle", $180/run) is the best early gig in the game
 * and it is gated on owning a `bike` — a $450 item against a $200 starting
 * wallet. The cheapest car is $15,000 and needs a driver's licence. So for the
 * first stretch of a life there is a job the player can see, wants, and simply
 * cannot reach: the only route in is to save up for a purchase.
 *
 * A rental fixes that shape. Renting is cheap to START and expensive to KEEP —
 * the opposite curve to buying — so it is exactly the right instrument for a
 * broke character: unlock the work now, pay for it out of the work, and buy
 * your way off the rental once the work pays for a bike or a car.
 *
 * WHY IT IS BUILT ON THE VEHICLE SYSTEM
 * -------------------------------------
 * An active rental is a `Vehicle` with `weeklyMaintenanceCost` set to the
 * rental fee. That is not a workaround — the weekly tick already bills every
 * owned vehicle's weekly cost and already lapses players who cannot pay, so a
 * rental gets correct recurring billing, correct cancellation, and correct
 * interaction with going broke for free, with no new GameState field and no
 * save migration. `endRental` is the ordinary remove path.
 *
 * The one thing rentals do NOT reuse is `purchaseVehicle`, which demands a
 * driver's licence and rejects a zero price. Both are right for cars and wrong
 * here: needing no licence is precisely why a scooter is the starter option.
 *
 * Pure module — no React, no state mutation, no RNG.
 */

import type { GameState, Vehicle } from '@/contexts/game/types';

/** Ordered worst → best. The tier decides what delivery work pays. */
export type TransportTier = 'none' | 'scooter' | 'bike' | 'moped' | 'car';

export interface ScooterRentalPlan {
  id: string;
  name: string;
  /** Flavour for the rental card. */
  blurb: string;
  /** Billed every week by the ordinary vehicle weekly tick. */
  weeklyPrice: number;
  /** Charged once, on signing. Kept small — the point is a low barrier. */
  signupFee: number;
  tier: Extract<TransportTier, 'scooter' | 'moped'>;
}

/**
 * Rentable transport, cheapest first.
 *
 * Prices are set against the delivery gig they unlock ($180 a run, ~1 run a
 * week early on): the basic pass costs about a tenth of one run, so a player
 * who actually works it is clearly ahead, while a player who rents and then
 * doesn't deliver bleeds money. That is the tension worth having — a rental
 * you forget to use should hurt a little.
 */
export const SCOOTER_RENTAL_PLANS: readonly ScooterRentalPlan[] = [
  {
    id: 'scooter_rental_basic',
    name: 'City Scooter Pass',
    blurb: 'Unlock one at the kerb, ride it, leave it. No licence, no deposit.',
    weeklyPrice: 18,
    signupFee: 5,
    tier: 'scooter',
  },
  {
    id: 'scooter_rental_pro',
    name: 'Unlimited Scooter Pass',
    blurb: 'Priority unlocks and the long-range models. Built for people who ride all day.',
    weeklyPrice: 34,
    signupFee: 10,
    tier: 'scooter',
  },
  {
    id: 'moped_rental',
    name: 'Moped Lease',
    blurb: 'A real seat, a top box, and enough range to take the far drops.',
    weeklyPrice: 75,
    signupFee: 40,
    tier: 'moped',
  },
] as const;

const PLAN_BY_ID = new Map(SCOOTER_RENTAL_PLANS.map((p) => [p.id, p]));

export function getRentalPlan(planId: string): ScooterRentalPlan | undefined {
  return PLAN_BY_ID.get(planId);
}

/** True when this vehicle id is a rental rather than something owned outright. */
export function isRentalVehicleId(vehicleId: string): boolean {
  return PLAN_BY_ID.has(vehicleId);
}

export interface TransportProfile {
  tier: TransportTier;
  /** Multiplier applied to delivery-gig payment. */
  deliveryMultiplier: number;
  /** Energy a delivery run costs at this tier. Better transport, less effort. */
  energyPerRun: number;
  /** Player-facing name of what they're riding/driving. */
  label: string;
}

/**
 * Tier table. The gradient is the progression: renting a scooter roughly halves
 * the wait to delivery work, owning a bike beats renting outright (rent is a
 * bridge, not a destination), and a car is the end of the line.
 */
const TRANSPORT_PROFILES: Record<TransportTier, TransportProfile> = {
  none: { tier: 'none', deliveryMultiplier: 0, energyPerRun: 0, label: 'On foot' },
  scooter: { tier: 'scooter', deliveryMultiplier: 0.7, energyPerRun: 26, label: 'Rented scooter' },
  bike: { tier: 'bike', deliveryMultiplier: 1, energyPerRun: 30, label: 'Your own bike' },
  moped: { tier: 'moped', deliveryMultiplier: 1.35, energyPerRun: 22, label: 'Leased moped' },
  car: { tier: 'car', deliveryMultiplier: 1.8, energyPerRun: 18, label: 'Your own car' },
};

const TIER_ORDER: TransportTier[] = ['none', 'scooter', 'bike', 'moped', 'car'];

function ownsItem(state: GameState | null | undefined, itemId: string): boolean {
  return !!(state?.items ?? []).find((i) => i?.id === itemId)?.owned;
}

function vehicles(state: GameState | null | undefined): Vehicle[] {
  return Array.isArray(state?.vehicles) ? state!.vehicles! : [];
}

/** The rental currently active, if any. At most one is ever held. */
export function getActiveRental(
  state: GameState | null | undefined
): { vehicle: Vehicle; plan: ScooterRentalPlan } | null {
  for (const v of vehicles(state)) {
    const plan = v?.id ? PLAN_BY_ID.get(v.id) : undefined;
    if (plan) return { vehicle: v, plan };
  }
  return null;
}

/**
 * The best transport the player currently has.
 *
 * Owned always beats rented at the same tier, which is what keeps a rental
 * feeling like a bridge: the moment the bike is bought, the scooter pass is
 * pure cost and the player should cancel it. `getRentalAdvice` says so.
 */
export function getTransportTier(state: GameState | null | undefined): TransportTier {
  let best: TransportTier = 'none';
  const promote = (tier: TransportTier) => {
    if (TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(best)) best = tier;
  };

  if (ownsItem(state, 'bike')) promote('bike');

  for (const v of vehicles(state)) {
    if (!v || v.owned === false) continue;
    const plan = PLAN_BY_ID.get(v.id);
    if (plan) {
      promote(plan.tier);
      continue;
    }
    if (v.type === 'car') promote('car');
    else if (v.type === 'motorcycle') promote('moped');
    else if (v.type === 'bicycle') promote('bike');
  }

  return best;
}

export function getTransportProfile(state: GameState | null | undefined): TransportProfile {
  return TRANSPORT_PROFILES[getTransportTier(state)];
}

/** Can the player take delivery work at all? */
export function canDoDeliveryWork(state: GameState | null | undefined): boolean {
  return getTransportTier(state) !== 'none';
}

/**
 * What a delivery run actually pays and costs, given what they're riding.
 * Returns null when the player has no transport — the gig is not available.
 */
export function getDeliveryTerms(
  state: GameState | null | undefined,
  basePayment: number
): { payment: number; energyCost: number; profile: TransportProfile } | null {
  const profile = getTransportProfile(state);
  if (profile.tier === 'none') return null;
  const base = typeof basePayment === 'number' && Number.isFinite(basePayment) ? basePayment : 0;
  return {
    payment: Math.max(0, Math.round(base * profile.deliveryMultiplier)),
    energyCost: profile.energyPerRun,
    profile,
  };
}

/**
 * A nudge for the rental card. A rental the player has outgrown is the one
 * genuinely bad state this system can reach — it is pure weekly cost for a tier
 * they already beat — so it gets called out explicitly rather than left for the
 * player to notice on their bank statement.
 */
export function getRentalAdvice(state: GameState | null | undefined): string | null {
  const active = getActiveRental(state);
  if (!active) return null;
  const tier = getTransportTier(state);
  if (TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(active.plan.tier)) {
    return `You've outgrown this — ${TRANSPORT_PROFILES[tier].label.toLowerCase()} beats it. End the rental to stop paying $${active.plan.weeklyPrice}/wk.`;
  }
  return null;
}

/** Total weekly cost of the active rental (0 when none). */
export function getRentalWeeklyCost(state: GameState | null | undefined): number {
  return getActiveRental(state)?.plan.weeklyPrice ?? 0;
}
