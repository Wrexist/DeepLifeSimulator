# R7 Phase 2 step 2.5b-i — career salary + penalty extracted (complete)

> Second slice of the careers trilogy. Salary computation with multiplicative perk stack + happiness/health penalty. `WeekContext` now hoisted to the very top of the `setGameState` updater.

---

## Scope reduction (honest)

The audit grouped step 2.5b as "careers" (~90 lines covering salary + penalties + applications + progress). Sub-split:

- **2.5b-i (this step)** — salary + penalty only. ~58 lines.
- **2.5b-ii queued** — pending application processing (1-2 week accept delay). ~30 lines.
- **2.5b-iii queued** — career progress increment with mentor + mindset multipliers. ~25 lines.

Each independently shippable. Salary + penalty is the most isolated (no state transitions, no roll consumption).

---

## What landed

| File | Change |
|---|---|
| **NEW** [contexts/game/actions/weekly/applyCareerSalaryAndPenalty.ts](contexts/game/actions/weekly/applyCareerSalaryAndPenalty.ts) | `applyCareerSalaryAndPenalty(prevState, ctx)` — mutates `ctx.newStats.{happiness, health}`. Returns `{ careerSalary, careerHappinessPenalty, careerHealthPenalty }`. Logger calls (4 paths) preserved verbatim. |
| [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) | Inline block (~58 lines) → 5-line helper call. **Hoisted `weeklyCtx` ALL THE WAY UP to right after `newStats` creation** — every reducer now shares one instance. |
| [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts) | 13 new tests covering every branch — see the breakdown below. |

---

## `WeekContext` hoist — reaches the top of the updater

| Step | weeklyCtx home |
|---|---|
| 2.2b | Inside pet+vehicle block |
| 2.3 | Disease block |
| 2.4c | Rent + housing block |
| 2.5a | Diet block |
| **2.5b-i** | **Right after `newStats` creation (top of updater)** |

This is the final hoist — every future reducer extraction can use `weeklyCtx` without further migration.

---

## Test coverage breakdown

| Test | Code path exercised |
|---|---|
| no current job | early-return path, zeros + no mutation |
| careers array empty | `find` returns undefined → warn |
| not accepted | `accepted: false` → warn |
| no levels array | `levels.length === 0` → warn |
| level 0, no perks | normal happy path |
| out-of-bounds level (99) | clamped to last index |
| negative level | clamped to 0 |
| salary = 0 | level-data salary warn path |
| gold work_boost only | ×1.5 multiplier |
| perk workBoost only | ×1.5 multiplier |
| both gold + perk | ×2.25 (multiplicative stack) |
| penalty floor at 0 | happiness/health near 0 don't go negative |
| ID mismatch | `currentJob` set but no matching career in array |

---

## Why this is safe

1. **Source identity.** Every guard (`Array.isArray`, `.find`, bounds clamping with `Math.max/min`), every Math.round, every multiplier order, the four logger paths (1 info + 1 warn for missing career, 1 warn for level invalid, 1 info for normal path), and the final stat mutations are verbatim copies of the inline code.
2. **Type-check clean.** `tsc --noEmit` → exit 0, 0 errors.
3. **Zero snapshot drift.** 13 snapshots locked BEFORE the GameActionsContext swap. After: 162/162 pass across the full battery.

---

## Cumulative `nextWeek()` reduction

| Step | Lines extracted |
|---|---|
| 2.1 (preTick) | ~180 |
| 2.2a-c (pets + vehicles + side effects) | ~127 |
| 2.3 (diseases) | ~220 |
| 2.4a-f (full finance pipeline) | ~265 |
| 2.5a (diet plan) | ~22 |
| 2.5b-i (career salary + penalty) | ~58 |
| **Running total** | **~872 lines** |

Original was ~2,300 lines. We're at **~38%** extracted.

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor                    → 167 passed, 162 snapshots passed (zero drift)
npx jest __tests__/startup                     → 64 passed
npx jest __tests__/integration                 → 96 passed (zero regression)
```

**Total: 327 tests across 12 suites, 162 snapshots, zero drift.**

---

## Next: step 2.5b-ii — pending career application processing

The next block at lines ~554+. Includes:
- Find first pending career (`applied && !accepted`).
- Increment `applicationWeeksPending`.
- After `preRolls.careerAcceptDelay` weeks (1 or 2), accept it → set `accepted: true`, `currentJob = pendingCareer.id`.
- Otherwise just bump the pending counter.

Mutates `prevState.careers` array (returns new array via map) and `currentJob` field. Returns `{ updatedCareers, newCurrentJob, logMessage }`. Estimated 1-2 hours.

Alternatives:
- **Step 2.5c** — education stress + exams + completion (~40 lines).
- **Step 2.6** — relationships + family + crime + mining (~280 lines).
- **Outside Phase 2** — SB-1 / Phase 5 / Phase 3 still queued.

Say "continue" for step 2.5b-ii, name another priority, or stop here.
