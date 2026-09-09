# R7 Phase 2 step 2.5b-ii — career application processing extracted (complete)

> Third slice of the careers trilogy. Pure state-transition helper for pending applications — accept after 1-2 weeks based on `preRolls.careerAcceptDelay`.

---

## What landed

| File | Change |
|---|---|
| **NEW** [contexts/game/actions/weekly/applyCareerApplications.ts](contexts/game/actions/weekly/applyCareerApplications.ts) | `applyCareerApplications(input)` — pure. Returns `{ updatedCareers, newCurrentJob, logMessage }`. Same find-first semantics, same accept-after-N-weeks logic, preserves the `updatedCareers === prevCareers` reference when nothing changes (matches legacy `let updatedCareers = prevState.careers`). |
| [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) | Inline block (~39 lines) → 11-line call. |
| [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts) | 11 new tests covering every branch. |

---

## Test coverage breakdown

| Test | Code path exercised |
|---|---|
| no careers | empty array → no change, undefined job |
| undefined careers | null-coalesce → empty array |
| no pending (all accepted) | `find` returns undefined |
| pending BUT currentJob set | guard blocks acceptance |
| delay=1, weeksPending=0 | `1 >= 1` → ACCEPT path |
| delay=2, weeksPending=0 | `1 < 2` → DEFER path (counter bumps to 1) |
| delay=2, weeksPending=1 | `2 >= 2` → ACCEPT path |
| undefined weeksPending | `|| 0` fallback → starts at 1 |
| multiple pending | only FIRST processed (legacy `.find()`) |
| mix accepted + pending | pending processed when no currentJob |
| no change → ref preserved | `expect(updatedCareers).toBe(careers)` — strict identity |

The last test is a behavior preservation guarantee: when no application is processed, the SAME `careers` array reference is returned. This matches the legacy code's `let updatedCareers = prevState.careers` (initialized once, only reassigned on change). Downstream `===` checks that rely on this still work.

---

## Why this is safe

1. **Source identity.** The `find` predicate, the `weeksPending = (... || 0) + 1` math, the conditional accept/defer, the two `.map` branches (one clearing `applicationWeeksPending: undefined`, one setting it to the new counter), and the log message format are verbatim from the inline code.
2. **Type-check clean.** `tsc --noEmit` → exit 0, 0 errors.
3. **Zero snapshot drift.** 11 snapshots locked BEFORE the GameActionsContext swap. After: 173/173 pass across the full battery.

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
| **Running total** | **~911 lines** |

Original was ~2,300 lines. We're at **~40% extracted**, all behavior-preserving.

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor                    → 178 passed, 173 snapshots passed (zero drift)
npx jest __tests__/startup                     → 64 passed
npx jest __tests__/integration                 → 96 passed (zero regression)
```

**Total: 338 tests across 12 suites, 173 snapshots, zero drift.**

---

## Next: step 2.5b-iii — career progress with mentor + mindset multipliers

The remaining career sub-block at lines ~558+. Includes:
- For each active career: increment `progress` based on `performance`
- Apply mentor multiplier (`prestige.unlockedBonuses` includes mentor)
- Apply mindset multiplier (`mindset.id` selects a coefficient)
- Promotion when progress crosses 100 (move to next level, reset progress)

Mutates `updatedCareers` (potentially again, after applications). Estimated 1-2 hours.

Alternatives:
- **Step 2.5c** — education (~40 lines).
- **Step 2.6** — relationships + family + crime + mining (~280 lines).
- **Outside Phase 2** — SB-1 / Phase 5 / Phase 3 still queued.

Say "continue" for step 2.5b-iii, name another priority, or stop here.
