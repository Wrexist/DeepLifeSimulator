/**
 * Turning a PARSED save into a state the app can safely run.
 *
 * This is the hardening core that used to live inline in `loadGame`
 * (`contexts/game/GameActionsContext.tsx`). It is extracted because `loadGame`
 * was not the only path that applies a foreign state: the cloud-sync conflict
 * resolver ("Keep Cloud Version") applies a state that arrived from ANOTHER
 * DEVICE, and it did so with none of this — no `initialGameState` merge, no
 * `mergeLoadedSlice`, no family↔relationships reconciliation. A cloud state is
 * strictly less trustworthy than a local one (it was written by a different
 * build, on a different device, possibly at a different STATE_VERSION), so the
 * path that has the WEAKER guarantees was the one running the WEAKER pipeline.
 * 2026-08-16 architecture audit M6.
 *
 * What is here is exactly what both paths need and nothing else. Deliberately
 * NOT here, because they are specific to loading from local storage:
 *
 *   - the save envelope decode / signature check and the backup fallback,
 *   - `runMigrations` (both callers run it first — the cloud path must also be
 *     able to REFUSE a future-version state before hydration),
 *   - the embedded protected-state restore (keyed on a storage slot),
 *   - the stock-market board restore (module-level, session-wide),
 *   - reading the permanent perks (an async IAP call — the perk IDS are passed
 *     in instead, and applied here so the ORDER stays what `loadGame` had).
 *
 * ORDER IS THE CONTRACT. Every step below depends on the ones before it, and
 * two of them are order-sensitive in a way that is easy to undo by accident:
 * `family`/`relationships` are assigned AFTER the spread (otherwise `parsed`
 * overwrites the reconciled arrays), and `enforceStateInvariants` runs LAST,
 * after the merge onto `initialGameState`, so it sees the state the app will
 * actually run rather than the one on disk.
 *
 * MUTATION: `repairGameState` writes its repaired clone back onto the object it
 * is given, so the `parsed` argument IS mutated in place — same as before the
 * extraction. Callers must treat `parsed` as consumed and use the returned
 * state. Cloning defensively here would cost a second multi-MB `structuredClone`
 * on every load, which is the very cost this change removes elsewhere.
 */
import { initialGameState } from '@/contexts/game/initialState';
import type { GameState } from '@/contexts/game/types';
import { logger } from '@/utils/logger';
import { mergeLoadedSlice } from '@/utils/loadedStateMerge';
import { repairGameState, validateGameState } from '@/utils/saveValidation';
import { validateRelationshipState, repairRelationshipState } from '@/utils/relationshipValidation';
import { enforceStateInvariants } from '@/utils/stateInvariants';
// Load-path telemetry. This is the ONE place a repair on load is observed
// exactly once per load, which is what makes it countable; `repairGameState`
// itself also runs on the SAVE path and from several action helpers, so
// instrumenting the function would count the same condition several times per
// week and make the number meaningless.
import { trackSaveRepaired } from '@/lib/analytics/reliability';

export interface HydrateLoadedStateOptions {
  /**
   * Where this state came from, e.g. `loadGame:slot-2` or `cloudSync:keep-cloud`.
   * Passed straight to `enforceStateInvariants` so an `[INVARIANT]` line names
   * the path that produced it.
   */
  source: string;
  /** Log prefix for the diagnostics emitted here. Defaults to `[LOAD_GAME]`. */
  logTag?: string;
  /** Permanent (IAP) perk ids to apply. Read by the caller — this module does no IO. */
  permanentPerks?: string[];
}

export interface HydrateLoadedStateResult {
  /** The hardened state. Always a value — hydration never rejects. */
  state: GameState;
  /** What `repairGameState` fixed, for the caller to log. */
  repairs: string[];
  /** The validation verdict. Advisory: an invalid state is still returned. */
  validation: { valid: boolean; errors: string[]; warnings: string[] };
  /** Relationship-graph problems found (and repaired) after the merge. */
  relationshipIssues: string[];
  /** Invariant violations found (and clamped where safe) at the very end. */
  invariantViolations: string[];
}

