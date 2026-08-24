/**
 * Spark conversation engine — the pure logic behind the choice-driven chat.
 *
 * OWNER REPORT (2026-08-17): "I want options instead of typing — ask out for a
 * date, or compliment the person and so on. Make it interesting and interactive
 * and fun."
 *
 * The old chat was a free-text box wired to a personality reply pool: whatever
 * you typed, the NPC said something from a fixed list, nothing about the match
 * changed, and there was no reason to send a second message. This module turns
 * the same thread into a short game with state — a per-match RAPPORT score that
 * every move moves, gates that unlock the bigger moves as it climbs, and
 * cooldowns so the cheapest move cannot be spammed to the top.
 *
 * Everything here is pure. It reads a rapport number, a profile and a couple of
 * player stats and returns what SHOULD happen; committing it atomically is
 * `playConversationOption` in `contexts/game/actions/SparkActions.ts`
 * (CLAUDE.md §4.4 — one updater, re-checked against `prev`).
 *
 * Time is `weeksLived` throughout (CLAUDE.md §4.2). Cooldowns are game weeks,
 * never the cyclic 1-4 `week` and never the wall clock — a device-clock gate is
 * farmable, and this one hands out happiness, rapport and eventually a
 * relationship.
 *
 * Every roll takes an injectable `rand: () => number` so the suite can pin an
 * outcome instead of retrying until it gets one.
 */
import type { SparkMatch } from '@/contexts/game/types';
import {
  OPTION_TONE_AFFINITY,
  VENUE_TONE_AFFINITY,
  fillLine,
  pickFrom,
  resolveNpcPool,
  resolvePlayerPool,
  resolveTone,
  toneAffinity,
  VENUE_LABELS,
} from './conversationContent';

export type SparkConversationOptionId =
  | 'break_ice'
  | 'ask_interests'
  | 'compliment'
  | 'joke'
  | 'flirt'
  | 'ask_date'
  | 'go_steady';

export type SparkDateVenueId = 'coffee' | 'dinner' | 'adventure';

// ─────────────────────────────────────────────────────────────────────
// Rapport
// ─────────────────────────────────────────────────────────────────────

export const RAPPORT_MIN = 0;
export const RAPPORT_MAX = 100;

/**
 * What an ABSENT `rapport` means.
 *
 * `SparkMatch.rapport` is a §7 carve-out (v45): its stored default is
 * `undefined`, so old saves and freshly-swiped matches have no key at all. The
 * baseline is therefore applied at READ time, here, rather than backfilled onto
 * every save — which is also the only honest answer, since a save written
 * before this feature has no record of how those chats went.
 *
 * 20 is deliberately low: you matched, you have not spoken. It puts `flirt`
 * (25) one good move away and leaves `ask_date` (45) and `go_steady` (75) as
 * things you have to actually work toward.
 */
export const FRESH_MATCH_RAPPORT = 20;

/**
 * A super-like is the other person going first, so the chat does not start from
 * a standing stop. Applied at read time for the same reason as the baseline.
 */
export const SUPER_LIKE_RAPPORT_BONUS = 10;

export function clampRapport(value: number): number {
  if (typeof value !== 'number' || !isFinite(value)) return FRESH_MATCH_RAPPORT;
  return Math.max(RAPPORT_MIN, Math.min(RAPPORT_MAX, Math.round(value)));
}

/** Current rapport for a match — the single reader, absent key included. */
export function readRapport(match: Pick<SparkMatch, 'rapport' | 'superLiked'> | undefined): number {
  if (!match) return FRESH_MATCH_RAPPORT;
  if (typeof match.rapport === 'number' && isFinite(match.rapport)) return clampRapport(match.rapport);
  return clampRapport(FRESH_MATCH_RAPPORT + (match.superLiked ? SUPER_LIKE_RAPPORT_BONUS : 0));
}

/** A coarse band, for the header bar's label. */
export function rapportBand(rapport: number): 'strangers' | 'warming up' | 'clicking' | 'into you' | 'smitten' {
  if (rapport < 25) return 'strangers';
  if (rapport < 45) return 'warming up';
  if (rapport < 65) return 'clicking';
  if (rapport < 85) return 'into you';
  return 'smitten';
}

// ─────────────────────────────────────────────────────────────────────
// The option catalog
// ─────────────────────────────────────────────────────────────────────

