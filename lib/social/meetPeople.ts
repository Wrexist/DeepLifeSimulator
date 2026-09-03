/**
 * Meeting people — the tier-1 way somebody new enters a life.
 *
 * ## The gap this closes
 *
 * A repo-wide search for producers of a `Relationship` finds exactly three:
 * `promoteMatchToRelationship` and `promoteMatchToFriend` (both Spark, which
 * unlocks at **tier 2**), and the `intro` favour, which `FAVOR_KIND_BY_CONTACT`
 * only offers on a `business` contact — a travel contact, tier 3. A player at
 * tier 1 has the two seeded parents from `initialState` and no way to meet
 * anybody at all, for the fifteen-odd weeks it takes to finish Chapter 2.
 *
 * The chapter spine already documents the consequence: `ch2_make_friend`
 * deliberately counts the starting parents, "because Spark is the only route,
 * and finishing chapter 2 is what UNLOCKS Spark" — so the tutorial chapter's
 * social goal is complete on frame one and pays its reward for nothing. The
 * comment ends: "Making it a real goal means shipping a visible tier-1 way to
 * meet someone in the same change." This is that change.
 *
 * ## The shape
 *
 * People are met WHERE THE PLAYER ALREADY IS, not from a menu of strangers:
 * the venue is read off the life (a job, a class, the gym, the building you
 * rent in, the street you work), so the answer to "where do people come from?"
 * is the same as the answer to "what have I been doing?". That is also what
 * makes the introduction a story rather than a contact: the relationship
 * records where and when it began (`metAt`), and the Contacts app, the journal
 * and the life story can all say it back.
 *
 * ## No new bookkeeping
 *
 * There is no stored cooldown, no "people you can meet" list in the save, and
 * no counter. Time is cut into fixed windows of `MEET_WINDOW_WEEKS`; the window
 * index plus the life salt derive exactly one person, and their relationship id
 * ENCODES that window (`met-<venue>-<window>`). So:
 *
 *   - "have I already met this window's person?" is
 *     `relationships.some(r => r.id === id)` — the memory the game already
 *     writes, the same trick the `intro` favour uses (`intro-<contact>-<week>`);
 *   - a double-tap in one React batch cannot append twice, because the updater
 *     re-checks that id against `prev` (CLAUDE.md §4.4);
 *   - a reload cannot re-roll who is standing there, because nothing here
 *     touches `Math.random()`;
 *   - and two different lives meet different people in the same week, because
 *     the draw folds in `lifeSalt` (Program 8).
 *
 * Missing a window is missing a person, not banking one: only the CURRENT
 * window is ever offered. That is deliberate — an accumulating queue of
 * strangers is a chore, and this system must never become one.
 */

import type { GameState, Relationship } from '@/contexts/game/types';
import { makeLifeRoll } from '@/utils/seededRoll';
import { weeksInThisLife } from '@/lib/progress/lifeChapters';

/**
 * How often somebody new is around.
 *
 * Six weeks is paced against the two things it has to sit between: Chapter 1
 * finishes at about week 4-6 (earn $500, get hired, survive 4 weeks), and
 * Chapter 2 at about week 14. So a player meets their first person shortly
 * after the Contacts app appears, and has met two or three by the time Spark
 * opens — enough for `ch2_make_friend` to be a real goal, nowhere near enough
 * for keeping in touch to become a weekly duty.
 */
export const MEET_WINDOW_WEEKS = 6;

/**
 * The most people this can put in a life.
 *
 * Every relationship is something the weekly tick walks and something the
 * Attention tab can flag, so an uncapped faucet turns a social life into an
 * inbox. Eight is above the "10 friends" achievement's reach on its own (so it
 * cannot trivialise it) and below the point where Contacts stops being
 * readable. Reaching the cap simply means nobody new is around; it is not an
 * error and the UI says so in those words.
 */
export const MEET_MAX_INTRODUCED = 8;

/** Energy an introduction costs — a conversation, not an evening. */
export const MEET_ENERGY_COST = 6;

export type MeetVenueId = 'work' | 'class' | 'gym' | 'building' | 'street';