/**
 * Repair → validate → reconcile family → merge over defaults → heal identity →
 * apply perks → repair relationships → enforce invariants.
 */
export function hydrateLoadedState(
  parsed: unknown,
  options: HydrateLoadedStateOptions
): HydrateLoadedStateResult {
  const tag = options.logTag ?? '[LOAD_GAME]';
  const permanentPerks = options.permanentPerks ?? [];

  // Deliberately `any` at the boundary: this is an untrusted, genuinely partial
  // object off disk or off the wire. Every read below is guarded, and the
  // return type is what makes it a `GameState`.
  const raw = (parsed ?? {}) as Record<string, any>;

  // CRITICAL: Repair and validate state before setting it.
  // This prevents corrupted state from being set, even temporarily.
  const repairResult = repairGameState(raw);
  if (repairResult.repaired) {
    // A rise in this count after a release means a migration is not doing its
    // job — the condition that otherwise surfaces weeks later as a support
    // ticket about a feature that quietly reset itself. Only the COUNT of
    // repairs and the save's version are sent, never which fields: the field
    // list is unbounded and changes every release, so it would fragment into
    // one-row buckets rather than a number anyone can watch.
    trackSaveRepaired(
      repairResult.repairs.length,
      typeof raw.version === 'number' ? raw.version : undefined,
    );
  }

  // Validate AND auto-fix the repaired state. P0-6: `autoFix` runs autoFixStats,
  // which also resets non-finite (NaN/Infinity) core stats — otherwise such a
  // save loads as "valid" but is rejected at entry (unplayable).
  //
  // `skipRepair` is the L6 fix: `autoFix: true` re-ran `repairGameState`, whose
  // first act is a `structuredClone` of the whole state, so every load paid for
  // TWO deep clones of a multi-MB object to do one repair. The repair above has
  // already run on this exact object, so the second one only ever found nothing
  // to do. The flag drops the clone and keeps everything else `autoFix` changes
  // — the stat clamping AND the stricter error-vs-warning grading.
  const validation = validateGameState(raw, true, { skipRepair: true });

  // CRITICAL: Extract children from relationships first (before merging).
  // This ensures children created during onboarding are preserved.
  const parsedRelationships: any[] = Array.isArray(raw.relationships) ? raw.relationships : [];
  const childRelationships = parsedRelationships.filter((r: any) => r && r.type === 'child');

  // CRITICAL: Merge family — ensure children from both family.children and
  // relationships are preserved.
  let mergedFamily = raw.family ? { ...raw.family } : { ...initialGameState.family };
  const mergedChildren: any[] = Array.isArray(raw.family?.children) ? [...raw.family.children] : [];

  // Add any children from relationships that aren't already in family.children.
  childRelationships.forEach((childRel: any) => {
    if (!mergedChildren.some((c: any) => c && c.id === childRel.id)) {
      mergedChildren.push(childRel);
      logger.info(`${tag} Added child from relationships to family.children`, {
        childId: childRel.id,
        childName: childRel.name,
      });
    }
  });

  // CRITICAL: Ensure all children in family.children are also in relationships.
  const relationshipIds = new Set(parsedRelationships.map((r: any) => r?.id));
  mergedChildren.forEach((child: any) => {
    if (child && !relationshipIds.has(child.id)) {
      parsedRelationships.push(child);
      logger.info(`${tag} Added child from family.children to relationships`, {
        childId: child.id,
        childName: child.name,
      });
    }
  });

  mergedFamily = {
    ...initialGameState.family,
    ...mergedFamily,
    children: mergedChildren,
  };

  // CRITICAL: Build safeState, ensuring relationships and family are set AFTER
  // all spreads. This prevents `parsed` from overwriting the synced arrays.
  //
  // Merged with initialGameState so every required property exists. Parsed
  // values override the defaults, a null in the save does NOT, and a key the
  // save has survives even when the defaults object has none - that last rule
  // is `loadedStateMerge.ts`, and the fields it was quietly eating are listed
  // there.
  let safeState: GameState = {
    ...initialGameState,
    ...raw,
    stats: raw.stats ? mergeLoadedSlice(raw.stats, initialGameState.stats) : initialGameState.stats,
    date: raw.date ? mergeLoadedSlice(raw.date, initialGameState.date) : initialGameState.date,
    settings: raw.settings ? mergeLoadedSlice(raw.settings, initialGameState.settings) : initialGameState.settings,
    userProfile: raw.userProfile
      ? mergeLoadedSlice(raw.userProfile, initialGameState.userProfile)
      : initialGameState.userProfile,
  };

  // CRITICAL: Override family and relationships AFTER all spreads.
  safeState.family = mergedFamily;
  safeState.relationships = parsedRelationships.length > 0
    ? parsedRelationships
    : (initialGameState.relationships || []);

  // Update item descriptions from initialGameState to ensure they're current.
  if (Array.isArray(safeState.items) && Array.isArray(initialGameState.items)) {
    safeState.items = safeState.items.map(savedItem => {
      const initialItem = initialGameState.items.find(initItem => initItem.id === savedItem.id);
      if (initialItem && initialItem.description) {
        // Update description if it exists in initial state (preserves owned
        // status and other properties).
        return { ...savedItem, description: initialItem.description };
      }
      return savedItem;
    });
  }

  // CRITICAL FIX: Ensure userProfile has firstName and lastName (required for
  // validation). If missing or empty, derive from `name` or the defaults.
  if (!safeState.userProfile) {
    safeState.userProfile = { ...initialGameState.userProfile };
  } else {
    if (!safeState.userProfile.firstName || safeState.userProfile.firstName.trim() === '') {
      if (safeState.userProfile.name && safeState.userProfile.name.trim() !== '') {
        const nameParts = safeState.userProfile.name.trim().split(/\s+/);
        safeState.userProfile.firstName = nameParts[0] || 'Player';
        safeState.userProfile.lastName = nameParts.slice(1).join(' ') || 'Player';
      } else {
        safeState.userProfile.firstName = initialGameState.userProfile.firstName || 'Player';
        safeState.userProfile.lastName = initialGameState.userProfile.lastName || 'Player';
      }
    }
    if (!safeState.userProfile.lastName || safeState.userProfile.lastName.trim() === '') {
      safeState.userProfile.lastName = initialGameState.userProfile.lastName || 'Player';
    }
    if (!safeState.userProfile.name || safeState.userProfile.name.trim() === '') {
      safeState.userProfile.name =
        `${safeState.userProfile.firstName} ${safeState.userProfile.lastName}`.trim() || 'Player';
    }
  }

  // CRITICAL: Apply permanent perks to game state.
  if (permanentPerks.length > 0) {
    if (!safeState.perks) {
      safeState.perks = {};
    }
    permanentPerks.forEach(perkId => {
      if (perkId === 'workBoost') safeState.perks!.workBoost = true;
      if (perkId === 'mindset') safeState.perks!.mindset = true;
      if (perkId === 'fastLearner') safeState.perks!.fastLearner = true;
      if (perkId === 'goodCredit') safeState.perks!.goodCredit = true;
      if (perkId === 'unlockAllPerks') safeState.perks!.unlockAllPerks = true;
    });
    logger.info('Applied permanent perks to game state:', permanentPerks);
  }

  const relationshipValidation = validateRelationshipState(safeState);
  const relationshipIssues = relationshipValidation.isValid ? [] : relationshipValidation.issues;
  if (!relationshipValidation.isValid) {
    logger.warn(`${tag} Relationship inconsistencies detected, repairing`, {
      issues: relationshipValidation.issues,
    });
    safeState = repairRelationshipState(safeState);
  }

  // F-14: the LAST word on state sanity, after migrations, repair, autoFix and
  // the relationship repair above have all had their turn - and after the merge
  // onto `initialGameState`, so it sees the state the app will actually run.
  // It catches what the earlier stages miss (a `date.week` outside 1-4, which
  // `validateGameState` only rejects when negative; a negative or non-finite
  // `weeksLived`, which nothing else checks at all), logs every violation under
  // the grep-able `[INVARIANT]` tag, and clamps the safely-repairable ones. It
  // never rejects: a player's save must always load.
  const invariants = enforceStateInvariants(safeState, options.source);
  if (!invariants.clean) {
    logger.warn(`${tag} State invariant violations on load`, {
      source: options.source,
      violations: invariants.violations,
      warnings: invariants.warnings,
      repairs: invariants.repairs,
    });
    safeState = invariants.state;
  }

  return {
    state: safeState,
    repairs: repairResult.repaired ? repairResult.repairs : [],
    validation: {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    },
    relationshipIssues,
    invariantViolations: invariants.clean ? [] : invariants.violations,
  };
}

