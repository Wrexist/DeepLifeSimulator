Now I have a complete picture. Let me compile the final findings:

---

## FINDINGS

### P0 — Critical (save corruption / always-broken logic)

---

**[P0-1] `gainCriminalXp` and `gainCrimeSkillXp` fire as separate, non-atomic `setGameState` calls after the main street-job update**
`contexts/game/actions/JobActions.ts:387–392`

Both are invoked unconditionally *after* the main `setGameState` block completes — even when the player was `caught`. React batches all three `setGameState` calls in the same event, but each updater reads `prev` from a potentially different snapshot. Specifically, the `gainCrimeSkillXp` updater reads `prev.crimeSkills[skillId].xp` from the state *before* `gainCriminalXp`'s level-up ran, so if the main job push crosses the `criminalLevel` threshold, the XP level-up in `gainCriminalXp` may double-fire or be skipped entirely. More importantly: the caught path at lines 208–243 does **not** skip calls to `deps.gainCriminalXp` / `deps.gainCrimeSkillXp` (the guard is `!caught` only for message formatting, not for XP — line 387 check is `if (job.illegal)`). A caught criminal gains XP every time.

**Root cause:** XP side-effects are not folded into the main atomic updater.

**Fix:** Inline the level-up math from `gainCriminalXp` (lines 436–449) and `gainCrimeSkillXp` (452–490) into the two `setGameState(prev => …)` blocks. Remove the `deps.gainCriminalXp/gainCrimeSkillXp` calls at 387–392. Gate XP gain on `!caught` explicitly.

---

**[P0-2] `autoFixStats` mutates the live state object in-place via the `unknown` reference; `validateGameState(autoFix=true)` path corrupts React state without triggering re-render**
`utils/saveValidation.ts:277, 287`

```ts
state.stats[stat] = Math.max(min, Math.min(max, state.stats[stat]));
```

Although `saveGame` currently calls `validateGameState(state, false)` (line 196 of `GameActionsContext.tsx`), any call path that passes `autoFix=true` — including the repair branch which calls `repairGameState` first, and any future caller — will mutate `state.stats` directly on the live GameState object. `repairGameState` correctly deep-clones then copies back (lines 362–908), but `autoFixStats` skips the clone, directly assigning into `state.stats[stat]`. This silently alters in-memory state without triggering React subscriber re-renders (same object reference). The comment at line 204 in `GameActionsContext.tsx` even acknowledges the issue for `repairGameState` but the parallel `autoFixStats` was never given the same treatment.

**Fix:** At the top of `autoFixStats`, deep-clone `state.stats` (or the whole object) before mutating. Return the patched copy; copy-back to original only if needed, matching the `repairGameState` pattern.

---

**[P0-3] `saveGame` re-validates against `gameStateRef.current` AFTER scheduling a `setGameState` repair, but the ref hasn't updated yet — re-validation always passes on stale state**
`contexts/game/GameActionsContext.tsx:205–215`

```ts
setGameState(prev => {
  const result = repairGameState(prev);
  return result.repaired ? {...prev} : prev;  // ← schedules async update
});
// Re-validate after repair
const revalidation = validateGameState(gameStateRef.current, false); // ← reads STALE ref
```

`setGameState` is asynchronous; `gameStateRef.current` still points to the original (invalid) state when the re-validation runs immediately after. The re-validation always reads the pre-repair state. If the repair failed or returned `!repaired`, the code falls into the `else` branch (line 217) and shows "cannot be repaired" even though a repair was attempted and may have partially succeeded. The `stateToPersist` on line 225 uses `currentState` (also stale).

**Fix:** Run `repairGameState` synchronously on a local copy, validate that copy, then persist it — removing the nested async `setGameState`. Updating React state for UI consistency can be done with a single `setGameState` call using the repaired copy.

---

### P1 — High (wrong behavior, reproducible by players)

---

**[P1-1] Energy cost in `performStreetJob` has no atomic inner guard — stale outer check allows 0-energy job execution that silently clamps to 0**
`contexts/game/actions/JobActions.ts:59–64, 237–240, 377–378`

