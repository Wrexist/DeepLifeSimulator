/**
 * State Invariant Checks
 *
 * ## What is actually enforced, and where
 *
 * This module used to claim it "ensures the game never enters an impossible
 * state" while enforcing nothing: only `validateMoneyInvariants` had a
 * production caller, and that one only logged. A module that claims to prevent
 * impossible states while preventing none is worse than no module, because the
 * claim is what stops someone adding a real check elsewhere. So the header now
 * says exactly what runs where:
 *
 * | Function | Production caller | Effect |
 * |---|---|---|
 * | `enforceStateInvariants` | `loadGame` (`contexts/game/GameActionsContext.tsx`), and the CloudSync "keep cloud version" merge in the same file | logs violations under the `[INVARIANT]` tag and repairs the safely-repairable ones |
 * | `validateStateInvariants` | the above, plus `lib/simulation/MultiWeekSimulator` | pure check, no repair |
 * | `validateMoneyInvariants` | `MoneyActionsContext.updateMoney` | log-only |
 * | `validateStatsInvariants` / `validateTimeInvariants` / `validateRelationshipInvariants` | via `validateStateInvariants` | pure checks |
 * | `sanitizeFinalStats` | via `enforceStateInvariants` | clamps a stats block |
 * | `validateStatChanges` / `sanitizeStatChanges` | tests only | helpers for a per-action guard that does NOT exist |
 *
 * ## Where it deliberately does NOT run
 *
 * Not in the weekly tick and not on per-action paths. The tick has its own
 * per-subsystem try/catch guards (CLAUDE.md §4.3) and runs ~37 subsystems per
 * tap; a whole-state pass per tap buys nothing those guards don't already
 * cover. The enforcement point is the save/load boundary, which is where
 * corruption actually enters the app.
 *
 * ## Relationship to the save pipeline
 *
 * `enforceStateInvariants` runs LAST, after `runMigrations` →
 * `repairGameState` → `validateGameState(autoFix)` → `repairRelationshipState`.
 * It deliberately does not re-implement them; it catches what they miss on the
 * final, merged state:
 *
 * - `date.week` outside 1–4 (`validateGameState` only rejects `week < 0`)
 * - `weeksLived` negative or non-finite (nothing else checks it, and it is the
 *   counter every cooldown, timestamp and history entry compares against —
 *   CLAUDE.md §4.2)
 * - `date.age` non-finite or absurd
 * - duplicate relationship ids and out-of-union relationship types
 *
 * ## Repair philosophy
 *
 * A player's save must always load — the pipeline never rejects. So violations
 * are logged (tag `[INVARIANT]`, so QA and telemetry can grep one string) and
 * only *safely* repairable ones are repaired: values are clamped back into
 * range, never invented and never dropped. Nothing here deletes a relationship,
 * a holding or a history entry — a duplicate id is reported and left alone,
 * because silently removing a person from someone's save is a worse outcome
 * than the duplicate.
 */

