/**
 * Hosting — the collection becomes a social life.
 *
 * Phase 5 of docs/LUXURY_DEPTH_ROADMAP.md. Audits B3/B4/B5: luxury was
 * invisible to the rest of the game's world. You could own a $120M island and
 * never have anyone on it.
 *
 * THE IDEA
 * --------
 * Some trophies are VENUES. Throw something on one and it costs money, moves
 * reputation, and — the part that matters — moves your actual relationships,
 * because the people who came are people you know.
 *
 * WHO COMES IS THE COLLECTION
 * ---------------------------
 * This is where "luxury-gated invitations" lives, without a separate invitation
 * system. The rest of what you own decides which circles turn up: the art
 * collection brings collectors and curators, the racehorse brings the racing
 * set, the team stake brings athletes and executives. A bigger collection is a
 * better guest list, so every unrelated trophy quietly improves every party.
 *
 * That means the collection finally has INTERNAL synergy — the first thing in
 * this feature where owning two things is worth more than owning them apart.
 *
 * Pure module: no React, no state mutation, no RNG of its own.
 */

import type { GameState } from '@/contexts/game/types';
import { getCollectionHostingMultiplier } from './collections';

/** A luxury item you can hold an event at. */
export interface HostingVenue {
  itemId: string;
  /** How the venue is described in the event copy. */
  label: string;
  /** Multiplies the cost and the payoff. A mega-yacht is not a dinner party. */
  scale: number;
}

export const HOSTING_VENUES: readonly HostingVenue[] = [
  { itemId: 'luxury_yacht', label: 'aboard the yacht', scale: 1 },
  { itemId: 'trophy_penthouse', label: 'at the penthouse', scale: 1.3 },
  { itemId: 'mega_yacht', label: 'aboard the mega-yacht', scale: 1.8 },
  { itemId: 'private_island', label: 'on the island', scale: 2.2 },
] as const;

/** Event size. Bigger costs more and reaches further. */
export type EventTier = 'dinner' | 'party' | 'gala';

export interface EventTierSpec {
  tier: EventTier;
  label: string;
  /** Base cost before the venue multiplier. */
  baseCost: number;
  /** Base reputation before venue and guest-list multipliers. */
  baseReputation: number;
  baseHappiness: number;
  /** How many relationships get a boost. */
  guestsReached: number;
}

export const EVENT_TIERS: readonly EventTierSpec[] = [
  {
    tier: 'dinner',
    label: 'Private dinner',
    baseCost: 40_000,
    baseReputation: 2,
    baseHappiness: 4,
    guestsReached: 2,
  },
  {
    tier: 'party',
    label: 'Party',
    baseCost: 150_000,
    baseReputation: 5,
    baseHappiness: 7,
    guestsReached: 5,
  },
  {
    tier: 'gala',
    label: 'Charity gala',
    baseCost: 600_000,
    baseReputation: 11,
    baseHappiness: 9,
    guestsReached: 9,
  },
] as const;

/** Weeks before another event can be held. Scarcity is what keeps it an event. */
export const HOSTING_COOLDOWN_WEEKS = 6;

const VENUE_BY_ID = new Map(HOSTING_VENUES.map((v) => [v.itemId, v]));

export function getHostingVenue(itemId: string): HostingVenue | undefined {
  return VENUE_BY_ID.get(itemId);
}

export function isHostingVenue(itemId: string): boolean {
  return VENUE_BY_ID.has(itemId);
}

