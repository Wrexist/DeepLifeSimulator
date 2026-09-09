# R7 Phase 2 step 2.5a — diet plans extracted (complete)

> First slice of the careers + education + diet trilogy. Small, isolated WeekContext-mutation pattern. The diet block is the lowest-risk piece of the 2.5 group.

---

## Scope reduction (honest)

The audit plan grouped step 2.5 as "careers + education + diet" (~150 lines total). Sub-split:

- **2.5a (this step)** — diet plans only. ~22 lines.
- **2.5b queued** — career salary + penalties + applications + progress. ~90 lines.
- **2.5c queued** — education stress + exams + completion + study group + student loan. ~40 lines.

Each independently shippable. The diet block is the simplest of the three so it ships first.

---

## What landed

| File | Change |
|---|---|
| **NEW** [contexts/game/actions/weekly/applyDietPlan.ts](contexts/game/actions/weekly/applyDietPlan.ts) | `applyDietPlanForWeek(prevDietPlans, ctx)` — mutates `ctx.newStats.{health, energy, happiness, money}`. Returns `{ logMessage: string \| null }`. |
| [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) | Inline block (~22 lines) → 12-line `if (msg) logger.info(msg)` call. **Hoisted `weeklyCtx` up to the diet block** (was at the rent block from step 2.4c) — all reducers now share one instance. |
| [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts) | 10 new tests: empty / undefined / all-inactive / basic-active / with-happiness / happiness=0 (skipped) / gains-cap-at-100 / cost-exceeds-money (floor at 0) / multi-active (first wins per legacy `.find()`) / NaN-money (sanitized). |

---

## `WeekContext` hoist (continued incremental walk)

| Step | weeklyCtx home |
|---|---|
| 2.2b | Inside pet+vehicle block |
| 2.3 | Disease block |
| 2.4c | Rent + housing block |
| **2.5a** | **Diet block (above rent)** |

Each hoist preserves the same object reference for all downstream reducers. Mutations propagate naturally via JS reference semantics. The next reducer to extract above this point will continue the walk upward.

---

## Why this is safe

1. **Source identity.** Every Math.max/min clamp, every condition, the dailyCost × 7 weekly calculation, the NaN-guard on money, the log message format — all verbatim from the legacy inline code.
2. **Type-check clean.** `tsc --noEmit` → exit 0, 0 errors.
3. **Zero snapshot drift.** 10 new snapshots locked BEFORE the GameActionsContext change. After: 149/149 pass across the full battery.

---

## Cumulative `nextWeek()` reduction

| Step | Lines extracted |
|---|---|
| 2.1 (preTick) | ~180 |
| 2.2a-c (pets + vehicles + side effects) | ~127 |
| 2.3 (diseases) | ~220 |
| 2.4a-f (full finance pipeline) | ~265 |
| 2.5a (diet plan) | ~22 |
| **Running total** | **~814 lines** |

Original `nextWeek()` was ~2,300 lines. We're at **~35% extracted**, all behavior-preserving.

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor                    → 154 passed, 149 snapshots passed (zero drift)
npx jest __tests__/startup                     → 64 passed
npx jest __tests__/integration                 → 96 passed (zero regression)
```

**Total: 314 tests across 12 suites, 149 snapshots, zero drift.**

---

## Next: step 2.5b — career salary + penalties + applications

The denser career block at lines 475-533 + the application processing immediately after. ~90 lines total. Includes:

- Career salary lookup with level-bounds clamping.
- Work Pay Boost perk stacking (gold + IAP, 1.5× each, multiplicative).
- Career happiness/health penalty (-3 happiness, -2 health when employed).
- Pending application processing (1-2 week delay via `preRolls.careerAcceptDelay`).
- Career progress increment with mentor + mindset multipliers.

Mutates `ctx.newStats.happiness`, `ctx.newStats.health`. Returns `{ careerSalary, careerHappinessPenalty, careerHealthPenalty, updatedCareers, newCurrentJob, logMessage }`. Estimated 2-3 hours.

Alternatives:
- **Step 2.5c** — education (~40 lines, but several sub-concerns).
- **Step 2.6** — relationships + family + crime + mining (~280 lines).
- **Outside Phase 2** — SB-1 / Phase 5 / Phase 3 still queued.

Say "continue" for step 2.5b, name another priority, or stop here.
