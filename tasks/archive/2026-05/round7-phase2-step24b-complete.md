# R7 Phase 2 step 2.4b — auto-reinvest extracted (complete)

> Second slice of the finance pipeline. Behavior-preserving extraction of the dividend-auto-reinvest logic, with deterministic snapshot tests via a mocked stock module.

---

## What landed

| File | Change |
|---|---|
| **NEW** [contexts/game/actions/weekly/applyAutoReinvest.ts](contexts/game/actions/weekly/applyAutoReinvest.ts) | `applyAutoReinvest(input)` — pure (modulo `logger.info`). Picks a target stock (largest existing holding, fallback to random via `stockPickRoll`), computes shares to buy, merges into existing holding or appends new. Preserves the legacy `[]` = no-reinvest convention. |
| [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) | Inline auto-reinvest block (~60 lines) → 6-line helper call. Removed now-unused `getAllStocks` import (still need `getStockInfo` for downstream sites at lines 1930 and 2168). |
| [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts) | 8 new tests covering all code paths: zero / negative amount / random pick / largest-share preference / merge into existing / sharesToBuy floors to 0 / unknown symbol falls to random. Plus a `jest.mock` of `@/lib/economy/stockMarket` so the stock prices are deterministic across runs. |

---

## Two honest scope notes

### 1. One test case removed because it crashed the legacy code too

The original test plan included an "invalid holdings" case (array containing nulls). It crashed at `holdings.find(h => h.symbol.toUpperCase()...)` because `h` was null. **The legacy inline code crashes at the exact same line.** Both implementations assume `prevState.stocks?.holdings` is well-formed (no nulls). The `validHoldings` filter only protects the "find largest" search, not the `.find()` lookup. I removed the test rather than introduce a new null guard — that would be a behavior change beyond the scope of this extraction. Documented in the test file as a comment.

### 2. `jest.mock` of the stock module is required for determinism

`getStockInfo` and `getAllStocks` read from a module-level mutable price cache. `simulateWeek` writes to this cache once per tick. For snapshot tests to be reliable across test orderings, the stock module is mocked with a fixed price set (5 symbols, fixed prices). This is a TEST-ONLY mock — production code is unaffected.

The mock is at module scope and applies to all tests in the file. Verified that none of the other extracted helpers (banking / crypto / darkweb / politics / real-estate / preTick / pets / vehicles / diseases / income) transitively import `@/lib/economy/stockMarket`, so the mock doesn't pollute their snapshots. Confirmed by all 96 snapshots passing after the mock was added.

---

## Why this is safe

1. **Source identity.** Every conditional, every Math.floor, every Math.round, the NaN/Infinity guards on `newAveragePrice`, the `validHoldings` filter, the `holdings.find` lookup — all verbatim copies of the inline code. The picked-stock symbol normalization (`.toUpperCase()`) is preserved in both the search AND the holding-find paths.
2. **Type-check clean.** `tsc --noEmit` → exit 0, 0 errors.
3. **Zero snapshot drift.** 8 new snapshots locked BEFORE the GameActionsContext swap. After: 96/96 pass across the full battery.

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
| **Running total** | **~644 lines** |

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor                    → 101 passed, 96 snapshots passed
npx jest __tests__/startup                     → 64 passed
npx jest __tests__/integration                 → 96 passed (zero regression)
```

**Total: 261 tests across 12 suites, 96 snapshots, zero drift.**

---

## Next: step 2.4c — weekly rent + housing integration

The next finance sub-block. Inputs: `prevState.realEstate`, `prevState.weeksLived`, `PLAYER_RENT_RATE_WEEKLY`, calls `housingModule.processWeeklyHousing` + `runRealEstateWeeklyTick`. Output: rent income, housing condition deltas, happiness bonus.

This block calls two existing module-level helpers and mostly aggregates their results. Estimated 1-2 hours.

Alternatives:
- **Step 2.4d — banking + loans + money writeback** (~70 lines, denser).
- **Step 2.5 — careers + education + diet** (different domain, ~150 lines).
- **Outside Phase 2** — SB-1 / Phase 5 / Phase 3 still queued.

Say "continue" for step 2.4c, name another priority, or stop here.
