# R7 Phase 2 step 2.5c-i — education stress penalties extracted (complete)

> First slice of education. Stress-penalty block with stress multiplier + anti-exploit caps. The denser per-education map block stays inline pending 2.5c-ii.

---

## Scope reduction (honest)

The education inline block at lines 537-668 is ~131 lines covering 7 sub-concerns (stress + decrement + study group + loans + exams + campus events + completion). Sub-splitting:

- **2.5c-i (this step)** — stress penalties + active-count gate. ~31 lines.
- **2.5c-ii queued** — per-education map (decrement + study group + loans + exams + campus + completion). ~90 lines.

Step 2.5c-ii is one of the longest extractions remaining. Splitting keeps risk low and snapshot backstops accumulate.

---

## What landed

| File | Change |
|---|---|
| **NEW** [contexts/game/actions/weekly/applyEducationStress.ts](contexts/game/actions/weekly/applyEducationStress.ts) | `applyEducationStress(prevEducations, ctx)` — mutates `ctx.newStats.{happiness, health, energy}`. Returns `{ numActiveEducations, logMessage }`. The count is used by the caller to gate the per-education map block. |
| [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) | Inline block (~31 lines) → 10-line helper call + log + gate. Map block continues inline. |
| [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts) | 12 new tests covering empty / undefined / all-completed / all-paused / weeksRemaining=0 / 1-active / 2-active / 3+-active / cap-clamping / floor-clamping / energy-not-clamped / mixed-state. |

---

## Test coverage breakdown

| Test | Code path exercised |
|---|---|
| empty / undefined | early-return path |
| all-completed | filter predicate excludes |
| all-paused | filter predicate excludes |
| weeksRemaining = 0 | filter predicate excludes |
| 1 active | 1.0× multiplier |
| 2 active | 1.3× multiplier |
| 3+ active | 1.6× multiplier |
| 5 active (cap test) | floors at -20/-10/-25 |
| happiness near floor | clamped at 0 |
| energy near floor | **NOT clamped** here (legacy intentional) |
| mixed state | only active counted |

The "energy NOT clamped" test verifies a subtle legacy behavior: the inline code applies the energy penalty WITHOUT a `Math.max(0, ...)` because the final 0-100 cap happens later in the updater. Preserving this exact non-clamping behavior — if a future change introduces a clamp here, the snapshot fails loudly.

---

## Why this is safe

1. **Source identity.** Filter predicate, stress multiplier tiers (1.0 / 1.3 / 1.6), base penalty values (-6 / -3 / -7), cap values (-20 / -10 / -25), Math.round + Math.max calc, the clamp on happiness + health but NOT energy, the log format — all verbatim from the inline code.
2. **Type-check clean.** `tsc --noEmit` → exit 0, 0 errors.
3. **Zero snapshot drift.** 12 snapshots locked BEFORE the GameActionsContext swap. After: 203/203 pass across the full battery.

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
| **Running total** | **~985 lines** |

Original was ~2,300 lines. **~43% extracted**, all behavior-preserving.

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor                    → 208 passed, 203 snapshots passed (zero drift)
npx jest __tests__/startup                     → 64 passed
npx jest __tests__/integration                 → 96 passed (zero regression)
```

**Total: 368 tests across 12 suites, 203 snapshots, zero drift.**

---

## Next: step 2.5c-ii — per-education map (decrement + study group + loans + exams + campus + completion)

The remaining ~90-line per-education block. Mutates `updatedEducations` and `ctx.newStats` + `ctx.notifications`. Uses three external module functions (`isExamWeek`, `runExam`, `updateGPA`, `shouldTriggerCampusEvent`) which are pure but their stability depends on the module-level state of `educationSystem`.

This is the largest remaining single block. Likely 3-4 hours including ~12-15 snapshot scenarios:
- empty / undefined educations
- 1 active, no exam week, no campus event
- exam week pass
- exam week fail
- campus event fires
- education completes this week (decrement to 0)
- study group bonus + cost
- student loan payment
- multi-education tick
- Fast Learner perk (1.5× decrement)

Alternatives:
- **Step 2.6** — relationships + family + crime + mining (~280 lines, higher risk).
- **Outside Phase 2** — SB-1 / Phase 5 / Phase 3 still queued.

Say "continue" for step 2.5c-ii, name another priority, or stop here.
