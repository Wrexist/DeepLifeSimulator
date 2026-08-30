/**
 * Live Ops — the event model.
 *
 * THE ONE DESIGN DECISION EVERYTHING ELSE FOLLOWS FROM.
 *
 * A live event has a real-world window and a game-state reward, and those two
 * clocks are deliberately different:
 *
 *   WINDOW  = real UTC time. "This runs for the first week of December."
 *   PROGRESS = game state. Objectives read `GameState`, never the wall clock.
 *   REWARD   = claimed once per event INSTANCE, recorded in a persisted ledger.
 *
 * This repo has five `STATE_VERSION` bumps whose entire purpose is closing a
 * device-clock exploit (v28/v31/v35/v40/v44), so "gate on game state, not the
 * device clock" is not a preference here, it is a scar. But a live event also
 * has to line up with a real calendar, or "the winter event" arrives in July for
 * anyone who started playing in June. The split above is what lets both be true:
 * moving the device clock changes which SHOP WINDOW you are shown, which grants
 * nothing, and it cannot manufacture a single point of progress or re-open a
 * claim, because the claim is keyed on an instance id that is already in the
 * ledger.
 *
 * WHAT A DEFINITION MAY AND MAY NOT CONTAIN. Objectives are referenced by ID
 * into a compiled-in registry (`objectives.ts`); a definition never carries
 * logic, only data. That is what makes it safe to accept one from a server
 * (§31: "do not remotely control unsafe executable logic"). A remote definition
 * naming an unknown objective is dropped, not guessed at.
 */
import type { GameState } from '@/contexts/game/types';

/** The schema version of a definition. Bumped when the SHAPE changes. */
export const LIVEOPS_SCHEMA_VERSION = 1;

/** What kind of thing this is, for grouping and analytics. */
export const LIVE_EVENT_KINDS = [
  'challenge',
  'opportunity',
  'seasonal',
  'returning',
] as const;
export type LiveEventKind = (typeof LIVE_EVENT_KINDS)[number];

/** Currencies an event may pay in. Deliberately short — see `rewards.ts`. */
export const LIVE_REWARD_KINDS = ['gems', 'cash', 'legacyPoints'] as const;
export type LiveRewardKind = (typeof LIVE_REWARD_KINDS)[number];

export interface LiveReward {
  kind: LiveRewardKind;
  amount: number;
}

/**
 * One objective, as it appears in a definition: an id into the registry plus a
 * target. The registry supplies the READ; the definition supplies the BAR.
 *
 * Splitting them this way is what makes the same objective reusable across
 * events at different difficulties without a code change, and what keeps a
 * remote definition from being able to express anything the app cannot already
 * compute.
 */
export interface LiveObjectiveRef {
  objectiveId: string;
  target: number;
}

/**
 * Who an event is for.
 *
 * Every field is optional and absent means "no constraint", so the common case
 * — an event for everybody — is an empty object rather than a form to fill in.
 * Over-personalising is its own failure (§14): an event nobody qualifies for is
 * indistinguishable from an event that is broken.
 */
export interface LiveEventEligibility {
  /** Progression stages that may see it (`lib/analytics/progression.ts`). */
  stages?: readonly string[];
  /** Minimum weeks lived in the CURRENT life. Never raw `weeksLived` §4.2. */
  minWeeksThisLife?: number;
  /** `true` = subscribers only, `false` = non-subscribers only, absent = both. */
  requiresSubscription?: boolean;
  /** Minimum real days since the player's last session. For win-back events. */
  minDaysAway?: number;
}

/**
 * A live event definition. Pure data: safe to author locally, safe to accept
 * from a validated remote payload.
 */
export interface LiveEventDefinition {
  id: string;
  /** Schema version this definition was authored against. */
  schemaVersion: number;
  kind: LiveEventKind;
  title: string;
  /** One line the player reads on the card. */
  summary: string;
  /** What to do, in the player's terms. Shown when the event is opened. */
  brief: string;
  emoji?: string;
  /** Inclusive UTC start, ISO 8601. */
  startsAt: string;
  /** Exclusive UTC end, ISO 8601. */
  endsAt: string;
  /**
   * Real days after `endsAt` during which a COMPLETED but unclaimed reward can
   * still be taken. Progress stops at `endsAt`; only the claim is extended.
   * A player who finished the work and closed the app should not lose it to a
   * commute (§30).
   */
  claimGraceDays?: number;
  objectives: readonly LiveObjectiveRef[];
  rewards: readonly LiveReward[];
  eligibility?: LiveEventEligibility;
  /**
   * 0-100. The share of installs this event is enabled for, for staged rollout
   * (§35). Absent means 100. Bucketing is deterministic per install, so a
   * player never sees an event appear and then vanish as the number is raised.
   */
  rolloutPercent?: number;
  /** Higher sorts first in the hub. Absent means 0. */
  priority?: number;
}

/** Where an event sits in its lifecycle, for one player, right now (§28). */
export const LIVE_EVENT_STATES = [
  'upcoming',
  'active',
  'claimable',
  'claimed',
  'expired',
  'unavailable',
] as const;
export type LiveEventState = (typeof LIVE_EVENT_STATES)[number];

/** One objective's progress, resolved against the current `GameState`. */
export interface LiveObjectiveProgress {
  objectiveId: string;
  label: string;
  current: number;
  target: number;
  met: boolean;
}

/** An event resolved for one player at one instant — what the UI renders. */
export interface ResolvedLiveEvent {
  definition: LiveEventDefinition;
  state: LiveEventState;
  objectives: readonly LiveObjectiveProgress[];
  /** All objectives met. */
  complete: boolean;
  /** Milliseconds until the window closes; 0 once it has. */
  msRemaining: number;
  /** Why the event is `unavailable`, when it is. For the debug surface only. */
  unavailableReason?: string;
}

// ── Persisted player state ──────────────────────────────────────────────────

/**
 * What the save keeps. Deliberately tiny, and deliberately NOT a mirror of
 * progress.
 *
 * Progress is RECOMPUTED from `GameState` on every read, never stored. That is
 * the same reasoning `legacyContracts` (v33) records: every objective reads a
 * value the save already tracks, so nothing can drift out of sync, a tick that
 * runs twice cannot double-credit, and an existing save loads with its events
 * already part-complete rather than reset to zero.
 *
 * What IS stored is the irreversible part: which instances have been claimed,
 * and when an event was last seen (for cooldowns and the "new" badge).
 */
export interface LiveOpsState {
  /**
   * Claimed event INSTANCE ids. An instance id is `eventId@startsAt`, so an
   * event that runs again next month is a new instance and claimable again,
   * while re-entering the SAME window — which is all a scrubbed clock can do —
   * finds the id already present.
   */
  claimedInstanceIds?: string[];
  /** eventId → `weeksLived` when the player last opened it. For cooldowns. */
  lastSeenWeek?: Record<string, number>;
  /** Instance ids the player has opened, so the hub can badge what is new. */
  seenInstanceIds?: string[];
  /**
   * Recent payouts, for the rolling weekly budget (`rewards.ts`).
   *
   * Stored rather than derived because the budget is about REAL elapsed time,
   * and nothing else in the save records when a claim happened. Pruned to the
   * window on every write, so it stays a handful of entries rather than growing
   * with the life.
   */
  budget?: { at: number; value: number }[];
}

/** The shape an objective registry entry has. Logic lives HERE, never in data. */
export interface LiveObjectiveDefinition {
  id: string;
  /** Rendered with the target substituted, e.g. "Own {target} properties". */
  label: string;
  /** Pure read against the save. Must never throw and never mutate. */
  read: (state: GameState) => number;
}
