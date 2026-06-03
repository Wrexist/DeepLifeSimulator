# R7 Phase 2 step 2.2c — pet side-effects closed out (complete)

> Pets are now fully extracted. The inline pet/vehicle block in `nextWeek()` collapsed from ~120 lines to 6.

---

## What landed

| File | Change |
|---|---|
| [contexts/game/actions/weekly/applyPets.ts](contexts/game/actions/weekly/applyPets.ts) | Added `applyPetDeathSideEffects(prev, updated, ctx)` (newly-dead pet penalty + notifications) and `applyPetLivingSideEffects(updated, ctx)` (alive-pet happiness bonus + food cost). Plus exported `PET_WEEKLY_FOOD_COST = 15` for the downstream week-result expense rollup. |
| [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) | The pet death block (~8 lines), pet alive bonus (~6 lines), and pet food cost (~5 lines) replaced with two function calls. The combined pet+vehicle inline section is now 6 lines: `tickPetsForWeek → applyPetDeathSideEffects → applyVehiclesForWeek → applyPetLivingSideEffects`. |
| [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts) | 13 new tests: 7 for `applyPetDeathSideEffects` (no-op / no-newly-dead / already-dead-not-re-mourned / single death / double death / mix / happiness floor at 0) + 6 for `applyPetLivingSideEffects` (no pets / all dead / unhappy alive / happy+healthy alive / happiness cap at 100 / food-cost floor at 0). |

---

## Why split into two helpers (and not one)

The dead-pet block runs BEFORE vehicles; the alive-bonus + food-cost run AFTER. Vehicles also mutate `newStats.money` (weekly cost + accident repair), so the order matters:

```ts
// Currently in nextWeek:
tickPetsForWeek(...);                    // → updatedPets
applyPetDeathSideEffects(prev, updated); // mutates ctx.newStats.happiness -20 per dead
applyVehiclesForWeek(prev, ctx);          // mutates ctx.newStats.money -costs
applyPetLivingSideEffects(updated, ctx); // mutates ctx.newStats.{happiness, money}
```

Collapsing into one helper would change the food-cost timing (vehicle costs would land before food cost regardless of original order). The Math.max(0, ...) clamping might produce different intermediate states the snapshot tests would have caught — better to preserve the legacy interleaving exactly.

---

## Why this is safe

Same three layers as previous steps:

1. **Source identity.** Both helpers are verbatim copies of the inline blocks — same Math.max / Math.min, same -20 / +2 / *15 constants, same notification template, same filter predicates.
2. **Type-check clean.** `tsc --noEmit` → exit 0, 0 errors.
3. **Zero snapshot drift.** 13 new snapshots locked BEFORE the GameActionsContext change. After: 67/67 pass with no diffs.

---

## One small contract preservation: petFoodCost downstream

The legacy inline code defined `const petFoodCost = alivePets.length * PET_WEEKLY_FOOD_COST` and used it later in the week-result `totalExpenses` rollup (~line 2075). After extracting, the value isn't returned from `applyPetLivingSideEffects` (the helper just applies the cost). To preserve the downstream contract, the call site recomputes `petFoodCost = updatedPets.filter(p => !p.isDead).length * PET_WEEKLY_FOOD_COST` after the helper returns. Cheap (O(updatedPets.length)) and avoids breaking the locked snapshots.

Alternative considered: change the helper to return `{ petFoodCost }`. Rejected because it would have invalidated the 6 living-side-effects snapshots, requiring re-locking — and the recompute is one filter call.

---

## Cumulative `nextWeek()` reduction

| Step | Lines extracted |
|---|---|
| 2.1 (preTick: calculateNetWorth + decay + preRolls) | ~180 |
| 2.2a (tickPetsForWeek) | ~57 |
| 2.2b (applyVehiclesForWeek + rep-bonus + WeekContext setup) | ~50 |
| 2.2c (applyPetDeathSideEffects + applyPetLivingSideEffects) | ~20 |
| **Running total** | **~307 lines** |

Pets and vehicles are now FULLY out of the inline `nextWeek` body. The combined inline section that handled both is 6 function calls.

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor                    → 72 passed, 67 snapshots passed (zero drift)
npx jest __tests__/startup                     → 64 passed
npx jest __tests__/integration                 → 96 passed (zero regression)
```

**Total: 232 tests across 12 suites, 67 snapshots, zero drift.**

---

## Next options

The Phase 2 plan's recommended next step is **2.3 diseases** — a ~230-line block that will use the same `WeekContext` pattern that's now battle-tested across pets + vehicles.

### Step 2.3 — diseases (3-4 hours, medium risk)

Sub-tasks:
1. Inspect the inline disease block to identify its inputs (preRolls.diseaseComplication[], diseaseProgression[], `prevState.diseases`, `prevState.diseaseHistory`).
2. Identify cross-cutting effects (does it mutate `newStats`, push notifications, AND set `deathTriggered` flag? The audit notes that diseases can trigger death.).
3. Build `applyDiseasesForWeek(prev, ctx) → { diseases, diseaseHistory, deathTriggered }`.
4. Snapshot baseline against ~8 disease scenarios (no diseases / one mild / one progressing / one with complications / multi-disease / death-imminent / cured / chronic).
5. Swap inline for helper call. Add `deathTriggered` to the WeekContext or return it from the helper.

Audit estimate: 5-15% wall-clock perf improvement for this step alone — the biggest single payoff of any Phase 2 step.

### Alternatives if you want to pause Phase 2

- **SB-1 HMAC rotation prep** — I draft the migration code (new STATE_VERSION + re-sign on load), you do the EAS secret + final commit.
- **Phase 5 sensitive-data log scrubbing** — verified small fixes from the round-7 audit.
- **Phase 3 sub-app gaps** (PoliticalApp / SparkApp / EducationApp) — needs your implement-vs-hide decision per app.

Say "continue" for step 2.3 diseases, name a different priority, or stop here.