export interface SparkConversationOption {
  id: SparkConversationOptionId;
  label: string;
  /** lucide-react-native icon name — resolved by the UI, kept out of lib/. */
  icon: string;
  /** One line of "what this move is", shown on the disabled state as a goal. */
  blurb: string;
  energyCost: number;
  /** Rapport needed before the option is offered at all. */
  minRapport: number;
  /**
   * Game weeks before the option can be played again. Every option has one, and
   * it is load-bearing twice over: it stops Compliment being tapped ten times to
   * ratchet rapport, and — because the cooldown is stamped in the SAME updater
   * that charges — it is what makes a same-batch double tap charge once.
   */
  cooldownWeeks: number;
  rapportOnSuccess: number;
  rapportOnMiss: number;
  /** Flat modifier on the success roll — how forgiving the move is by nature. */
  baseChanceBonus: number;
  /** Only offered while the thread has no messages yet. */
  freshChatOnly?: boolean;
  /** Hidden once the match has been promoted into a relationship. */
  unpromotedOnly?: boolean;
  /** Needs a venue sub-choice before it can be played. */
  requiresVenue?: boolean;
}

export const SPARK_CONVERSATION_OPTIONS: readonly SparkConversationOption[] = [
  {
    id: 'break_ice',
    label: 'Break the ice',
    icon: 'Sparkles',
    blurb: 'Open with something that is not "hey".',
    energyCost: 2,
    minRapport: 0,
    cooldownWeeks: 1,
    rapportOnSuccess: 8,
    rapportOnMiss: 2,
    baseChanceBonus: 0.12,
    freshChatOnly: true,
  },
  {
    id: 'ask_interests',
    label: 'Ask about them',
    icon: 'MessageCircle',
    blurb: 'Pull on something from their profile. Cheap, safe, always works a little.',
    energyCost: 2,
    minRapport: 0,
    cooldownWeeks: 1,
    rapportOnSuccess: 7,
    rapportOnMiss: 2,
    baseChanceBonus: 0.08,
  },
  {
    id: 'compliment',
    label: 'Compliment',
    icon: 'Star',
    blurb: 'Say the nice thing out loud. Lands badly if it reads rehearsed.',
    energyCost: 3,
    minRapport: 0,
    cooldownWeeks: 1,
    rapportOnSuccess: 6,
    rapportOnMiss: -2,
    baseChanceBonus: 0.04,
  },
  {
    id: 'joke',
    label: 'Tell a joke',
    icon: 'Laugh',
    blurb: 'High variance. Brilliant with the right person, silence with the wrong one.',
    energyCost: 3,
    minRapport: 10,
    cooldownWeeks: 1,
    rapportOnSuccess: 9,
    rapportOnMiss: -3,
    baseChanceBonus: 0,
  },
  {
    id: 'flirt',
    label: 'Flirt',
    icon: 'Flame',
    blurb: 'Turn the temperature up. Too early and it is an awkward miss.',
    energyCost: 4,
    minRapport: 25,
    cooldownWeeks: 1,
    rapportOnSuccess: 11,
    rapportOnMiss: -6,
    baseChanceBonus: -0.04,
  },
  {
    id: 'ask_date',
    label: 'Ask on a date',
    icon: 'CalendarHeart',
    blurb: 'Pick a venue and put real money behind it.',
    energyCost: 3,
    minRapport: 45,
    cooldownWeeks: 2,
    rapportOnSuccess: 0, // supplied by the venue
    rapportOnMiss: 0,
    baseChanceBonus: -0.02,
    requiresVenue: true,
  },
  {
    id: 'go_steady',
    label: 'Ask to go steady',
    icon: 'Heart',
    blurb: 'Make it official. They have to be genuinely into you first.',
    energyCost: 5,
    minRapport: 75,
    cooldownWeeks: 1,
    rapportOnSuccess: 10,
    rapportOnMiss: -5,
    baseChanceBonus: 0.05,
    unpromotedOnly: true,
  },
];

export function findConversationOption(
  id: string | undefined,
): SparkConversationOption | undefined {
  return SPARK_CONVERSATION_OPTIONS.find((o) => o.id === id);
}

/**
 * The one option that takes a sub-choice. Looked up by ID rather than by array
 * index so reordering the catalog cannot silently re-point it at `flirt`.
 */
const ASK_DATE_OPTION: SparkConversationOption =
  SPARK_CONVERSATION_OPTIONS.find((o) => o.id === 'ask_date') ?? SPARK_CONVERSATION_OPTIONS[0];

// ─────────────────────────────────────────────────────────────────────
// Date venues
// ─────────────────────────────────────────────────────────────────────