/**
 * The verdict on a state that arrived from ANOTHER DEVICE (cloud sync).
 *
 * A discriminated result rather than a thrown error or a bare `null`: the two
 * refusals mean different things to a caller and to a support ticket, and one
 * of them ("this would erase weeks you played") is the one a user needs told.
 */
export type RemoteStateDecision =
  | { applied: true; state: GameState; localWeeks: number; remoteWeeks: number; repairs: string[] }
  | {
      applied: false;
      reason: 'invalid' | 'regression';
      details: string[];
      localWeeks: number;
      remoteWeeks: number;
    };

/**
 * Hydrate a remote state and decide whether it may replace the live one.
 *
 * Two gates, in order:
 *
 *   1. It must survive hydration and come out VALID. A cloud state gets the
 *      same pipeline a local save gets - see `hydrateLoadedState` - because it
 *      is strictly less trustworthy, not more: different device, different
 *      build, possibly a different STATE_VERSION.
 *   2. It must not move `weeksLived` BACKWARDS. That is the absolute counter
 *      (CLAUDE.md §4.2); it only ever grows, so a remote state behind the live
 *      one is a rollback of weeks the player actually played. The same question
 *      `saveQueue.restoreQueue` asks of a replayed write ("would it move the
 *      slot backwards?"), asked at the other door.
 *
 * Callers must run `runMigrations` (and refuse a future-version state) BEFORE
 * calling this - migration is async and version policy is the caller's.
 */
