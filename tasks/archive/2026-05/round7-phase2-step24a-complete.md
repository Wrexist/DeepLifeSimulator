# R7 Phase 2 step 2.4a — weekly income aggregation extracted (complete)

> First slice of the finance pipeline. Six concerns folded into one pure helper. Same WeekContext-free pattern as `preTick` since this is pure computation, no mutations.

---

## Scope reduction (honest)

The audit plan grouped step 2.4 as "finance pipeline" (~250 lines covering income + auto-reinvest + rent + housing + banking + loans). That's too broad for one safe step. Carving it into sub-steps:

- **2.4a (this step)** — income totals aggregation. ~60 lines. Pure computation.
- **2.4b (queued)** — auto-reinvest into stocks. ~60 lines. Uses `preRolls.stockPickRoll`.
- **2.4c (queued)** — weekly rent + housing module integration. ~60 lines.
- **2.4d (queued)** — banking + loans + money writeback + log. ~70 lines.

Each sub-step independently shippable with snapshot backstops.

---

## What landed

| File | Change |
|---|---|
| **NEW** [contexts/game/actions/weekly/applyIncome.ts](contexts/game/actions/weekly/applyIncome.ts) | `computeWeeklyIncome(input)` — pure helper. Six concerns: partner income (25% nerf), prestige multiplier, base total composition, beginner-luck bonus (deterministic sin-seed), Money-Multiplier gold upgrade (1.5×), stacked onboarding-perk multipliers. Returns `{ partnerIncome, baseTotalIncome, totalIncome }`. |
| [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) | Inline income aggregation (~57 lines) → 8-line `computeWeeklyIncome(...)` call. Cleaned up now-unused imports: `getIncomeMultiplier` and `BEGINNER_LUCK_*` constants no longer referenced in the file. |
| [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts) | 11 new tests: zero income / career only / beginner luck / luck-week-0 / luck-final-week-19 / partner-below-threshold / partner-above-threshold / spouse+partner-sums / non-partner-types-ignored / gold-multiplier-active / negative-or-NaN-clamped. |

---

## Why pure (no `WeekContext`)

Income aggregation is pre-mutation computation: it reads `prevState` and a few computed scalars, returns three numbers. Nothing to mutate. The result is then consumed by the inline money-writeback block (still inline — moving in step 2.4d). Skipping `WeekContext` keeps the helper signature clean and the test setup trivial.

---

## One preserved-as-is decision

The helper retains the `require('@/src/features/onboarding/perksData')` runtime call instead of converting to ES import. The audit flagged this as modernizable, but converting it is a separate concern from extracting the logic. Behavior is byte-identical; the require pattern is preserved verbatim.

---

## Why this is safe

1. **Source identity.** Every Math.round, every conditional, every multiplier order is a verbatim copy of the inline code. The beginner-luck sin-seed formula (`luckSeed = weeksLivedNow * 777 + 42`) is unchanged — same constants, same `Math.sin(luckSeed) * 10000 - Math.floor(...)` pattern.
2. **Type-check clean.** `tsc --noEmit` → exit 0, 0 errors.
3. **Zero snapshot drift.** 11 new snapshots locked BEFORE the GameActionsContext change. After: 88/88 pass with no diffs across the full battery.

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
| **Running total** | **~584 lines** |

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor                    → 93 passed, 88 snapshots passed (zero drift)
npx jest __tests__/startup                     → 64 passed
npx jest __tests__/integration                 → 96 passed (zero regression)
```

**Total: 253 tests across 12 suites, 88 snapshots, zero drift.**

---

## Next: step 2.4b — auto-reinvest into stocks

The next-densest finance block. Inputs: `passiveIncomeResult.reinvested`, `prevState.stocks?.holdings`, `preRolls.stockPickRoll`, calls `getStockInfo` / `getAllStocks` (both pure stock-module exports). Output: `reinvestedStocks: StockHolding[]`.

Estimated 1-2 hours. Includes the `Math.random`-free stock pick (the existing code uses `preRolls.stockPickRoll`, which is deterministic-by-design from `buildPreRolls`), so the helper is fully snapshot-testable.

Alternatives:
- **Step 2.4c — rent + housing module integration** (lower-risk, deterministic, ~60 lines).
- **Step 2.5 — careers + education + diet** (~150 lines, parallel domain).
- **Outside Phase 2** — SB-1 HMAC rotation prep, Phase 5 log scrubbing, Phase 3 sub-app gaps.

Say "continue" for step 2.4b auto-reinvest, name another priority, or stop here.