export interface SparkDateVenue {
  id: SparkDateVenueId;
  label: string;
  icon: string;
  blurb: string;
  /** In-game dollars, charged atomically with everything else. */
  cashCost: number;
  /** Added on top of `ask_date`'s own energy cost. */
  energyCost: number;
  rapportOnSuccess: number;
  rapportOnMiss: number;
  happinessOnSuccess: number;
  happinessOnMiss: number;
}

export const SPARK_DATE_VENUES: readonly SparkDateVenue[] = [
  {
    id: 'coffee',
    label: 'Coffee',
    icon: 'Coffee',
    blurb: 'Cheap, low stakes, hard to ruin.',
    cashCost: 25,
    energyCost: 1,
    rapportOnSuccess: 10,
    rapportOnMiss: -3,
    happinessOnSuccess: 2,
    happinessOnMiss: -1,
  },
  {
    id: 'dinner',
    label: 'Dinner',
    icon: 'UtensilsCrossed',
    blurb: 'A whole evening. Costs more, means more.',
    cashCost: 120,
    energyCost: 2,
    rapportOnSuccess: 15,
    rapportOnMiss: -6,
    happinessOnSuccess: 4,
    happinessOnMiss: -2,
  },
  {
    id: 'adventure',
    label: 'Something reckless',
    icon: 'Mountain',
    blurb: 'Expensive, exhausting, unforgettable either way.',
    cashCost: 300,
    energyCost: 4,
    rapportOnSuccess: 20,
    rapportOnMiss: -9,
    happinessOnSuccess: 7,
    happinessOnMiss: -3,
  },
];

export function findDateVenue(id: string | undefined): SparkDateVenue | undefined {
  return SPARK_DATE_VENUES.find((v) => v.id === id);
}

/** The cheapest date on the board — what `ask_date`'s affordability gate uses. */
export const CHEAPEST_DATE_COST = SPARK_DATE_VENUES.reduce(
  (min, v) => Math.min(min, v.cashCost),
  Number.POSITIVE_INFINITY,
);

// ─────────────────────────────────────────────────────────────────────
// Availability
// ─────────────────────────────────────────────────────────────────────

export interface ConversationGateInput {
  rapport: number;
  energy: number;
  money: number;
  weeksLived: number;
  cooldowns?: Record<string, number>;
  /** Messages already in this thread — drives the `break_ice` gate. */
  messageCount: number;
  promoted: boolean;
  /**
   * WHAT the match was promoted into, when it was. Purely for the refusal copy
   * on an `unpromotedOnly` option, and passed in rather than derived because
   * this module is pure and does not see `GameState.relationships`.
   *
   * It matters because the two cases read completely differently to a player.
   * Befriending sets the same `promoted` flag a partner promotion does, so
   * `go_steady` used to disappear behind "Already in your contacts" — which
   * reads as a bug when the person is a friend and the player never chose to
   * close the romance off. `undefined` keeps the old generic wording for a
   * caller that cannot tell (a promoted match whose relationship is gone).
   */
  promotedAs?: 'partner' | 'friend';
}

/** Why an `unpromotedOnly` option is gone, in the player's terms. */
export function promotedReason(promotedAs: 'partner' | 'friend' | undefined): string {
  if (promotedAs === 'friend') return 'You made this one a friend';
  if (promotedAs === 'partner') return "You're already together";
  return 'Already in your contacts';
}

export interface ConversationOptionAvailability {
  option: SparkConversationOption;
  available: boolean;
  /** Why not — shown on the chip, because a visible gate is a goal. */
  reason?: string;
  /** False when the option should not be rendered at all (not merely disabled). */
  visible: boolean;
  /** Total energy this option costs at its cheapest configuration. */
  energyCost: number;
  /** Cash at the cheapest configuration; 0 for everything but `ask_date`. */
  cashCost: number;
}

/** Weeks until `optionId` comes off cooldown; 0 when it is ready. */
export function cooldownRemaining(
  option: SparkConversationOption,
  cooldowns: Record<string, number> | undefined,
  weeksLived: number,
): number {
  const last = cooldowns?.[option.id];
  if (typeof last !== 'number' || !isFinite(last)) return 0;
  const ready = last + option.cooldownWeeks;
  return Math.max(0, ready - weeksLived);
}