The outer energy check (line 59) reads `gameState.stats.energy` from a render-cycle snapshot. Neither the caught branch (line 237–240) nor the not-caught branch (line 377–378) re-checks `prev.stats.energy >= job.energyCost` inside the `setGameState` updater. Two rapid taps can both pass the outer check when energy = 1 and `energyCost = 20`: both `setGameState` batches run, the first clamps to `Math.max(0, 1 - 20) = 0`, and the second also clamps to `Math.max(0, 0 - 20) = 0`. The player does two jobs for the cost of one. This matches the reported "energy doesn't drain instantly" behavior — the UI does update on the next render, but the second action slips through.

**Fix:** As the first line of both caught and not-caught `setGameState(prev => …)` blocks, add:
```ts
if (prev.stats.energy < job.energyCost) return prev;
```

---

**[P1-2] `cancelEngagement` and `checkAnniversary` use separate `setGameState` calls for stat changes — non-atomic with relationship update**
`contexts/game/actions/DatingActions.ts:1006, 1009; 1060, 1062`

```ts
deps.updateStats(setGameState, { happiness: -15 }); // batch #1
setGameState(prev => ({ ...prev, relationships: … })); // batch #2
```

The happiness delta (batch #1) and the relationship mutation (batch #2) are separate updaters. In React 18+ automatic batching flushes both, but batch #2's `prev` reflects state *before* batch #1's happiness change if they run in the same flush. Result: the relationship score clamped in batch #2 reads stale `relationshipScore`. Also, under StrictMode double-invocation, batch #1 fires twice — happiness is penalized twice. The `checkAnniversary` happiness bonus at line 1060 has the same race.

**Fix:** Merge the stat delta inline into the single `setGameState` block that already modifies `relationships`. No external `deps.updateStats` call needed.

---

**[P1-3] `performJailActivity` success-roll is computed OUTSIDE the `setGameState` updater with a bare `Math.random()` call — React 19 StrictMode double-invocation produces inconsistent outcomes**
`contexts/game/JobActionsContext.tsx:270`

```ts
const success = !activity.successRate || Math.random() < activity.successRate;
```

This bare `Math.random()` runs during the render-phase function body, not inside a `setGameState` updater. In React 19 StrictMode, the component function body is called twice with the same render; the second invocation produces a different random value. The `setGameState` block at line 276 captures the outer `success` variable — but which invocation's `success` is used depends on React's discard logic. Saves `PITY_THRESHOLD_STREET_JOB` pattern avoids this by pre-rolling *before* `setGameState`, but jail activities don't follow the same pattern.

**Fix:** Pre-roll `const success = …; const failRoll = Math.random();` before entering the `useCallback` body, or move the roll outside the component into a ref, matching the pattern used in `performStreetJob` (`successRollKey` / `getDeterministicRoll`).

---

**[P1-4] `StakingPosition.startWeek` stores `weeksLived` but the field name is ambiguous — legacy saves may have stored the cyclic `week` (1-4) value, causing wrong reward calculations**
`contexts/game/actions/MiningActions.ts:413–415, 464–466`

```ts
startWeek: prev.weeksLived || 0,
startAbsoluteWeek: prev.weeksLived || 0,
```

New positions correctly store `weeksLived` in both fields. The migration guard (line 464–466) handles legacy saves by capping:
```ts
const legacyStartWeek = typeof position.startWeek === 'number' ? position.startWeek : 0;
const startAbsoluteWeek = position.startAbsoluteWeek ?? Math.min(legacyStartWeek, absoluteWeek);
```
If `startWeek` was accidentally stored as cyclic 1–4, `Math.min(3, 500)` = 3, meaning the position appears to have been staked 497 weeks ago. This gives a massive inflated payout on first claim after migration.

**Fix:** In the migration guard, add a sanity check: if `legacyStartWeek > 0 && legacyStartWeek <= 4 && absoluteWeek > 4`, treat `startWeek` as corrupted and set `startAbsoluteWeek = absoluteWeek` (treat as freshly staked). Add a note in `saveMigrations.ts` v16 to backfill `startAbsoluteWeek` from `weeksLived` on any position missing it.

---

**[P1-5] `repairGameState` copy-back at lines 897–908 uses `{...prev}` spread in the `setGameState` caller but `repairGameState` already mutated `prev` in-place — spread creates a new reference but all nested objects are the ones repairGameState already mutated**
`contexts/game/GameActionsContext.tsx:205–208`

```ts
setGameState(prev => {
  const result = repairGameState(prev);         // mutates prev in-place
  return result.repaired ? {...prev} : prev;    // spread copies mutated nested refs
});
```

`repairGameState` deep-clones internally and then copies-back onto `state` (the original `prev`). The `{...prev}` spread at line 207 creates a new top-level object with fresh identity so React sees a state change — that part is correct. However, the comment on line 204 says "spread to create new reference for React" implying the concern is React's reference equality check, not the nested ref freshness. The nested objects *are* fresh (repairGameState's copy-back assigns new clone objects to each key), so this works correctly. This is **not a bug** per se, but a misleading comment — the spread is redundant since `repairGameState` already replaces all nested references. Including for completeness.

