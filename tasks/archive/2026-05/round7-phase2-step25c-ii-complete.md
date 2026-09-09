# R7 Phase 2 step 2.5c-ii — per-education progression + closes education (complete)

> Largest extraction since the 220-line disease block. Six per-education sub-concerns folded into one helper. Education pipeline now fully extracted.

---

## What landed

| File | Change |
|---|---|
| **NEW** [contexts/game/actions/weekly/applyEducationProgression.ts](contexts/game/actions/weekly/applyEducationProgression.ts) | `applyEducationProgression(input, ctx)` — mutates `ctx.newStats.{happiness, energy, money, health, fitness, reputation}` and `ctx.notifications`. Returns `{ updatedEducations, pendingCampusEvent }`. Owns six sub-concerns per education: decrement / study-group / loans / exams / campus events / completion bonuses. |
| [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) | Inline map block (~90 lines) → 14-line helper call. Removed now-unused imports of `isExamWeek`, `runExam`, `updateGPA`, `shouldTriggerCampusEvent`. |
| [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts) | Added a `jest.mock('@/lib/education/educationSystem')` at module scope for determinism (since `runExam` and `shouldTriggerCampusEvent` use `Math.random`). 17 new tests covering every code path. |

---

## Test coverage breakdown

| Test | Code path exercised |
|---|---|
| empty array | early-return path |
| paused | filter predicate excludes |
| completed | filter predicate excludes |
| weeksRemaining=0 | filter predicate excludes |
| 1 active, no extras | normal decrement |
| Fast Learner gold | decrement = 2 (ceil(1.5)) |
| Fast Learner perk | decrement = 2 |
| both Fast Learner | decrement = 3 (ceil(2.25)) |
| weeksRemaining=1 → completes | sets `completed: true` |
| study group bonus | +2 happiness, -3 energy |
| student loan payment | money deducted, remaining bumped down |
| exam PASS (study group) | counters bump, GPA up, stats up, notification |
| exam FAIL (no group) | counters bump, GPA down, stats down |
| campus event triggers | `pendingCampusEvent` set to edu.id |
| completion with classes | 5-stat bonus + completion notification |
| multi-campus: last wins | `pendingCampusEvent` is final education's id |
| mixed (active + paused + completed) | each handled correctly |

---

## Why `jest.mock` instead of injecting dependencies

`runExam` calls `Math.random()` for the pass/fail roll, and `shouldTriggerCampusEvent` calls it for the event trigger. For snapshot stability, the helper's external dependencies must produce deterministic output in tests.

Two viable approaches:
1. **Module mock** (chosen) — `jest.mock('@/lib/education/educationSystem', () => …)` at module scope. The mock provides predictable behaviors keyed off the education's `id` prefix: `exam-*` triggers an exam, `campus-*` triggers a campus event.
2. **Dependency injection** — make the helper accept the four functions as parameters. Production wires in the real ones; tests pass mocks.

Option 1 is less invasive — production code stays simple, and the test mock is one declaration at the top of the test file. Mirrors the pattern from step 2.4b (stockMarket mock for auto-reinvest).

---

## Education pipeline complete

Two helpers, ~121 lines extracted total, 29 snapshots locked.

| Sub-step | Helper | Concern | Lines | Tests |
|---|---|---|---|---|
| 2.5c-i | `applyEducationStress` | Stress penalties (1-2-3+ multiplier + caps) | ~31 | 12 |
| 2.5c-ii | `applyEducationProgression` | Per-education map (6 sub-concerns) | ~90 | 17 |
| **Total** | **2 helpers** | **Full education pipeline** | **~121** | **29** |

`nextWeek()`'s ~120-line education section is now 2 helper calls.

---

## Step 2.5 fully complete

Three domain blocks extracted across 6 sub-steps:

| Sub-step | Helper | Concern | Lines | Tests |
|---|---|---|---|---|
| 2.5a | `applyDietPlanForWeek` | Active diet stat gains + cost | ~22 | 10 |
| 2.5b-i | `applyCareerSalaryAndPenalty` | Salary + penalty | ~58 | 13 |
| 2.5b-ii | `applyCareerApplications` | Pending app accept-after-N | ~39 | 11 |
| 2.5b-iii | `applyCareerProgress` | 5-factor progress | ~43 | 18 |
| 2.5c-i | `applyEducationStress` | Stress penalties | ~31 | 12 |
| 2.5c-ii | `applyEducationProgression` | Per-education map | ~90 | 17 |
| **Total** | **6 helpers** | **Full 2.5 trilogy** | **~283** | **81** |

---

## Why this is safe

1. **Source identity.** Every Math.max/min, every conditional, every external function call, the `lastExamWeek` / `examsPassed` / `examsFailed` / `gpa` updates, the student loan formula (capped at `remaining`), the study-group +2/-3, the completion class-bonus loop with 5 stats, and the two notification templates are verbatim from the inline code.
2. **Type-check clean.** `tsc --noEmit` → exit 0, 0 errors.
3. **Zero snapshot drift.** 17 snapshots locked BEFORE the GameActionsContext swap. After: 220/220 pass across the full battery.

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
| 2.5b-ii (career applications) | ~39 |
| 2.5b-iii (career progress) | ~43 |
| 2.5c-i (education stress) | ~31 |
| 2.5c-ii (education progression) | ~90 |
| **Running total** | **~1,075 lines** |

Original `nextWeek()` was ~2,300 lines. We're at **~47% extracted**, all behavior-preserving.

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor                    → 225 passed, 220 snapshots passed (zero drift)
npx jest __tests__/startup                     → 64 passed
npx jest __tests__/integration                 → 96 passed (zero regression)
```

**Total: 385 tests across 12 suites, 220 snapshots, zero drift.**

---

## Next: step 2.6 — relationships + family + crime + mining

The largest remaining domain block. The audit estimated ~280 lines covering:
- Pregnancy progression + birth handling
- Scheduled wedding execution / postpone / expire
- Child aging + relationship score decay
- Low-score breakup + disappointed-relationship rolls
- NPC depth tick
- Wanted-level + police encounter (crime)
- Mining: cryptos + warehouse + BTC halving + auto-repair + difficulty

This is **higher risk** than recent steps because:
- Relationships has multiple branchy state transitions (pregnancy, wedding, breakup)
- Crime path uses `preRolls.policeEncounter` and `wantedLevel`
- Mining uses `preRolls.minerDegradation` plus warehouse state

Should be sub-split — at least 4 sub-steps (relationships, crime, mining, family/aging).

Alternatives:
- **Step 2.7+** — events + cliffhanger + life-moments + meta-blocks (~350 lines combined).
- **Outside Phase 2** — SB-1 / Phase 5 / Phase 3 still queued.

Say "continue" for step 2.6 (with safe sub-splitting), name another priority, or stop here.