export function resolveOptionAvailability(
  option: SparkConversationOption,
  input: ConversationGateInput,
): ConversationOptionAvailability {
  const energyCost =
    option.energyCost +
    (option.requiresVenue
      ? SPARK_DATE_VENUES.reduce((min, v) => Math.min(min, v.energyCost), Number.POSITIVE_INFINITY)
      : 0);
  const cashCost = option.requiresVenue ? CHEAPEST_DATE_COST : 0;

  const base: ConversationOptionAvailability = {
    option,
    available: false,
    visible: true,
    energyCost,
    cashCost,
  };

  if (option.unpromotedOnly && input.promoted) {
    return { ...base, visible: false, reason: promotedReason(input.promotedAs) };
  }
  if (option.freshChatOnly && input.messageCount > 0) {
    return { ...base, visible: false, reason: 'The ice is already broken' };
  }
  if (input.rapport < option.minRapport) {
    return { ...base, reason: `Needs ${option.minRapport} rapport` };
  }
  const cd = cooldownRemaining(option, input.cooldowns, input.weeksLived);
  if (cd > 0) {
    return { ...base, reason: cd === 1 ? 'Ready next week' : `Ready in ${cd} weeks` };
  }
  if (input.energy < energyCost) {
    return { ...base, reason: `Needs ${energyCost} energy` };
  }
  if (cashCost > 0 && input.money < cashCost) {
    return { ...base, reason: `Needs $${cashCost.toLocaleString()}` };
  }
  return { ...base, available: true };
}

/** Every option, in catalog order, with its gate resolved. */
export function listConversationOptions(
  input: ConversationGateInput,
): ConversationOptionAvailability[] {
  return SPARK_CONVERSATION_OPTIONS.map((o) => resolveOptionAvailability(o, input));
}

/** Venue rows for the sub-choice, with their own affordability resolved. */
export interface VenueAvailability {
  venue: SparkDateVenue;
  available: boolean;
  reason?: string;
  energyCost: number;
  cashCost: number;
}

export function listDateVenues(
  input: Pick<ConversationGateInput, 'energy' | 'money'>,
  option: SparkConversationOption = ASK_DATE_OPTION,
): VenueAvailability[] {
  return SPARK_DATE_VENUES.map((venue) => {
    const energyCost = option.energyCost + venue.energyCost;
    if (input.money < venue.cashCost) {
      return { venue, available: false, reason: `Needs $${venue.cashCost.toLocaleString()}`, energyCost, cashCost: venue.cashCost };
    }
    if (input.energy < energyCost) {
      return { venue, available: false, reason: `Needs ${energyCost} energy`, energyCost, cashCost: venue.cashCost };
    }
    return { venue, available: true, energyCost, cashCost: venue.cashCost };
  });
}

// ─────────────────────────────────────────────────────────────────────
// Outcome resolution
// ─────────────────────────────────────────────────────────────────────

/**
 * How appealing the player currently is, 0..1.
 *
 * Deliberately built from stats that ACTUALLY exist on `GameStats`
 * (health/happiness/energy/fitness/money/reputation/gems) rather than an
 * invented "charisma" field - an invented name compiles, reads `undefined` and
 * silently disables half the formula, which is the exact bug class CLAUDE.md §5
 * describes. Happiness carries the most weight (you are better company when you
 * are not miserable), then reputation, then fitness.
 */
export function playerAppeal(stats: {
  happiness?: number;
  fitness?: number;
  reputation?: number;
} | undefined): number {
  const clamp01to100 = (v: number | undefined): number => {
    if (typeof v !== 'number' || !isFinite(v)) return 50;
    return Math.max(0, Math.min(100, v));
  };
  const happiness = clamp01to100(stats?.happiness);
  const reputation = clamp01to100(stats?.reputation);
  const fitness = clamp01to100(stats?.fitness);
  return (happiness * 0.45 + reputation * 0.3 + fitness * 0.25) / 100;
}

export interface ConversationResolveInput {
  optionId: SparkConversationOptionId;
  venueId?: SparkDateVenueId;
  rapport: number;
  /** The match's dating profile. Only the fields the copy actually uses. */
  profile: { name: string; personality: string; interests?: string[] };
  /** 0..1 from `playerAppeal`. */
  appeal: number;
  /** Injected for determinism; live callers pass `Math.random`. */
  rand?: () => number;
}

export interface SparkConversationResolution {
  optionId: SparkConversationOptionId;
  venueId?: SparkDateVenueId;
  success: boolean;
  /** 0..1, exposed so the UI/tests can reason about the gate rather than guess. */
  successChance: number;
  playerText: string;
  npcText: string;
  rapportBefore: number;
  rapportAfter: number;
  rapportDelta: number;
  energyCost: number;
  cashCost: number;
  happinessDelta: number;
  /** True for a completed date - drives `lifetimeStats.totalDatesGoneOn`. */
  countsAsDate: boolean;
}