---

### P2 — Medium (edge case / exploit vector / minor correctness issue)

---

**[P2-1] `week` (cyclic 1-4) is used as the `generatedAtWeeksLived` stamp in `applyWeeklyEvents` synthetic state for the event engine — but only as the input to `rollWeeklyEvents`, not as a stamp**
`contexts/game/actions/weekly/applyWeeklyEvents.ts:57–60`

The synthetic state passed to `rollWeeklyEvents` uses `nextWeeksLived` correctly for `weeksLived`, and the returned events are stamped with `generatedAtWeeksLived: nextWeeksLived` (absolute). However, the synthetic state also sets `week: nextWeek` (the cyclic 1-4 value from the parameter), and `rollWeeklyEvents` may use `state.week` internally for event filtering. If any event condition checks `state.week < 3` or `state.week === 1` for seasonality, those checks are against the cyclic value and will produce different results depending on which of the 4 weeks in a month the event was generated. This is by design for seasonal events but creates a subtle exploit: a player who saves/reloads just before a week boundary can manipulate which `week` value (1-4) is used to generate favorable events. Not a state corruption issue but an exploit vector.

**Root cause:** Event generation is tied to the cyclic `week` value rather than a monotonic time reference.

---

**[P2-2] `validateGameState` checks `state.date.week >= 0` but `date.week` is the cyclic UI value and should be validated as 1–4, not just `>= 0`**
`utils/saveValidation.ts:1044`

```ts
if (!isValidNumber(state.date.week) || state.date.week < 0) {
  errors.push(`Invalid week: ${state.date.week}`);
```

`state.date.week` is the 1-4 cyclic UI value (per CLAUDE.md and types). The validator allows `week = 0`, which is invalid. This is inconsistent with `stateInvariants.ts:133–134` which correctly enforces `< 1 || > 4`. A save with `week: 0` passes `validateGameState` but fails `validateStateInvariants`, creating a divergence where the save validator is less strict than the invariant checker. Could allow a corrupt save to persist that then trips the invariant check on load.

**Fix:** Change the validator condition to `state.date.week < 1 || state.date.week > 4`.

---

**[P2-3] `repairGameState` does not repair missing `sparkApp.lifetimeStats` fields (only restores the whole object if entirely absent)**
`utils/saveValidation.ts:448–466`, `utils/saveMigrations.ts:327–342`

The `repairGameState` subsystem shallow-merge (`{ ...seedObj, ...currentObj }`) handles top-level keys of `sparkApp` but does NOT recurse into `sparkApp.lifetimeStats`. The v15 migration creates the object if entirely missing, but a partially-migrated save (e.g., corrupted mid-migration) with `sparkApp.lifetimeStats` present but missing `totalDivorces` or `totalPremiumWeeks` fields will pass migration checks (object exists, no per-field check) and then crash at runtime when code reads `sparkApp.lifetimeStats.totalDivorces` which is `undefined`.

**Fix:** In the v15 migration, spread default values under every `lifetimeStats` field using object spread: `s.lifetimeStats = { totalSwipes: 0, …, ...s.lifetimeStats }` (defaults first, existing values win).

---

**[P2-4] `StakingPosition.startWeek` in `types.ts` is documented as separate from `startAbsoluteWeek` but both are set to `prev.weeksLived` — the legacy field serves no purpose in new saves and creates confusion**
`contexts/game/types.ts:600–607`, `contexts/game/actions/MiningActions.ts:413–414`

`StakingPosition` defines:
```ts
startWeek: number;       // documented as possibly cyclic 
startAbsoluteWeek?: number; // monotonic — the real source of truth
```

