/**
 * Definition validation - the layer that makes remote content safe.
 *
 * WHAT IT IS FOR. An event definition may arrive from a server. It cannot carry
 * logic (objectives are ids into a compiled-in registry), but it can still be
 * wrong in ways that would break the game or the economy: a reward past the
 * cap, an end date before its start, an objective that does not exist, a
 * schema from a future app version. Every one of those has to fail SAFELY.
 *
 * THE CENTRAL RULE: DROP THE EVENT, NEVER THE PAYLOAD. A single malformed
 * definition invalidating the whole batch is how one typo in one seasonal event
 * takes the entire live-ops calendar off the air. Each definition is validated
 * on its own and the survivors are used. That also means the failure is
 * proportional: authoring a bad event costs that event.
 *
 * WHY IT VALIDATES LOCAL CONTENT TOO. The compiled-in catalogue runs through
 * exactly the same function, asserted by its own test. A validator that only
 * ever sees remote data is a validator nobody exercises until the day it
 * matters, and a local catalogue that skips the caps is a hole in the economy
 * safety that no reviewer would think to look for.
 */
import { isKnownObjective } from './objectives';
import { validateRewards } from './rewards';
import {
  LIVE_EVENT_KINDS,
  LIVEOPS_SCHEMA_VERSION,
  type LiveEventDefinition,
  type LiveEventKind,
} from './types';

/** Bounds that keep one definition from being absurd. */
export const MAX_OBJECTIVES = 6;
export const MAX_TITLE_LENGTH = 60;
export const MAX_SUMMARY_LENGTH = 140;
export const MAX_BRIEF_LENGTH = 400;
/**
 * The longest a SCHEDULED event may run.
 *
 * A "limited time" event that runs for a year is not limited, and the cap is
 * what stops a calendar slot quietly becoming permanent content that nobody
 * revisits or measures.
 */
export const MAX_DURATION_DAYS = 60;

/**
 * The longest an EVERGREEN event may run.
 *
 * `returning` events are the exception, and the reason is structural rather
 * than a concession: their real gate is `eligibility.minDaysAway`, not the
 * window. A win-back that greets someone who comes back in August must be there
 * in August, so its window is "while this content is current" and the audience
 * is narrowed by the absence rule instead. Still capped, because a definition
 * with a ten-year window is a bug in either kind.
 */
export const MAX_EVERGREEN_DURATION_DAYS = 400;

/** The kinds whose window is a content lifetime rather than a limited run. */
const EVERGREEN_KINDS: ReadonlySet<string> = new Set(['returning']);
/** The longest a completed reward may stay claimable after the window closes. */
export const MAX_GRACE_DAYS = 14;

const isNonEmptyString = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;