export function hydrateRemoteState(
  remote: unknown,
  options: { localWeeksLived: number; source?: string; logTag?: string }
): RemoteStateDecision {
  const logTag = options.logTag ?? '[CloudSync]';
  const localWeeks = Number.isFinite(options.localWeeksLived) ? options.localWeeksLived : 0;

  const hydrated = hydrateLoadedState(remote, {
    source: options.source ?? 'cloudSync:keep-cloud',
    logTag,
  });

  const remoteWeeks = typeof hydrated.state.weeksLived === 'number' ? hydrated.state.weeksLived : 0;

  if (!hydrated.validation.valid) {
    logger.error(`${logTag} Remote state failed validation after repair`, {
      errors: hydrated.validation.errors,
    });
    return { applied: false, reason: 'invalid', details: hydrated.validation.errors, localWeeks, remoteWeeks };
  }

  if (remoteWeeks < localWeeks) {
    // Refused outright rather than re-prompted. The conflict alert has already
    // been dismissed by the time this runs, and asking a second time about a
    // state we can already see is stale is a trap, not a choice - consistent
    // with the sibling future-version refusal, which also just logs.
    logger.error(`${logTag} Refusing remote state: it would regress this device's progress`, {
      localWeeks,
      remoteWeeks,
    });
    return {
      applied: false,
      reason: 'regression',
      details: [`remote weeksLived ${remoteWeeks} is behind local ${localWeeks}`],
      localWeeks,
      remoteWeeks,
    };
  }

  return { applied: true, state: hydrated.state, localWeeks, remoteWeeks, repairs: hydrated.repairs };
}