New positions (line 413-414) set both to `weeksLived`. The migration guard (line 464-466) uses `startAbsoluteWeek ?? Min(legacyStartWeek, absoluteWeek)`. Since both are now equal, the `??` fallback never fires for new saves, making `startWeek` a dead redundant field for all saves created post-v16. However, the field name `startWeek` is misleading — future developers may store the cyclic value in it.

**Fix:** Deprecate `startWeek` in the type definition with a comment directing code to use `startAbsoluteWeek`. No migration needed since all new saves correctly populate `startAbsoluteWeek`.

---

**[P2-5] Version 19 migration is a no-op state bump but is NOT listed in `NO_OP_MIGRATION_VERSIONS`**
`utils/saveMigrations.ts:517–520, 30`

```ts
const NO_OP_MIGRATION_VERSIONS = new Set<number>([2, 3, 4, 5, 6, 7, 8, 9]);

19: (state) => {
  state.version = 19;
  return state;
},
```

Version 19 is a schema-less bump (HMAC key rotation only). It IS registered as a function in `migrations` (so `isMigrationVersionCovered(19)` returns `true`), but it is not in `NO_OP_MIGRATION_VERSIONS`. The migration chain runs the v19 function correctly (no crash). However, the intent of `NO_OP_MIGRATION_VERSIONS` is to document intentional no-schema bumps — v19 matches that intent but the documentation is incomplete. More importantly, the migration function mutates `state.version = 19` before returning, but `runMigrations` also sets `state.version = targetVersion` (line 579) after calling the function, making the in-function assignment redundant. No real bug, but inconsistency.

**Fix:** Either move v19 into `NO_OP_MIGRATION_VERSIONS` and remove the migration function, or remove the `state.version = 19` line from inside the function (the loop handles versioning).

---

### Summary Table

| ID | File:Line | Severity | Root Cause |
|---|---|---|---|
| P0-1 | `contexts/game/actions/JobActions.ts:387–392` | P0 | `gainCriminalXp`/`gainCrimeSkillXp` are non-atomic separate `setGameState` calls; caught path grants XP incorrectly |
| P0-2 | `utils/saveValidation.ts:277, 287` | P0 | `autoFixStats` mutates live state in-place instead of cloning; bypasses React immutability |
| P0-3 | `contexts/game/GameActionsContext.tsx:205–215` | P0 | Re-validation after repair reads stale `gameStateRef.current` before async `setGameState` update runs |
| P1-1 | `contexts/game/actions/JobActions.ts:59–64, 377–378` | P1 | No inner energy guard in `setGameState` updater; rapid taps bypass the outer snapshot check, draining energy without blocking |
| P1-2 | `contexts/game/actions/DatingActions.ts:1006, 1060` | P1 | `cancelEngagement`/`checkAnniversary` use separate `setGameState` for stat changes — non-atomic race with relationship update |
| P1-3 | `contexts/game/JobActionsContext.tsx:270` | P1 | Jail activity success roll uses bare `Math.random()` outside updater — React 19 StrictMode double-invocation inconsistency |
| P1-4 | `contexts/game/actions/MiningActions.ts:464–466` | P1 | Legacy `startWeek` cyclic-value guard can inflate staking rewards massively on first claim for old saves |
| P1-5 | `contexts/game/GameActionsContext.tsx:205–208` | P1 | Misleading comment about `{...prev}` spread; behavior is correct but relies on `repairGameState` side-effect contract being honored |
| P2-1 | `contexts/game/actions/weekly/applyWeeklyEvents.ts:57–60` | P2 | `state.week` (cyclic 1-4) passed to `rollWeeklyEvents` enables event-farming exploit via save/reload at week boundary |
| P2-2 | `utils/saveValidation.ts:1044` | P2 | `date.week` validated as `>= 0` instead of `1–4`; diverges from `stateInvariants.ts` and allows invalid `week: 0` saves |
| P2-3 | `utils/saveMigrations.ts:327–342` | P2 | `sparkApp.lifetimeStats` partial-object not deep-merged in repair — missing fields crash at runtime on partial migration |
| P2-4 | `contexts/game/types.ts:600–607` | P2 | `StakingPosition.startWeek` is redundant (same value as `startAbsoluteWeek`) but named ambiguously — future mutation risk |
| P2-5 | `utils/saveMigrations.ts:30, 517–520` | P2 | v19 no-op migration not in `NO_OP_MIGRATION_VERSIONS`; redundant `state.version` assignment inside function body |