# R7 Phase 2 step 2.4c — rent + housing extracted (complete)

> Third slice of the finance pipeline. Rent calculation + `housingModule.processWeeklyHousing` + `runRealEstateWeeklyTick` all fold into one `WeekContext`-aware helper.

---

## What landed

| File | Change |
|---|---|
| **NEW** [contexts/game/actions/weekly/applyRentAndHousing.ts](contexts/game/actions/weekly/applyRentAndHousing.ts) | `applyRentAndHousing(prevRealEstate, nextWeeksLived, rollFor, ctx)`. Mutates `ctx.notifications` (housing alerts + real-estate tick events). Returns `{ weeklyRent, updatedRealEstate, housingHappinessBonus, housingRentalIncome, housingUpkeep }`. |
| [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) | Inline rent + housing block (~52 lines) → 11-line helper call. Hoisted `weeklyCtx` from the disease block (was at line 1605) up to the rent block — all subsequent reducers (disease, pet, vehicle) continue to use the same instance. Removed now-unused imports: `housingModule`, `runRealEstateWeeklyTick`, `PLAYER_RENT_RATE_WEEKLY`. |
| [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts) | 6 new tests: empty / undefined / rented-not-owned / rented-but-owned (owners do not pay themselves) / multiple rented sum / vacant. Uses `deterministicRoll(9)` so `runRealEstateWeeklyTick` produces stable output. |

---

## Why `rollFor` is injected

The legacy inline code calls `runRealEstateWeeklyTick({ ..., rollFor: () => Math.random() })`. That's non-deterministic by design — neighborhood-cycle + tenant lifecycle rolls are intentionally random per tick.

For snapshot tests to be stable, the helper accepts `rollFor: (key: string) => number` as a parameter. The production caller passes `() => Math.random()` (preserving exact legacy behavior); tests pass `deterministicRoll(seed)`. **Zero production behavior change.**

---

## WeekContext hoist (incremental refactor)

| Step | weeklyCtx location |
|---|---|
| 2.2b | Inside the pet+vehicle block |
| 2.3 | Hoisted to the disease block (just above the pet+vehicle block) |
| **2.4c** | **Hoisted to the rent+housing block (above the disease block)** |

Each hoist preserves the same object reference for all downstream reducers — mutations propagate through `ctx.notifications.push(...)` and `ctx.newStats.X = ...`. As more reducers extract, this naturally migrates upward toward the top of `setGameState`.

---

## Why this is safe

1. **Source identity.** Every condition, every `Math.round`, every property-status check, every notification template (`'🏠 Property Alert'`, `'housing-alert'`) is a verbatim copy of the inline code. The `try { ... } catch {}` silent-fallback pattern is preserved exactly — "module may not exist in tests" was the legacy intent, kept verbatim.
2. **Type-check clean.** `tsc --noEmit` → exit 0, 0 errors.
3. **Zero snapshot drift.** 6 new snapshots locked BEFORE the GameActionsContext change. After: 102/102 pass across the full battery.

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
| **Running total** | **~696 lines** |

The original `nextWeek()` body was ~2,300 lines. We're now at ~30% extracted, all behavior-preserving.

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor                    → 107 passed, 102 snapshots passed (zero drift)
npx jest __tests__/startup                     → 64 passed
npx jest __tests__/integration                 → 96 passed (zero regression)
```

**Total: 267 tests across 12 suites, 102 snapshots, zero drift.**

---

## Next: step 2.4d — banking + loans + money writeback

The remaining finance sub-block. Includes:
- Savings interest computation (with soft-cap diminishing returns + Good Credit perk stack).
- Per-loan APR accrual + autopay + bankruptcy floor + missed-payment penalty.
- Final money writeback: `cashAfterIncomeAndRent = currentMoney + totalIncome - incomeTax - weeklyRent + housingRentalIncome - housingUpkeep`.
- The day-summary log line.

Estimated 2-3 hours. Higher complexity due to per-loan iteration and credit-score interaction. Uses `runWeeklyBankingTick` (already pure).

Alternatives:
- **Step 2.5** — careers + education + diet (different domain, ~150 lines).
- **Step 2.6** — relationships + crime + mining (~280 lines, higher risk).
- **Outside Phase 2** — SB-1 / Phase 5 / Phase 3 still queued.

Say "continue" for step 2.4d, name another priority, or stop here.