import type { GameState, GameStats, Relationship } from '@/contexts/game/types';
import { ADULTHOOD_AGE, WEEKS_PER_MONTH, WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { logger } from '@/utils/logger';

const log = logger.scope('StateInvariants');

/**
 * The youngest age a legitimately-created save can carry.
 *
 * NOT `ADULTHOOD_AGE`. The `athletes_journey` scenario
 * (`lib/scenarios/scenarioDefinitions.ts`) starts at **16** — "start as an unfit
 * teen" is its entire premise — and `gameStateBuilder` writes that straight into
 * `date.age`. This validator used to raise a hard ERROR below 18, so every load
 * of a perfectly valid Athlete's Journey save reported an impossible state. A
 * check that fires on legitimate data is how a real one gets ignored.
 *
 * If a scenario is ever added that starts younger, lower this constant — do not
 * remove the check.
 */
export const MIN_VALID_AGE = 16;

/** Beyond this, an age is corruption rather than a very long life. */
export const MAX_VALID_AGE = 150;

/**
 * The year the game's calendar starts (`initialState.ts`). Anything earlier is
 * corruption. There is deliberately NO upper bound: `date.year` is CUMULATIVE
 * across prestige generations (`lib/prestige/prestigeExecution.ts` sets
 * `newYear = previousYear + yearsLived + 1`), so a few lives push past 2100 and
 * a dynasty pushes far past it. The old `[2025, 2100]` warning fired on exactly
 * the saves belonging to the players who play the most.
 */
export const GAME_EPOCH_YEAR = 2025;

export interface InvariantCheckResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate that stats are within valid ranges and not NaN/Infinity
 */
export function validateStatsInvariants(stats: Partial<GameStats>): InvariantCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const statRanges: { [key: string]: [number, number] } = {
    health: [0, 100],
    happiness: [0, 100],
    energy: [0, 100],
    fitness: [0, 100],
    reputation: [0, 100],
  };

  // Check each stat
  for (const [stat, [min, max]] of Object.entries(statRanges)) {
    const value = stats[stat as keyof GameStats];
    if (value !== undefined) {
      if (typeof value !== 'number') {
        errors.push(`${stat} is not a number: ${typeof value}`);
      } else if (isNaN(value)) {
        errors.push(`${stat} is NaN`);
      } else if (!isFinite(value)) {
        errors.push(`${stat} is ${value > 0 ? 'Infinity' : '-Infinity'}`);
      } else if (value < min || value > max) {
        errors.push(`${stat} is outside valid range [${min}, ${max}]: ${value}`);
      }
    }
  }

  // Check money (must be >= 0, finite)
  if (stats.money !== undefined) {
    if (typeof stats.money !== 'number') {
      errors.push(`money is not a number: ${typeof stats.money}`);
    } else if (isNaN(stats.money)) {
      errors.push('money is NaN');
    } else if (!isFinite(stats.money)) {
      errors.push(`money is ${stats.money > 0 ? 'Infinity' : '-Infinity'}`);
    } else if (stats.money < 0) {
      errors.push(`money is negative: ${stats.money}`);
    }
  }

  // Check gems (must be >= 0, finite, reasonable max)
  if (stats.gems !== undefined) {
    if (typeof stats.gems !== 'number') {
      errors.push(`gems is not a number: ${typeof stats.gems}`);
    } else if (isNaN(stats.gems)) {
      errors.push('gems is NaN');
    } else if (!isFinite(stats.gems)) {
      errors.push(`gems is ${stats.gems > 0 ? 'Infinity' : '-Infinity'}`);
    } else if (stats.gems < 0) {
      errors.push(`gems is negative: ${stats.gems}`);
    } else if (stats.gems > 999999999) {
      warnings.push(`gems is very high: ${stats.gems}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate that stat changes are safe to apply
 */
export function validateStatChanges(changes: Partial<GameStats>): InvariantCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === null) continue;

    if (typeof value !== 'number') {
      errors.push(`Stat change ${key} is not a number: ${typeof value}`);
      continue;
    }

    if (isNaN(value)) {
      errors.push(`Stat change ${key} is NaN`);
    } else if (!isFinite(value)) {
      errors.push(`Stat change ${key} is ${value > 0 ? 'Infinity' : '-Infinity'}`);
    } else if (Math.abs(value) > 1000) {
      warnings.push(`Stat change ${key} is very large: ${value}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate time progression invariants
 */
export function validateTimeInvariants(state: Partial<GameState>): InvariantCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!state.date) {
    errors.push('date object is missing');
    return { valid: false, errors, warnings };
  }

  // Validate week (1-4). `date.week` is the week-of-MONTH and is display only;
  // the absolute counter is `weeksLived` (CLAUDE.md §4.2).
  if (typeof state.date.week !== 'number') {
    errors.push('date.week is not a number');
  } else if (isNaN(state.date.week) || !isFinite(state.date.week)) {
    errors.push('date.week is NaN or Infinity');
  } else if (state.date.week < 1 || state.date.week > WEEKS_PER_MONTH) {
    errors.push(`date.week is outside valid range [1, ${WEEKS_PER_MONTH}]: ${state.date.week}`);
  }

  // Validate age. The floor is MIN_VALID_AGE, not adulthood — see the constant.
  if (typeof state.date.age !== 'number') {
    errors.push('date.age is not a number');
  } else if (isNaN(state.date.age) || !isFinite(state.date.age)) {
    errors.push('date.age is NaN or Infinity');
  } else if (state.date.age < MIN_VALID_AGE) {
    errors.push(`date.age is below minimum (${MIN_VALID_AGE}): ${state.date.age}`);
  } else if (state.date.age > MAX_VALID_AGE) {
    warnings.push(`date.age is very high: ${state.date.age}`);
  }

  // Validate year. Lower bound only — the year is cumulative across prestige
  // generations, so there is no meaningful ceiling (see GAME_EPOCH_YEAR).
  if (typeof state.date.year !== 'number') {
    errors.push('date.year is not a number');
  } else if (isNaN(state.date.year) || !isFinite(state.date.year)) {
    errors.push('date.year is NaN or Infinity');
  } else if (state.date.year < GAME_EPOCH_YEAR) {
    warnings.push(`date.year is before the game epoch (${GAME_EPOCH_YEAR}): ${state.date.year}`);
  }

  // Validate weeksLived consistency
  if (state.weeksLived !== undefined) {
    if (typeof state.weeksLived !== 'number') {
      errors.push('weeksLived is not a number');
    } else if (isNaN(state.weeksLived) || !isFinite(state.weeksLived)) {
      errors.push('weeksLived is NaN or Infinity');
    } else if (state.weeksLived < 0) {
      errors.push(`weeksLived is negative: ${state.weeksLived}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * The `Relationship['type']` union as a lookup.
 *
 * A `Record<Relationship['type'], true>` rather than a string array on purpose:
 * adding a member to the union fails THIS file to compile, so the validator
 * cannot silently start rejecting a type the game legitimately writes.
 */
const VALID_RELATIONSHIP_TYPES: Record<Relationship['type'], true> = {
  parent: true,
  friend: true,
  partner: true,
  spouse: true,
  child: true,
};

/**
 * Validate relationship invariants
 */
export function validateRelationshipInvariants(state: Partial<GameState>): InvariantCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!state.relationships || !Array.isArray(state.relationships)) {
    return { valid: true, errors, warnings }; // Relationships array is optional
  }

  // Check for duplicate relationship IDs
  const ids = new Set<string>();
  for (const rel of state.relationships) {
    if (!rel || !rel.id) {
      errors.push('Relationship missing id');
      continue;
    }
    if (ids.has(rel.id)) {
      errors.push(`Duplicate relationship id: ${rel.id}`);
    }
    ids.add(rel.id);

    // Validate relationship score
    if (typeof rel.relationshipScore !== 'number') {
      errors.push(`Relationship ${rel.id} has invalid relationshipScore: ${typeof rel.relationshipScore}`);
    } else if (isNaN(rel.relationshipScore) || !isFinite(rel.relationshipScore)) {
      errors.push(`Relationship ${rel.id} has NaN/Infinity relationshipScore`);
    } else if (rel.relationshipScore < 0 || rel.relationshipScore > 100) {
      errors.push(`Relationship ${rel.id} has relationshipScore outside [0, 100]: ${rel.relationshipScore}`);
    }

    // Validate relationship type
    if (!(rel.type in VALID_RELATIONSHIP_TYPES)) {
      errors.push(`Relationship ${rel.id} has invalid type: ${rel.type}`);
    }
  }

  // Check spouse consistency
  if (state.family?.spouse) {
    const spouseInRelationships = state.relationships.find(r => r.id === state.family!.spouse!.id);
    if (!spouseInRelationships) {
      errors.push('family.spouse exists but not in relationships array');
    } else if (spouseInRelationships.type !== 'spouse') {
      errors.push(`family.spouse has type '${spouseInRelationships.type}' but should be 'spouse'`);
    }
  }

  // Check for multiple spouses. Deliberately OUTSIDE the `family.spouse` branch
  // above, where it used to live: two spouse rows with no `family.spouse` is a
  // corruption shape too, and it was the one the nested check could never see.
  const spouses = state.relationships.filter(r => r.type === 'spouse');
  if (spouses.length > 1) {
    errors.push(`Multiple spouses found: ${spouses.length}`);
  }

  // Check children consistency
  if (state.family?.children && Array.isArray(state.family.children)) {
    for (const child of state.family.children) {
      if (!child || !child.id) {
        errors.push('Child missing id');
        continue;
      }
      const childInRelationships = state.relationships.find(r => r.id === child.id);
      if (!childInRelationships) {
        errors.push(`Child ${child.id} exists in family.children but not in relationships array`);
      } else if (childInRelationships.type !== 'child') {
        errors.push(`Child ${child.id} has type '${childInRelationships.type}' but should be 'child'`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate money flow invariants
 */
export function validateMoneyInvariants(
  currentMoney: number,
  moneyChange: number,
  finalMoney: number
): InvariantCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate inputs
  if (isNaN(currentMoney) || !isFinite(currentMoney)) {
    errors.push(`currentMoney is invalid: ${currentMoney}`);
  }
  if (isNaN(moneyChange) || !isFinite(moneyChange)) {
    errors.push(`moneyChange is invalid: ${moneyChange}`);
  }
  if (isNaN(finalMoney) || !isFinite(finalMoney)) {
    errors.push(`finalMoney is invalid: ${finalMoney}`);
  }

  // Check calculation consistency
  const expectedFinal = currentMoney + moneyChange;
  if (errors.length === 0 && Math.abs(finalMoney - expectedFinal) > 0.01) {
    errors.push(`Money calculation mismatch: expected ${expectedFinal}, got ${finalMoney}`);
  }

  // Check final money is non-negative
  if (finalMoney < 0) {
    errors.push(`finalMoney is negative: ${finalMoney}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Comprehensive state invariant check.
 *
 * Pure — reports, never repairs. `enforceStateInvariants` is the wrapper that
 * logs and repairs; use that one at a boundary.
 */
export function validateStateInvariants(state: Partial<GameState>): InvariantCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check stats
  if (state.stats) {
    const statsCheck = validateStatsInvariants(state.stats);
    errors.push(...statsCheck.errors);
    warnings.push(...statsCheck.warnings);
  } else {
    errors.push('stats object is missing');
  }

  // Check time
  const timeCheck = validateTimeInvariants(state);
  errors.push(...timeCheck.errors);
  warnings.push(...timeCheck.warnings);

  // Check relationships
  const relCheck = validateRelationshipInvariants(state);
  errors.push(...relCheck.errors);
  warnings.push(...relCheck.warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Sanitize stat changes to prevent NaN/Infinity propagation
 */
export function sanitizeStatChanges(changes: Partial<GameStats>): Partial<GameStats> {
  const sanitized: Partial<GameStats> = {};

  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === null) continue;

    if (typeof value !== 'number') {
      log.warn(`Stat change ${key} is not a number, skipping: ${typeof value}`);
      continue;
    }

    if (isNaN(value) || !isFinite(value)) {
      log.warn(`Stat change ${key} is NaN/Infinity, setting to 0: ${value}`);
      sanitized[key as keyof GameStats] = 0;
    } else {
      sanitized[key as keyof GameStats] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize final stats to ensure they're within valid ranges
 */
export function sanitizeFinalStats(stats: Partial<GameStats>): GameStats {
  const statRanges: { [key: string]: [number, number] } = {
    health: [0, 100],
    happiness: [0, 100],
    energy: [0, 100],
    fitness: [0, 100],
    reputation: [0, 100],
  };

  const sanitized: any = { ...stats };

  // Clamp stats to valid ranges
  for (const [stat, [min, max]] of Object.entries(statRanges)) {
    const value = sanitized[stat];
    if (value !== undefined) {
      if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
        log.warn(`Stat ${stat} is invalid, setting to ${min}: ${value}`);
        sanitized[stat] = min;
      } else {
        sanitized[stat] = Math.max(min, Math.min(max, value));
      }
    }
  }

  // Ensure money is non-negative and finite
  if (sanitized.money !== undefined) {
    if (typeof sanitized.money !== 'number' || isNaN(sanitized.money) || !isFinite(sanitized.money)) {
      log.warn(`Money is invalid, setting to 0: ${sanitized.money}`);
      sanitized.money = 0;
    } else {
      sanitized.money = Math.max(0, sanitized.money);
    }
  }

  // Ensure gems are non-negative, finite, and reasonable
  if (sanitized.gems !== undefined) {
    if (typeof sanitized.gems !== 'number' || isNaN(sanitized.gems) || !isFinite(sanitized.gems)) {
      log.warn(`Gems is invalid, setting to 0: ${sanitized.gems}`);
      sanitized.gems = 0;
    } else {
      sanitized.gems = Math.max(0, Math.min(999999999, sanitized.gems));
    }
  }

  return sanitized as GameStats;
}

/** Outcome of an `enforceStateInvariants` pass. */
export interface InvariantEnforcementResult {
  /** True when nothing was wrong — `state` is then the identical reference. */
  clean: boolean;
  /** Invariant ERRORS found before repair (logged under `[INVARIANT]`). */
  violations: string[];
  /** Non-fatal oddities found before repair. */
  warnings: string[];
  /** Human-readable description of each repair actually applied. */
  repairs: string[];
  /** The state to use. A new object only when something was repaired. */
  state: GameState;
}

/** The age a `weeksLived` counter of N implies (CLAUDE.md §4.2). */
function deriveAge(weeksLived: unknown): number {
  if (typeof weeksLived !== 'number' || !isFinite(weeksLived) || weeksLived < 0) {
    return ADULTHOOD_AGE;
  }
  const age = ADULTHOOD_AGE + Math.floor(weeksLived / WEEKS_PER_YEAR);
  return Math.max(MIN_VALID_AGE, Math.min(MAX_VALID_AGE, age));
}

/** The `weeksLived` counter an age implies — the inverse of `computeWeeksLived`. */
function deriveWeeksLived(age: unknown): number {
  if (typeof age !== 'number' || !isFinite(age)) return 0;
  return Math.max(0, Math.floor((age - ADULTHOOD_AGE) * WEEKS_PER_YEAR));
}

/**
 * Check a whole state, log what is wrong, and repair what can be repaired
 * safely. This is the function boundaries call; see the module header for where
 * it runs and why it does not run in the weekly tick.
 *
 * Contract:
 * - **Never rejects.** A player's save must always load, so the worst outcome
 *   here is "logged and left alone".
 * - **Never invents or deletes.** Repairs clamp an existing value back into
 *   range, or derive one counter from its documented twin (`date.age` ⇄
 *   `weeksLived`). Relationship violations — duplicate ids, out-of-union types,
 *   family/relationships mismatches — are reported and NOT repaired: every
 *   repair for those is either a deletion or a guess about who someone is.
 * - **Cheap when clean.** One pass over stats/date/relationships and an early
 *   return with the same object reference; the shallow copies below only happen
 *   on a state that is already known to be broken.
 *
 * @param context short label for the log line (e.g. `'loadGame:slot-2'`)
 */
export function enforceStateInvariants(state: GameState, context: string): InvariantEnforcementResult {
  if (!state || typeof state !== 'object') {
    return { clean: true, violations: [], warnings: [], repairs: [], state };
  }

  const check = validateStateInvariants(state);
  if (check.valid && check.warnings.length === 0) {
    return { clean: true, violations: [], warnings: [], repairs: [], state };
  }

  // One grep-able tag for QA and telemetry: `[INVARIANT]`.
  if (check.errors.length > 0) {
    log.error(`[INVARIANT] ${check.errors.length} violation(s) at ${context}`, undefined, {
      context,
      errors: check.errors,
      warnings: check.warnings,
    });
  } else {
    log.warn(`[INVARIANT] ${check.warnings.length} warning(s) at ${context}`, {
      context,
      warnings: check.warnings,
    });
  }

  const repairs: string[] = [];

  // ── stats: clamp back into range ────────────────────────────────────────
  // `autoFixStats` (saveValidation) already does this on the load path; this is
  // the backstop for the paths that skip it and for anything the merge onto
  // `initialGameState` reintroduces afterwards.
  let stats = state.stats;
  if (stats && typeof stats === 'object') {
    const sanitized = sanitizeFinalStats(stats);
    const changedKeys = (Object.keys(sanitized) as (keyof GameStats)[]).filter(
      (key) => !Object.is(sanitized[key], stats[key]),
    );
    if (changedKeys.length > 0) {
      for (const key of changedKeys) {
        repairs.push(`stats.${String(key)}: ${String(stats[key])} -> ${String(sanitized[key])}`);
      }
      stats = sanitized;
    }
  }

  // ── date: week-of-month and age ─────────────────────────────────────────
  let date = state.date;
  if (date && typeof date === 'object') {
    const nextDate = { ...date };
    let dateChanged = false;

    const week: unknown = nextDate.week;
    if (typeof week !== 'number' || !isFinite(week) || week < 1 || week > WEEKS_PER_MONTH) {
      // Clamp rather than wrap. `week` is display-only week-of-month, so a
      // stored 0 or 9 carries no information worth preserving modulo-style —
      // and wrapping would turn "uninitialised" (0) into the last week of the
      // month, which reads as real data.
      const fixed =
        typeof week === 'number' && isFinite(week)
          ? Math.min(WEEKS_PER_MONTH, Math.max(1, Math.round(week)))
          : 1;
      repairs.push(`date.week: ${String(week)} -> ${fixed}`);
      nextDate.week = fixed;
      dateChanged = true;
    }

    const age: unknown = nextDate.age;
    if (typeof age !== 'number' || !isFinite(age)) {
      const fixed = deriveAge(state.weeksLived);
      repairs.push(`date.age: ${String(age)} -> ${fixed} (derived from weeksLived)`);
      nextDate.age = fixed;
      dateChanged = true;
    } else if (age < MIN_VALID_AGE || age > MAX_VALID_AGE) {
      const fixed = Math.min(MAX_VALID_AGE, Math.max(MIN_VALID_AGE, age));
      repairs.push(`date.age: ${age} -> ${fixed} (clamped)`);
      nextDate.age = fixed;
      dateChanged = true;
    }

    if (dateChanged) date = nextDate;
  }

  // ── weeksLived: the absolute counter every cooldown compares against ────
  // Repaired AFTER `date.age`, so a save with both broken derives the counter
  // from the already-repaired age instead of from the corrupt one.
  let weeksLived = state.weeksLived;
  if (typeof weeksLived !== 'number' || !isFinite(weeksLived) || weeksLived < 0) {
    const fixed = deriveWeeksLived(date?.age);
    repairs.push(`weeksLived: ${String(weeksLived)} -> ${fixed} (derived from date.age)`);
    weeksLived = fixed;
  }

  if (repairs.length === 0) {
    return { clean: false, violations: check.errors, warnings: check.warnings, repairs, state };
  }

  log.warn(`[INVARIANT] repaired ${repairs.length} field(s) at ${context}`, { context, repairs });

  return {
    clean: false,
    violations: check.errors,
    warnings: check.warnings,
    repairs,
    state: { ...state, stats, date, weeksLived },
  };
}