/**
 * Chance the move lands.
 *
 *   0.35 + 0.40 x (rapport/100)   the dominant term - rapport IS the game
 * + 0.15 x (appeal - 0.5) x 2     the player's own state, worth +/-0.15
 * + personality fit               -0.09 … +0.14, and +/- again for the venue
 * + the option's own base bonus
 *
 * Clamped to 0.05..0.95 so nothing is ever a certainty in either direction.
 */
export function successChanceFor(input: {
  option: SparkConversationOption;
  venue?: SparkDateVenue;
  rapport: number;
  personality: string;
  appeal: number;
}): number {
  const tone = resolveTone(input.personality);
  const rapport = clampRapport(input.rapport);
  const appeal = typeof input.appeal === 'number' && isFinite(input.appeal)
    ? Math.max(0, Math.min(1, input.appeal))
    : 0.5;

  let chance = 0.35 + 0.4 * (rapport / 100);
  chance += 0.15 * (appeal - 0.5) * 2;
  chance += toneAffinity(OPTION_TONE_AFFINITY[input.option.id], tone);
  chance += input.option.baseChanceBonus;
  if (input.venue) {
    chance += toneAffinity(VENUE_TONE_AFFINITY[input.venue.id], tone);
  }
  return Math.max(0.05, Math.min(0.95, chance));
}

/**
 * Resolve one played option into everything that should happen.
 *
 * Called OUTSIDE the `setGameState` updater (the updater must stay pure and may
 * run twice), then committed inside it. A resolution whose commit is rejected -
 * a same-batch double tap hitting the cooldown re-check - is simply discarded.
 */
export function resolveConversationOption(
  input: ConversationResolveInput,
): SparkConversationResolution | null {
  const option = findConversationOption(input.optionId);
  if (!option) return null;
  const venue = option.requiresVenue ? findDateVenue(input.venueId) : undefined;
  if (option.requiresVenue && !venue) return null;

  const rand = typeof input.rand === 'function' ? input.rand : Math.random;
  const rapportBefore = clampRapport(input.rapport);
  const tone = resolveTone(input.profile.personality);

  const successChance = successChanceFor({
    option,
    venue,
    rapport: rapportBefore,
    personality: input.profile.personality,
    appeal: input.appeal,
  });

  const outcomeRoll = rand();
  const success = (typeof outcomeRoll === 'number' && isFinite(outcomeRoll) ? outcomeRoll : 0.5) < successChance;

  const rapportDelta = venue
    ? success
      ? venue.rapportOnSuccess
      : venue.rapportOnMiss
    : success
      ? option.rapportOnSuccess
      : option.rapportOnMiss;
  const rapportAfter = clampRapport(rapportBefore + rapportDelta);

  const interests = Array.isArray(input.profile.interests) ? input.profile.interests.filter(Boolean) : [];
  const interestRoll = rand();
  const interest = interests.length > 0
    ? String(interests[Math.floor(Math.max(0, Math.min(0.999999, interestRoll)) * interests.length)] ?? interests[0]).toLowerCase()
    : 'whatever it is you are into';

  const tokens = {
    first: (input.profile.name || 'they').split(' ')[0],
    name: input.profile.name || 'they',
    interest,
    venue: venue ? VENUE_LABELS[venue.id] ?? venue.label.toLowerCase() : 'it',
  };

  const playerText = fillLine(pickFrom(resolvePlayerPool(option.id, venue?.id), rand()), tokens);
  const npcText = fillLine(
    pickFrom(resolveNpcPool(option.id, success ? 'success' : 'miss', tone), rand()),
    tokens,
  );

  return {
    optionId: option.id,
    venueId: venue?.id,
    success,
    successChance,
    playerText,
    npcText,
    rapportBefore,
    rapportAfter,
    // Report the CLAMPED movement, so a caller adding this to a stored value
    // cannot push rapport outside 0-100 by re-deriving it.
    rapportDelta: rapportAfter - rapportBefore,
    energyCost: option.energyCost + (venue?.energyCost ?? 0),
    cashCost: venue?.cashCost ?? 0,
    happinessDelta: venue ? (success ? venue.happinessOnSuccess : venue.happinessOnMiss) : 0,
    // The date HAPPENED either way - you paid, you went, it went badly. That is
    // still a date for `totalDatesGoneOn`.
    countsAsDate: Boolean(venue),
  };
}