/** Parse an ISO instant, or null. Rejects anything that is not a real date. */
export function parseInstant(value: unknown): number | null {
  if (typeof value !== 'string' || !value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Everything wrong with a definition. Empty means it is safe to run.
 *
 * Reports ALL problems rather than the first, so an author fixing a definition
 * gets one list instead of a game of whack-a-mole through repeated deploys -
 * which for remote content means repeated deploys to real players.
 */
export function validateEventDefinition(input: unknown): string[] {
  const problems: string[] = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return ['not an object'];
  }
  const def = input as Partial<LiveEventDefinition> & Record<string, unknown>;

  // ── Identity ──
  if (!isNonEmptyString(def.id, 64)) problems.push('missing or invalid id');
  else if (!/^[a-z][a-z0-9_]*$/.test(def.id)) {
    // One naming convention, enforced. Ids appear in analytics and in the claim
    // ledger, and `winter_2026`, `Winter2026` and `winter-2026` as three
    // spellings of one event would split its funnel three ways forever.
    problems.push(`id '${def.id}' must be lower snake_case`);
  }

  // ── Schema version ──
  if (typeof def.schemaVersion !== 'number' || !Number.isFinite(def.schemaVersion)) {
    problems.push('missing schemaVersion');
  } else if (def.schemaVersion > LIVEOPS_SCHEMA_VERSION) {
    // A definition authored against a NEWER schema than this binary
    // understands. Refusing it is the only safe reading: the fields this app
    // does not know about may be the ones that bound the reward or narrow the
    // audience, and running it would mean running an event as something other
    // than what was authored.
    problems.push(
      `schemaVersion ${def.schemaVersion} is newer than this app supports (${LIVEOPS_SCHEMA_VERSION})`,
    );
  }

  // ── Kind ──
  if (!LIVE_EVENT_KINDS.includes(def.kind as LiveEventKind)) {
    problems.push(`unknown kind '${String(def.kind)}'`);
  }

  // ── Copy ──
  if (!isNonEmptyString(def.title, MAX_TITLE_LENGTH)) problems.push('missing or over-long title');
  if (!isNonEmptyString(def.summary, MAX_SUMMARY_LENGTH)) problems.push('missing or over-long summary');
  if (!isNonEmptyString(def.brief, MAX_BRIEF_LENGTH)) problems.push('missing or over-long brief');

  // ── Window ──
  const startsAt = parseInstant(def.startsAt);
  const endsAt = parseInstant(def.endsAt);
  if (startsAt === null) problems.push('startsAt is not a valid ISO instant');
  if (endsAt === null) problems.push('endsAt is not a valid ISO instant');
  if (startsAt !== null && endsAt !== null) {
    if (endsAt <= startsAt) {
      problems.push('endsAt must be after startsAt');
    } else {
      const evergreen = EVERGREEN_KINDS.has(String(def.kind));
      const maxDays = evergreen ? MAX_EVERGREEN_DURATION_DAYS : MAX_DURATION_DAYS;
      if (endsAt - startsAt > maxDays * DAY_MS) {
        problems.push(`window is longer than ${maxDays} days for kind '${String(def.kind)}'`);
      }
      // An evergreen kind with no absence rule is the failure this pairing
      // guards: a year-long window and no gate is not a win-back, it is
      // permanent content wearing an event's clothes, and it would occupy the
      // hub for every player forever.
      if (evergreen) {
        const minDaysAway = (def.eligibility as { minDaysAway?: unknown } | undefined)?.minDaysAway;
        if (typeof minDaysAway !== 'number' || !(minDaysAway > 0)) {
          problems.push(`kind '${String(def.kind)}' needs eligibility.minDaysAway > 0`);
        }
      }
    }
  }
  if (def.claimGraceDays !== undefined) {
    if (
      typeof def.claimGraceDays !== 'number' ||
      !Number.isFinite(def.claimGraceDays) ||
      def.claimGraceDays < 0 ||
      def.claimGraceDays > MAX_GRACE_DAYS
    ) {
      problems.push(`claimGraceDays must be between 0 and ${MAX_GRACE_DAYS}`);
    }
  }

  // ── Objectives ──
  if (!Array.isArray(def.objectives) || def.objectives.length === 0) {
    problems.push('needs at least one objective');
  } else {
    if (def.objectives.length > MAX_OBJECTIVES) {
      problems.push(`more than ${MAX_OBJECTIVES} objectives`);
    }
    const seen = new Set<string>();
    for (const ref of def.objectives) {
      const objectiveId = (ref as { objectiveId?: unknown })?.objectiveId;
      const target = (ref as { target?: unknown })?.target;
      if (typeof objectiveId !== 'string' || !objectiveId) {
        problems.push('objective is missing objectiveId');
        continue;
      }
      // The load-bearing check for remote safety: an id that is not in the
      // compiled-in registry has no read behind it, so there is nothing to
      // guess at. Dropping the event is the only honest option.
      if (!isKnownObjective(objectiveId)) {
        problems.push(`unknown objective '${objectiveId}'`);
      }
      if (seen.has(objectiveId)) {
        problems.push(`duplicate objective '${objectiveId}'`);
      }
      seen.add(objectiveId);
      if (typeof target !== 'number' || !Number.isFinite(target) || target <= 0) {
        problems.push(`objective '${objectiveId}' needs a positive finite target`);
      }
    }
  }

  // ── Rewards (the economy caps live in rewards.ts) ──
  if (!Array.isArray(def.rewards)) problems.push('rewards must be an array');
  else problems.push(...validateRewards(def.rewards));

  // ── Rollout ──
  if (def.rolloutPercent !== undefined) {
    if (
      typeof def.rolloutPercent !== 'number' ||
      !Number.isFinite(def.rolloutPercent) ||
      def.rolloutPercent < 0 ||
      def.rolloutPercent > 100
    ) {
      problems.push('rolloutPercent must be between 0 and 100');
    }
  }

  // ── Eligibility ──
  const eligibility = def.eligibility as Record<string, unknown> | undefined;
  if (eligibility !== undefined) {
    if (typeof eligibility !== 'object' || eligibility === null || Array.isArray(eligibility)) {
      problems.push('eligibility must be an object');
    } else {
      if (eligibility.stages !== undefined && !Array.isArray(eligibility.stages)) {
        problems.push('eligibility.stages must be an array');
      }
      for (const key of ['minWeeksThisLife', 'minDaysAway'] as const) {
        const value = eligibility[key];
        if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
          problems.push(`eligibility.${key} must be a non-negative finite number`);
        }
      }
      if (
        eligibility.requiresSubscription !== undefined &&
        typeof eligibility.requiresSubscription !== 'boolean'
      ) {
        problems.push('eligibility.requiresSubscription must be a boolean');
      }
    }
  }

  return problems;
}

/** True when a definition is safe to run. */
export function isValidEventDefinition(input: unknown): input is LiveEventDefinition {
  return validateEventDefinition(input).length === 0;
}

/**
 * Keep the definitions that validate, and report what was dropped.
 *
 * Duplicate ids are resolved by KEEPING THE FIRST. Order matters at the call
 * site: `remote.ts` puts remote definitions ahead of the local catalogue
 * precisely so an operator can correct a shipped event without an app update,
 * which is the whole point of remote content.
 */
export function selectValidEvents(input: unknown): {
  valid: LiveEventDefinition[];
  rejected: { id: string; problems: string[] }[];
} {
  const valid: LiveEventDefinition[] = [];
  const rejected: { id: string; problems: string[] }[] = [];
  const seenIds = new Set<string>();

  if (!Array.isArray(input)) return { valid, rejected };

  for (const candidate of input) {
    const id =
      candidate && typeof candidate === 'object' && typeof (candidate as { id?: unknown }).id === 'string'
        ? (candidate as { id: string }).id
        : '<no id>';
    const problems = validateEventDefinition(candidate);
    if (problems.length > 0) {
      rejected.push({ id, problems });
      continue;
    }
    if (seenIds.has(id)) {
      rejected.push({ id, problems: ['duplicate id - the earlier definition wins'] });
      continue;
    }
    seenIds.add(id);
    valid.push(candidate as LiveEventDefinition);
  }

  return { valid, rejected };
}