export interface MeetVenue {
  id: MeetVenueId;
  /** Where the meeting happens, in the player's words. */
  label: string;
  /** The line the introduction is offered with. */
  invitation: string;
  /** What it costs beyond energy — a coffee, a round, a class fee. */
  cost: number;
  /** Jobs somebody met here plausibly has. */
  jobs: string[];
}

/**
 * The venues, most specific first. `pickVenue` returns the first whose
 * condition the life satisfies, so a player with a job meets colleagues, a
 * student meets classmates, and someone doing neither still meets their
 * neighbours — there is no state in which nobody is around.
 */
export const MEET_VENUES: MeetVenue[] = [
  {
    id: 'class',
    label: 'in class',
    invitation: 'Someone on your course keeps ending up at the same table.',
    cost: 0,
    jobs: ['Student', 'Teaching assistant', 'Part-time barista', 'Library assistant'],
  },
  {
    id: 'work',
    label: 'at work',
    invitation: 'A colleague has started saving you a seat at lunch.',
    cost: 12,
    jobs: ['Colleague', 'Shift supervisor', 'Warehouse hand', 'Office admin', 'Driver'],
  },
  {
    id: 'gym',
    label: 'at the gym',
    invitation: 'Someone you keep passing on the machines finally says hello.',
    cost: 0,
    jobs: ['Personal trainer', 'Physio', 'Nurse', 'Cyclist', 'Chef'],
  },
  {
    id: 'building',
    label: 'in your building',
    invitation: 'A neighbour props the door and starts a conversation.',
    cost: 0,
    jobs: ['Neighbour', 'Night-shift nurse', 'Musician', 'Retail assistant', 'Retired'],
  },
  {
    id: 'street',
    label: 'around the neighbourhood',
    invitation: 'Someone you see most days at the same corner starts talking.',
    cost: 0,
    jobs: ['Street vendor', 'Courier', 'Busker', 'Mechanic', 'Barista'],
  },
];

const PERSONALITIES = ['friendly', 'ambitious', 'analytical', 'charming', 'reserved', 'caring'] as const;

/**
 * First names, kept local rather than imported from the onboarding name data.
 *
 * `lib/` may not import values from `app|components|contexts|services|hooks`
 * (eslint), and while `src/` is not on that list, reaching up into the
 * onboarding feature for a word list would invert the same layering for no
 * gain. These are a cast, not a database.
 */
const MET_FIRST_NAMES = [
  'Mia', 'Owen', 'Priya', 'Dev', 'Nina', 'Marcus', 'Sofia', 'Theo', 'Lena', 'Andre',
  'Ruth', 'Ivan', 'Cleo', 'Jonah', 'Farah', 'Kofi', 'Elsie', 'Rafa', 'Noor', 'Sam',
  'Bea', 'Hugo', 'Tess', 'Amir', 'Vera', 'Milo', 'Anya', 'Otto', 'Rosa', 'Kai',
];

const MET_LAST_NAMES = [
  'Hale', 'Okafor', 'Rivas', 'Bennett', 'Sultan', 'Moreau', 'Idris', 'Lange', 'Costa', 'Whitlock',
  'Nakamura', 'Ferreira', 'Ashby', 'Solano', 'Варга', 'Duarte', 'Vance', 'Osei', 'Blackwood', 'Ilves',
];

export interface Introduction {
  /** The relationship id this introduction would create — encodes its window. */
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female';
  personality: string;
  job: string;
  venue: MeetVenue;
  /** The window this belongs to; `weeksInThisLife` at the window's start. */
  windowStartWeek: number;
}

/** Weeks into THIS life, floored at 0. Absolute `weeksLived` is seeded from age (§4.2). */
function lifeWeek(state: GameState): number {
  const w = weeksInThisLife(state);
  return typeof w === 'number' && Number.isFinite(w) && w > 0 ? Math.floor(w) : 0;
}

/** Where this life is currently meeting people. */
export function pickVenue(state: GameState): MeetVenue {
  const studying = (state.educations ?? []).some(
    (e) => e && !e.completed && (e.weeksRemaining ?? 0) > 0,
  );
  if (studying) return MEET_VENUES[0];
  if (state.currentJob) return MEET_VENUES[1];
  // Fitness is the tell that the player actually goes: the gym is a Market
  // purchase and `stats.fitness` only climbs by using it.
  if ((state.stats?.fitness ?? 0) >= 40) return MEET_VENUES[2];
  if (state.rental?.tierId || (state.realEstate ?? []).some((p) => p?.owned)) return MEET_VENUES[3];
  return MEET_VENUES[4];
}

