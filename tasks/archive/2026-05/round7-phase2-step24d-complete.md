# R7 Phase 2 step 2.4d — savings interest extracted (complete)

> Fourth slice of the finance pipeline. Pure helper, no `WeekContext`, 14 snapshots covering every code path.

---

## Scope reduction (honest)

The audit plan grouped step 2.4 as a single 250-line "finance pipeline" extraction. I've split it further:

- **2.4a (done)** — income totals aggregation
- **2.4b (done)** — auto-reinvest into stocks
- **2.4c (done)** — rent + housing + real-estate tick
- **2.4d (this step)** — savings interest. ~30 lines. Pure.
- **2.4e (queued)** — per-loan APR accrual + autopay + bankruptcy + penalty. ~52 lines. Mutates ctx.
- **2.4f (queued)** — money writeback + day-summary log line. ~25 lines.

The per-step risk stays low; snapshot backstops accumulate.

---

## What landed

| File | Change |
|---|---|
| **NEW** [contexts/game/actions/weekly/applySavingsInterest.ts](contexts/game/actions/weekly/applySavingsInterest.ts) | `computeSavingsInterest(input)` — pure. Inputs: 5 scalars (savings, credit score, FP setting, two perk flags). Output: `{ savingsInterest, newBankSavings }`. |
| [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) | Inline block (~30 lines) → 9-line helper call. Removed 4 now-unused imports: `SAVINGS_APR_BASE`, `SAVINGS_APR_FINANCIAL_PLANNING`, `SAVINGS_BALANCE_SOFT_CAP`, `SAVINGS_CAP_EFFICIENCY`. |
| [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts) | 14 new tests covering every branch: zero / negative / undefined / NaN / below cap / at cap / above cap / credit-score-740 (exact threshold) / credit-score-739 (off-by-one) / FP setting / gold-only / perk-only / both perks (multiplicative stack) / max-stack scenario. |

---

## Why pure (no `WeekContext`)

Savings interest is a pure scalar computation: read prev fields, return two numbers. The caller writes `newBankSavings` into the new GameState slice and uses `savingsInterest` in the day-summary log line (still inline — moving in 2.4f). No notifications, no `newStats` mutations.

---

## Three notable coverage cases

1. **Credit-score exact threshold:** test at score=740 (unlocks) and score=739 (doesn't). Catches any future off-by-one in the gate.
2. **Soft-cap diminishing returns:** test below cap, at cap, well above cap. Snapshots capture the exact two-tier interest math.
3. **Perk multiplicative stack:** test gold-only (1.5×), perk-only (1.5×), and both (2.25×). Catches any future regression that might switch to additive stacking.

---

## Why this is safe

1. **Source identity.** Every conditional, every Math.min/max, the APR selection, the soft-cap math, the perk multiplier order — all verbatim from the inline code.
2. **Type-check clean.** `tsc --noEmit` → exit 0, 0 errors.
3. **Zero snapshot drift.** 14 snapshots locked BEFORE the GameActionsContext swap. After: 116/116 pass across the full battery.

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
| **Running total** | **~726 lines** |

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor                    → 121 passed, 116 snapshots passed (zero drift)
npx jest __tests__/startup                     → 64 passed
npx jest __tests__/integration                 → 96 passed (zero regression)
```

**Total: 281 tests across 12 suites, 116 snapshots, zero drift.**

---

## Next: step 2.4e — per-loan APR + autopay + bankruptcy + penalty

The denser per-loan iteration block at lines 913-966 (~52 lines). It MUTATES `ctx.newStats.money` (via `cashAfterIncomeAndRent`) AND tracks running totals (`totalLoanAutoPaid`, `totalLoanPenalty`).

Pattern: `applyLoanAutopay(prevLoans, ctx) → { processedLoans, totalLoanAutoPaid, totalLoanPenalty }`. The ctx mutation handles the cash deduction; the return values feed the log line and `runWeeklyBankingTick`.

Risk profile: medium — per-loan iteration with bankruptcy-floor edge case and missed-payment penalty. Worth ~10-15 snapshot scenarios.

Alternatives:
- **Step 2.5** — careers + education + diet (different domain, ~150 lines).
- **Outside Phase 2** — SB-1 / Phase 5 / Phase 3 still queued.

Say "continue" for step 2.4e, name another priority, or stop here.
