# R7 Phase 2 step 2.4e — per-loan autopay extracted (complete)

> Fifth slice of the finance pipeline. The densest sub-block by branching complexity (APR normalization × payment fallback × bankruptcy floor × breathing-room override × missed-payment penalty). 14 snapshots cover every code path.

---

## What landed

| File | Change |
|---|---|
| **NEW** [contexts/game/actions/weekly/applyLoanAutopay.ts](contexts/game/actions/weekly/applyLoanAutopay.ts) | `applyLoanAutopay(input)` — pure. Threads cash via explicit input/output instead of mutating a closure variable. Returns `{ processedLoans, totalLoanAutoPaid, totalLoanPenalty, cashAfter }`. |
| [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) | Inline per-loan iteration (~52 lines) → 11-line helper call. Hoists the cash computation into `cashBeforeLoans`, calls the helper, destructures the result. Removed 2 now-unused imports: `LOAN_MISSED_PAYMENT_PENALTY`, `BANKRUPTCY_FLOOR`. |
| [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts) | 14 new tests covering every branch — see the breakdown below. |

---

## Test coverage breakdown

| Test | Code path exercised |
|---|---|
| no loans | empty `prevLoans` → empty result |
| undefined loans | `undefined` fallback |
| zero remaining | filtered out (already paid) |
| NaN remaining | sanitized to 0 → filtered |
| affordable autopay | normal happy path |
| can't afford | missed payment → penalty |
| bankruptcy floor blocks | `cash >= payment` but `cash - payment < floor` AND no force-payment |
| forcePayment override | `cash >= payment * 2` ignores floor |
| APR as percentage (>1) | divided by 100 |
| weeksRemaining=0 fallback | paymentDue = full remainingWithInterest |
| weeksRemaining>0 fallback | paymentDue = remainingWithInterest / weeksRemaining |
| loan paid off this week | filtered out (post-pay remaining <= 0) |
| multi-loan cash drain | iteration order affects what's affordable |
| high-APR missed | compounding via `LOAN_MISSED_PAYMENT_PENALTY` |

---

## Why pure (no `WeekContext`)

The inline code mutated `cashAfterIncomeAndRent` — a local closure variable, NOT `newStats.money`. The helper threads cash through explicit `cashAvailable` (input) and `cashAfter` (output). This is cleaner than the closure mutation and equally efficient. The caller assigns the result back to its own local `cashAfterIncomeAndRent` variable to preserve the downstream contract.

---

## Why this is safe

1. **Source identity.** Every conditional, every Math.min/max, the APR normalization (>1 = percent), the weekly-rate math, the fallback-payment hierarchy, the bankruptcy + breathing-room two-gate logic, the missed-payment penalty formula — all verbatim from the inline code.
2. **Type-check clean.** `tsc --noEmit` → exit 0, 0 errors.
3. **Zero snapshot drift.** 14 snapshots locked BEFORE the GameActionsContext swap. After: 130/130 pass across the full battery.

---

## Cumulative `nextWeek()` reduction

| Step | Lines extracted |
|---|---|
| 2.1 (preTick) | ~180 |
| 2.2a (tickPetsForWeek) | ~57 |
| 2.2b (applyVehiclesForWeek + WeekContext) | ~50 |
| 2.2c (applyPet{Death,Living}SideEffects) | ~20 |
| 2.3 (applyDiseasesForWeek) | ~220 |
| 2.4a (computeWeeklyIncome) | ~57 |
| 2.4b (applyAutoReinvest) | ~60 |
| 2.4c (applyRentAndHousing) | ~52 |
| 2.4d (computeSavingsInterest) | ~30 |
| 2.4e (applyLoanAutopay) | ~52 |
| **Running total** | **~778 lines** |

The original `nextWeek()` body was ~2,300 lines. We're at ~34% extracted.

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor                    → 135 passed, 130 snapshots passed (zero drift)
npx jest __tests__/startup                     → 64 passed
npx jest __tests__/integration                 → 96 passed (zero regression)
```

**Total: 295 tests across 12 suites, 130 snapshots, zero drift.**

---

## Next: step 2.4f — money writeback + day-summary log

The remaining finance closer at lines ~970-988. ~25 lines. Includes:
- `newMoney = Math.max(0, cashAfterIncomeAndRent)` and `newStats.money = newMoney`.
- A conditional `logger.info(...)` with the income-breakdown summary.
- A second `logger.info(...)` covering energy / health / happiness / money deltas.

This is the simplest remaining finance step — mostly a pure log-message constructor. Could even fold the writeback into a single helper that takes all the totals + computes the final assignment + builds the log string. Estimated ~30-60 minutes.

After 2.4f, the finance pipeline (~250 lines from the original audit) is fully extracted across 6 helpers.

Alternatives:
- **Step 2.5** — careers + education + diet (different domain, ~150 lines).
- **Step 2.6** — relationships + crime + mining (~280 lines, higher risk).
- **Outside Phase 2** — SB-1 / Phase 5 / Phase 3 still queued.

Say "continue" for step 2.4f (closes out finance), name another priority, or stop here.