export function getEventTier(tier: string): EventTierSpec | undefined {
  return EVENT_TIERS.find((t) => t.tier === tier);
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Which circles your collection brings through the door.
 *
 * Each entry is both flavour and a multiplier: a guest list of collectors,
 * racing people and athletes is worth more than three friends and a cousin.
 */
const GUEST_SOURCES: readonly { itemId: string; circle: string }[] = [
  { itemId: 'fine_art_collection', circle: 'collectors and a curator' },
  { itemId: 'rare_watch_collection', circle: 'a few serious collectors' },
  { itemId: 'museum_diamond', circle: 'a museum board member' },
  { itemId: 'racehorse', circle: 'the racing set' },
  { itemId: 'supercar', circle: 'the car crowd' },
  { itemId: 'vineyard_estate', circle: 'winemakers' },
  { itemId: 'sports_team_stake', circle: 'athletes and executives' },
  { itemId: 'private_jet', circle: 'people who flew in for it' },
];

export interface GuestList {
  /** Circles present, drawn from the rest of the collection. */
  circles: string[];
  /**
   * Multiplier on reputation and relationship gain, 1.0 with no interesting
   * guests, rising with the breadth of the collection. Capped so a full
   * collection is a great party, not an infinite one.
   */
  multiplier: number;
  /** One line naming who turned up. */
  summary: string;
}

export function getGuestList(state: GameState | null | undefined): GuestList {
  const owned = new Set(state?.luxuryItems ?? []);
  const circles = GUEST_SOURCES.filter((g) => owned.has(g.itemId)).map((g) => g.circle);
  // +12% per circle, capped at +60%. A broad collection is a better room.
  // NOTE: this stays purely about WHO TURNS UP, and its +60% ceiling is a
  // documented invariant with a test. Completed-collection standing is a
  // separate concept and is applied in `quoteEvent`, not folded in here.
  const multiplier = 1 + Math.min(0.6, circles.length * 0.12);
  const summary =
    circles.length === 0
      ? 'Your usual crowd.'
      : `Your usual crowd, plus ${circles.slice(0, 3).join(', ')}${circles.length > 3 ? ', and more' : ''}.`;
  return { circles, multiplier, summary };
}

export interface HostingQuote {
  venue: HostingVenue;
  spec: EventTierSpec;
  guests: GuestList;
  cost: number;
  reputation: number;
  happiness: number;
  guestsReached: number;
}

/** What an event would cost and give, before it is committed. */
export function quoteEvent(
  state: GameState | null | undefined,
  itemId: string,
  tier: string,
): HostingQuote | null {
  const venue = getHostingVenue(itemId);
  const spec = getEventTier(tier);
  if (!venue || !spec) return null;

  const guests = getGuestList(state);
  // Completed collections raise the STANDING of the host, not the guest list —
  // so the bonus lands on the payoff here rather than being folded into
  // `guests.multiplier` (whose +60% ceiling is its own documented invariant).
  // Its own product is capped at 2.0, so the combined ceiling stays bounded.
  const standing = getCollectionHostingMultiplier(state?.luxuryItems);
  return {
    venue,
    spec,
    guests,
    // Cost is deliberately NOT scaled by standing: a set bonus must not make
    // entertaining more expensive, or completing a collection would read as a
    // punishment.
    cost: Math.round(spec.baseCost * venue.scale),
    reputation: Math.round(spec.baseReputation * venue.scale * guests.multiplier * standing),
    happiness: Math.round(spec.baseHappiness * guests.multiplier * standing),
    guestsReached: spec.guestsReached,
  };
}

export interface HostingAvailability {
  available: boolean;
  reason?: string;
  weeksRemaining: number;
}

/**
 * Can an event be held at this venue right now?
 *
 * The cooldown is per-venue rather than global, so a player who owns both the
 * island and the penthouse has two places to entertain — which is a genuine
 * reason to own both.
 */
export function getHostingAvailability(
  state: GameState | null | undefined,
  itemId: string,
  tier: string,
): HostingAvailability {
  const quote = quoteEvent(state, itemId, tier);
  if (!quote) return { available: false, reason: 'Not a venue.', weeksRemaining: 0 };

  if (!(state?.luxuryItems ?? []).includes(itemId)) {
    return { available: false, reason: 'You do not own this.', weeksRemaining: 0 };
  }

  const holding = state?.luxuryHoldings?.[itemId];
  const week = num(state?.weeksLived);
  const last = holding?.lastHostedWeek;
  const elapsed = last === undefined ? Infinity : week - num(last);
  const weeksRemaining = Math.max(0, Math.ceil(HOSTING_COOLDOWN_WEEKS - elapsed));
  if (weeksRemaining > 0) {
    return {
      available: false,
      reason: `You can host again in ${weeksRemaining} week${weeksRemaining === 1 ? '' : 's'}.`,
      weeksRemaining,
    };
  }

  if (num(state?.stats?.money) < quote.cost) {
    return {
      available: false,
      reason: `A ${quote.spec.label.toLowerCase()} here costs $${quote.cost.toLocaleString()}.`,
      weeksRemaining: 0,
    };
  }

  return { available: true, weeksRemaining: 0 };
}

/** Ids of the relationships an event should warm, best-connected first. */
export function pickAttendees(
  state: GameState | null | undefined,
  count: number,
): string[] {
  const relationships = Array.isArray(state?.relationships) ? state!.relationships : [];
  return relationships
    .filter((r) => r && typeof r.id === 'string' && r.type !== 'child')
    // Warm the people you are already closest to — a party is not how you meet
    // your estranged father, it is where your circle gets tighter.
    .slice()
    .sort((a, b) => num(b.relationshipScore) - num(a.relationshipScore))
    .slice(0, Math.max(0, count))
    .map((r) => r.id);
}

export interface HostingOutcome {
  cost: number;
  reputation: number;
  happiness: number;
  /** Relationship ids to warm, and by how much. */
  attendeeIds: string[];
  relationshipGain: number;
  message: string;
}

/** Resolve an event. No roll — a party you paid for happens. */
export function resolveEvent(quote: HostingQuote, attendeeIds: string[]): HostingOutcome {
  return {
    cost: quote.cost,
    reputation: quote.reputation,
    happiness: quote.happiness,
    attendeeIds,
    // Scales with the room: a gala full of interesting people does more for a
    // friendship than a quiet dinner.
    relationshipGain: Math.max(1, Math.round(3 * quote.venue.scale * quote.guests.multiplier)),
    message: `${quote.spec.label} ${quote.venue.label}. ${quote.guests.summary}`,
  };
}
