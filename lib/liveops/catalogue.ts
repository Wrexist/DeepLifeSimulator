/**
 * The compiled-in event catalogue - the floor the game always has.
 *
 * WHY A LOCAL CATALOGUE EXISTS AT ALL, GIVEN REMOTE CONTENT. Because the remote
 * layer must be allowed to fail. A player on a plane, behind a captive portal,
 * or on the day the content bucket is misconfigured still opens the app, and
 * "no events, ever, because the network was down" is a worse product than a
 * smaller set of events that always work (33, 47). Remote definitions OVERRIDE
 * these by id, so an operator can correct one of these without an app update,
 * and everything here keeps working when they cannot.
 *
 * WHAT MAKES THESE GOOD EVENTS (8, 51). Each one asks for a DECISION the player
 * would not otherwise make this week, not a button to tap. "Hold cash" fights
 * the instinct to spend; "reach happiness while working" fights the instinct to
 * grind; "own property AND be married" pulls two systems together. The reward
 * is a good week's worth of gems, never a windfall - an event that pays more
 * than the game does makes the game the wrong thing to play.
 *
 * DATES. Deliberately NOT a rolling schedule computed from `Date.now()`. A
 * fixed calendar is auditable: you can read this file and know exactly what a
 * player sees in March. The rotation and cooldown machinery
 * (`pool.ts`, `eligibility.ts`) is what keeps a repeating id from dominating,
 * and `remote.ts` is what extends the calendar without a release.
 *
 * Everything here is validated by the same `validateEventDefinition` the remote
 * payload goes through, asserted by this module's own test. A local catalogue
 * that skipped the caps would be a hole in the economy safety that no reviewer
 * would think to look for.
 */
import type { LiveEventDefinition } from './types';
import { LIVEOPS_SCHEMA_VERSION } from './types';

const V = LIVEOPS_SCHEMA_VERSION;

/**
 * The events this binary ships with.
 *
 * Ordered by start date for readability only; the hub sorts by state and
 * priority (`schedule.ts`), never by catalogue position.
 */
