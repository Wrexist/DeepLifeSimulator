/**
 * The objective registry - where live-event LOGIC lives.
 *
 * WHY A REGISTRY AND NOT A FIELD IN THE DEFINITION. An event definition is data
 * that may arrive from a server, and "do not remotely control unsafe executable
 * logic" is the whole safety story for remote content. So a definition names an
 * objective by id and supplies a target; the READ - the function that looks at
 * the save - is compiled into the app and can only ever be one of these. The
 * worst a hostile or malformed payload can do is ask for an objective that does
 * not exist, which validation drops.
 *
 * WHAT MAKES A GOOD ENTRY. Each read must be:
 *  - PURE. It takes a `GameState` and returns a number. It never mutates, never
 *    touches the clock, and never reads anything outside the save.
 *  - TOTAL. A malformed or partial save must yield a number, not a throw. Every
 *    read here is written to survive a save with the field missing entirely,
 *    because live events are evaluated on every render of the hub.
 *  - MONOTONIC WHERE IT CLAIMS TO BE. An objective the player can go BACKWARDS
 *    on (cash, which is spent) is fine, but it changes what the objective
 *    means - "have $50k" is a snapshot, "earn $50k" is a total. Both exist
 *    below and they are named so the difference is visible at the call site.
 *
 * NONE OF THESE READ THE WALL CLOCK. Progress is game state. A player who moves
 * their device clock forward a month has not earned anything.
 */
import { netWorth } from '@/lib/progress/achievements';
import { weeksSinceLifeStart } from '@/utils/weekCounters';
import type { GameState } from '@/contexts/game/types';
import type { LiveObjectiveDefinition } from './types';

/** Coerce anything to a finite, non-negative count. */
const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;

const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/**
 * The registry.
 *
 * Kept small on purpose. Every entry is a promise to keep computing this number
 * the same way forever - a live event that shipped last winter and an event
 * shipping today must mean the same thing by "own 3 properties", or the
 * completion rates across a year of events are not comparable.
 */
export const LIVE_OBJECTIVES: readonly LiveObjectiveDefinition[] = [
  // ── Wealth ──
  {
    id: 'net_worth',
    label: 'Reach ${target} net worth',
    // The CANONICAL net worth, the same figure the prestige gate, the
    // leaderboard and the weekly challenge read. A local re-implementation is
    // how the weekly challenge once asked for a different, larger number than
    // every other surface showed the player (2026-07-30 audit GP-2).
    read: (s) => count(netWorth(s)),
  },
  {
    id: 'cash_on_hand',
    label: 'Hold ${target} in cash',
    read: (s) => count(s.stats?.money),
  },
  {
    id: 'lifetime_earned',
    label: 'Earn ${target} in this life',
    // A TOTAL, not a snapshot: spending it does not undo the objective.
    read: (s) => count(s.lifetimeStatistics?.totalMoneyEarned),
  },

  // ── Assets ──
  {
    id: 'properties_owned',
    label: 'Own {target} properties',
    read: (s) => arr(s.realEstate).filter((r) => !!(r as { owned?: boolean })?.owned).length,
  },
  {
    id: 'companies_owned',
    label: 'Own {target} businesses',
    read: (s) => arr(s.companies).length,
  },
  {
    id: 'luxury_items_owned',
    label: 'Own {target} luxury items',
    read: (s) => arr(s.luxuryItems).length,
  },

  // ── Life ──
  {
    id: 'weeks_this_life',
    label: 'Live {target} weeks this life',
    // Weeks in THIS life, never raw `weeksLived` - that counter is seeded from
    // the starting age, so an age-25 character begins at 364 and any small
    // threshold against it is already met before the first frame (CLAUDE.md
    // 4.2, three shipped bugs).
    read: (s) => count(weeksSinceLifeStart(s.weeksLived ?? 0, s.lifeStartWeek)),
  },
  {
    id: 'reputation',
    label: 'Reach {target} reputation',
    read: (s) => count(s.stats?.reputation),
  },
  {
    id: 'happiness',
    label: 'Reach {target} happiness',
    read: (s) => count(s.stats?.happiness),
  },
  {
    id: 'health',
    label: 'Reach {target} health',
    read: (s) => count(s.stats?.health),
  },
  {
    id: 'children',
    label: 'Have {target} children',
    read: (s) => arr(s.family?.children).length,
  },
  {
    id: 'is_married',
    label: 'Be married',
    read: (s) => (s.family?.spouse ? 1 : 0),
  },

  // ── Career ──
  {
    id: 'weeks_worked',
    label: 'Work {target} weeks',
    read: (s) => count(s.lifetimeStatistics?.totalWeeksWorked),
  },
  {
    id: 'highest_salary',
    label: 'Reach a ${target} salary',
    read: (s) => count(s.lifetimeStatistics?.highestSalary),
  },
  {
    id: 'educations_completed',
    label: 'Complete {target} educations',
    // `educations` holds every enrolment; a COMPLETED one is the milestone.
    // Same read as the weekly challenge's `education_2` objective, so the two
    // systems cannot disagree about what "completed an education" means.
    read: (s) => arr(s.educations).filter((e) => !!(e as { completed?: boolean })?.completed).length,
  },

  // ── Meta ──
  {
    id: 'achievements_unlocked',
    label: 'Unlock {target} achievements',
    read: (s) => arr(s.achievements).filter((a) => !!(a as { unlocked?: boolean })?.unlocked).length,
  },
];

const BY_ID: ReadonlyMap<string, LiveObjectiveDefinition> = new Map(
  LIVE_OBJECTIVES.map((o) => [o.id, o]),
);

/** Look one up. `undefined` for an unknown id - validation drops those events. */
export function findObjective(id: string): LiveObjectiveDefinition | undefined {
  return BY_ID.get(id);
}

export function isKnownObjective(id: string): boolean {
  return BY_ID.has(id);
}

/**
 * Render an objective's label with its target substituted.
 *
 * Money-shaped labels (those whose placeholder follows a `$`) are grouped with
 * thousands separators, because "Reach $1000000 net worth" is a number nobody
 * can read at a glance and a live event has about one second of the player's
 * attention to say what it wants.
 */
export function objectiveLabel(definition: LiveObjectiveDefinition, target: number): string {
  const safe = Number.isFinite(target) ? target : 0;
  const isMoney = definition.label.includes('${target}');
  const rendered = isMoney ? safe.toLocaleString('en-US') : String(safe);
  return definition.label.replace('{target}', rendered);
}

/**
 * Evaluate one objective reference against a save.
 *
 * Never throws: a registry read that fails for a malformed save reports 0
 * progress rather than taking down the hub it is rendered in. Zero is also the
 * safe direction - it under-reports progress, which a later render corrects,
 * rather than paying out for a state that could not be read.
 */
export function evaluateObjective(
  objectiveId: string,
  target: number,
  state: GameState,
): { objectiveId: string; label: string; current: number; target: number; met: boolean } | null {
  const definition = findObjective(objectiveId);
  if (!definition) return null;

  const safeTarget = Number.isFinite(target) ? Math.max(0, target) : 0;
  let current = 0;
  try {
    current = count(definition.read(state));
  } catch {
    current = 0;
  }

  return {
    objectiveId,
    label: objectiveLabel(definition, safeTarget),
    current,
    target: safeTarget,
    met: current >= safeTarget,
  };
}
