# R7 Phase 2 step 2.5b-iii — career progress + closes careers trilogy (complete)

> Final slice of the careers trilogy. Pure 5-factor multiplicative progress formula extracted, 18 snapshots covering every code path.

---

## What landed

| File | Change |
|---|---|
| **NEW** [contexts/game/actions/weekly/applyCareerProgress.ts](contexts/game/actions/weekly/applyCareerProgress.ts) | `applyCareerProgress(input)` — pure. Returns `{ updatedCareers }`. Preserves the prevCareers reference when no change. |
| [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) | Inline block (~43 lines) → 10-line call. Removed now-unused `calcPerf` import. |
| [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts) | 18 new tests covering every code path of the 5-factor formula. |

---

## Test coverage — 5 multiplicative factors

| Factor | Tests |
|---|---|
| `baseProgressRate = 5` | happy path |
| `earlyBoost` (3 tiers: <20, 20-39, 40+) | 3 boundary tests |
| `mentorBuff` (active vs expired) | 2 tests |
| `perfModifier` (4 tiers: ≥80, ≥50, ≥30, <30) | 4 boundary tests |
| `mindsetMultiplier` (gold + perk stacking) | 3 tests (gold-only, perk-only, both) |
| Cap at 100 | 1 test |
| `startedWeeksLived` initialization vs preservation | 2 tests |
| Other careers unchanged | 1 test |
| No matching active career | 2 tests (returns prevCareers ref) |

The strict-identity assertion in "no current job" and "no matching career" tests guarantees the same downstream `===` semantics as the inline code.

---

## Careers trilogy complete

Three helpers, ~140 lines extracted total, 42 snapshots locked.

| Sub-step | Helper | Concern | Lines | Tests |
|---|---|---|---|---|
| 2.5b-i | `applyCareerSalaryAndPenalty` | Salary lookup + Work Pay Boost + penalty | ~58 | 13 |
| 2.5b-ii | `applyCareerApplications` | Pending application accept-after-N | ~39 | 11 |
| 2.5b-iii | `applyCareerProgress` | 5-factor progress increment | ~43 | 18 |
| **Total** | **3 helpers** | **Full careers pipeline** | **~140** | **42** |

`nextWeek()`'s ~140-line careers section is now 3 helper calls.

---

## Why this is safe

1. **Source identity.** All four conditional thresholds (<20 / 20-39 / 40+ for earlyBoost; ≥80 / ≥50 / ≥30 / <30 for perfModifier), every multiplier value, the `mentor.expiresWeeksLived > nextWeeksLived` guard, the `Math.min(100, ...)` cap, the `startedWeeksLived ?? nextWeeksLived` initialization, and the `performance` field write are verbatim from the legacy inline code.
2. **Type-check clean.** `tsc --noEmit` → exit 0, 0 errors.
3. **Zero snapshot drift.** 18 snapshots locked BEFORE the GameActionsContext swap. After: 191/191 pass across the full battery.

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
| **Running total** | **~954 lines** |

Original was ~2,300 lines. **~41% extracted**, all behavior-preserving.

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor                    → 196 passed, 191 snapshots passed (zero drift)
npx jest __tests__/startup                     → 64 passed
npx jest __tests__/integration                 → 96 passed (zero regression)
```

**Total: 356 tests across 12 suites, 191 snapshots, zero drift.**

---

## Next: step 2.5c — education

The education block at lines ~568+. Includes:
- Stress penalties scaled by number of active educations + multiplier cap.
- `weeksRemaining` decrement per education.
- Study-group bonus computation.
- Student loan payment (deducted from money).
- Exam (`isExamWeek` / `runExam` / `updateGPA`).
- Campus event roll (`shouldTriggerCampusEvent` + `pendingCampusEventEducationId`).
- Completion class bonuses.

Estimated 3-4 hours due to the multiple sub-concerns. Could be sub-split further.

Alternatives:
- **Step 2.6** — relationships + family + crime + mining (~280 lines, higher risk).
- **Outside Phase 2** — SB-1 / Phase 5 / Phase 3 still queued.

Say "continue" for step 2.5c, name another priority, or stop here.