export const LOCAL_EVENTS: readonly LiveEventDefinition[] = [
  // ── A returning-player event (15, 16) ──
  //
  // Fires only for someone who has been away a week or more, and asks for
  // nothing they have not already done - one played week and a stat they
  // already hold. The point is not the objective; it is that coming back is
  // acknowledged and immediately worth something. No guilt, no "you missed
  // everything", no countdown: it has a long window and a long grace precisely
  // so it is waiting whenever they return.
  {
    id: 'welcome_back_footing',
    schemaVersion: V,
    kind: 'returning',
    title: 'Finding Your Footing',
    summary: 'Play a week and get your bearings. Something to get you moving again.',
    brief:
      "You have been away. Nothing has gone wrong while you were gone - your life is where you left it. Play a week, keep your health up, and take this to get going again.",
    emoji: '\u{1F9ED}',
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2026-12-31T00:00:00Z',
    claimGraceDays: 14,
    objectives: [
      { objectiveId: 'weeks_this_life', target: 1 },
      { objectiveId: 'health', target: 30 },
    ],
    rewards: [{ kind: 'gems', amount: 150 }],
    eligibility: { minDaysAway: 7 },
    priority: 100,
  },

  // ── Q1: the discipline event ──
  //
  // Holding cash is the only objective in the whole catalogue the player can go
  // BACKWARDS on, and that is the design. Every other system in the game
  // rewards spending immediately; for one week this one does not. That tension
  // is the decision, and it is why the objective is "hold" rather than "earn".
  {
    id: 'cold_start_reserve',
    schemaVersion: V,
    kind: 'challenge',
    title: 'The Cold Start',
    summary: 'Build a cash reserve and hold it. Spending is the easy part.',
    brief:
      'Everything in this game rewards spending the moment you can afford it. For this one, do the opposite: get a reserve together and still have it when the window closes.',
    emoji: '\u{1F9CA}',
    startsAt: '2026-01-05T00:00:00Z',
    endsAt: '2026-01-19T00:00:00Z',
    claimGraceDays: 3,
    objectives: [
      { objectiveId: 'cash_on_hand', target: 25_000 },
      { objectiveId: 'weeks_this_life', target: 8 },
    ],
    rewards: [{ kind: 'gems', amount: 200 }],
    eligibility: { stages: ['early', 'mid', 'late', 'endgame'] },
    priority: 10,
  },

  // ── Q1: the early-player on-ramp ──
  //
  // Targeted at `new` and `early` only, and asks for the two things a new
  // player is doing anyway. An event hub whose first entry is "own five
  // businesses" teaches a new player that the hub is not for them, and they
  // never open it again.
  {
    id: 'first_rungs',
    schemaVersion: V,
    kind: 'opportunity',
    title: 'First Rungs',
    summary: 'Get a foothold: some savings, some standing, a few weeks lived.',
    brief:
      'Early on, everything competes for the same money. This one just asks you to make a start on three fronts at once and rewards you for the balance.',
    emoji: '\u{1FA9C}',
    startsAt: '2026-01-05T00:00:00Z',
    endsAt: '2026-02-16T00:00:00Z',
    claimGraceDays: 7,
    objectives: [
      { objectiveId: 'cash_on_hand', target: 5_000 },
      { objectiveId: 'reputation', target: 25 },
      { objectiveId: 'weeks_this_life', target: 6 },
    ],
    rewards: [{ kind: 'gems', amount: 175 }],
    eligibility: { stages: ['new', 'early'] },
    priority: 20,
  },

  // ── Q2: the cross-system event ──
  //
  // Property AND marriage AND happiness. None is hard alone; together they stop
  // the player optimising one axis, which is the failure mode of every
  // single-objective event ("tap the thing you were already tapping").
  {
    id: 'spring_foundations',
    schemaVersion: V,
    kind: 'seasonal',
    title: 'Foundations',
    summary: 'A home, a partner, and the good sense to enjoy both.',
    brief:
      'It is easy to run a life on one axis. This asks for three at once: somewhere to live, someone to live with, and enough happiness left over to notice.',
    emoji: '\u{1F3E1}',
    startsAt: '2026-03-16T00:00:00Z',
    endsAt: '2026-04-13T00:00:00Z',
    claimGraceDays: 5,
    objectives: [
      { objectiveId: 'properties_owned', target: 1 },
      { objectiveId: 'is_married', target: 1 },
      { objectiveId: 'happiness', target: 60 },
    ],
    rewards: [{ kind: 'gems', amount: 250 }],
    eligibility: { stages: ['mid', 'late', 'endgame'] },
    priority: 15,
  },

  // ── Q3: the mid-game wall event ──
  //
  // Aimed exactly where the progression funnel flattens (see the M9 stage
  // telemetry): a player who has money but has stopped building. Businesses and
  // education are the two systems most often left untouched at that point.
  {
    id: 'summer_second_act',
    schemaVersion: V,
    kind: 'challenge',
    title: 'Second Act',
    summary: 'Money is not a plan. Build something and learn something.',
    brief:
      'You are past the part where money is the problem. This is the part where what you do with it matters: start a business, finish an education, and get your name up.',
    emoji: '\u{1F393}',
    startsAt: '2026-06-15T00:00:00Z',
    endsAt: '2026-07-13T00:00:00Z',
    claimGraceDays: 5,
    objectives: [
      { objectiveId: 'companies_owned', target: 1 },
      { objectiveId: 'educations_completed', target: 1 },
      { objectiveId: 'reputation', target: 50 },
    ],
    rewards: [{ kind: 'gems', amount: 275 }],
    eligibility: { stages: ['mid', 'late', 'endgame'] },
    priority: 15,
  },

  // ── Q4: the late-game event ──
  //
  // The only one that pays Legacy Points, and only two: they cross a life
  // boundary, so they are the one currency where over-paying compounds across
  // the whole dynasty rather than one save.
  {
    id: 'winter_ledger',
    schemaVersion: V,
    kind: 'seasonal',
    title: 'Closing the Ledger',
    summary: 'A year-end accounting of everything you built.',
    brief:
      'Year end. Not a sprint - a reckoning. Show what a life of accumulation actually adds up to, and take something that outlives it.',
    emoji: '\u{1F4D6}',
    startsAt: '2026-12-14T00:00:00Z',
    endsAt: '2027-01-04T00:00:00Z',
    claimGraceDays: 7,
    objectives: [
      { objectiveId: 'net_worth', target: 1_000_000 },
      { objectiveId: 'properties_owned', target: 3 },
      { objectiveId: 'achievements_unlocked', target: 15 },
    ],
    rewards: [
      { kind: 'gems', amount: 300 },
      { kind: 'legacyPoints', amount: 2 },
    ],
    eligibility: { stages: ['late', 'endgame'] },
    priority: 25,
  },
];