/** Relationships this system has introduced (by id prefix). */
export function introducedCount(state: GameState): number {
  return (state.relationships ?? []).filter((r) => typeof r?.id === 'string' && r.id.startsWith('met-')).length;
}

/**
 * The person who is around right now, or `null` when nobody is: already met
 * this window, or the cap is reached.
 *
 * Pure and deterministic in (life, week). The caller may render it every frame.
 */
export function currentIntroduction(state: GameState): Introduction | null {
  if (!state) return null;
  if (introducedCount(state) >= MEET_MAX_INTRODUCED) return null;

  const week = lifeWeek(state);
  // Window 0 is the first `MEET_WINDOW_WEEKS` weeks of a life and is skipped:
  // Chapter 1 is "earn $500, get hired, survive 4 weeks", and a stranger on
  // frame one competes with the one thing the tutorial is asking for.
  const windowIndex = Math.floor(week / MEET_WINDOW_WEEKS);
  if (windowIndex < 1) return null;

  const venue = pickVenue(state);
  const id = `met-${venue.id}-${windowIndex}`;
  if ((state.relationships ?? []).some((r) => r?.id === id)) return null;

  // Keyed on the life AND the window, so two lives meet different people in
  // the same week and one life meets the same person on every reload.
  const roll = makeLifeRoll(state, windowIndex);
  const pick = <T,>(list: readonly T[], key: string): T =>
    list[Math.min(list.length - 1, Math.floor(roll(`meet-${key}`) * list.length))];

  const playerAge = Math.floor(state.date?.age ?? 18);
  return {
    id,
    name: `${pick(MET_FIRST_NAMES, 'first')} ${pick(MET_LAST_NAMES, 'last')}`,
    // Within a decade of the player, never under 18.
    age: Math.max(18, playerAge - 5 + Math.floor(roll('meet-age') * 11)),
    gender: roll('meet-gender') < 0.5 ? 'male' : 'female',
    personality: pick(PERSONALITIES, 'personality'),
    job: pick(venue.jobs, 'job'),
    venue,
    windowStartWeek: windowIndex * MEET_WINDOW_WEEKS,
  };
}

/**
 * The relationship an introduction becomes.
 *
 * Starts at 40 — below the 45 a Spark match or a network introduction starts
 * at, because a colleague who saved you a seat is a shade less than someone who
 * chose you off a profile, and comfortably above `NEGLECT_THRESHOLD` (25) so a
 * brand-new acquaintance is never immediately "at risk".
 */
export const MET_STARTING_BOND = 40;

export function introductionToRelationship(intro: Introduction, atWeek: number): Relationship {
  return {
    id: intro.id,
    name: intro.name,
    type: 'friend',
    relationshipScore: MET_STARTING_BOND,
    personality: intro.personality,
    gender: intro.gender,
    age: intro.age,
    job: intro.job,
    // v50 — the whole point. A bond is a number; where it started is a story.
    metAt: { venue: intro.venue.id, label: intro.venue.label, week: Math.max(0, Math.floor(atWeek)) },
  };
}

/** Why the current life cannot meet anyone, in the player's words, or `null`. */
export function meetBlockedReason(state: GameState): string | null {
  if (introducedCount(state) >= MEET_MAX_INTRODUCED) {
    return 'You already have as many new people in your life as you can keep up with.';
  }
  if (!currentIntroduction(state)) {
    return 'Nobody new right now — someone usually turns up within a few weeks.';
  }
  if ((state.stats?.energy ?? 0) < MEET_ENERGY_COST) {
    return `You are too tired to be good company (needs ${MEET_ENERGY_COST} energy).`;
  }
  const venue = pickVenue(state);
  if (venue.cost > 0 && (state.stats?.money ?? 0) < venue.cost) {
    return `You would need $${venue.cost} to get the coffees in.`;
  }
  return null;
}
