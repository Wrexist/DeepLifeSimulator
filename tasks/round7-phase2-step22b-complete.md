# R7 Phase 2 step 2.2b — vehicles via WeekContext (complete)

> Third extraction in the `nextWeek()` refactor. Introduces the `WeekContext` shape that the remaining extractions (relationships, family, crime, disease, mining, etc.) will all use. Behavior preserved — verified by zero snapshot drift.

---

## What landed

| File | Change |
|---|---|
| **NEW** [contexts/game/actions/weekly/weekContext.ts](contexts/game/actions/weekly/weekContext.ts) | The `WeekContext` interface + `WeekNotification` type. Read-only `preRolls` + `nextWeeksLived`, mutable `newStats` + `notifications`. Pure types — no React, no module-level state. |
| **NEW** [contexts/game/actions/weekly/applyVehicles.ts](contexts/game/actions/weekly/applyVehicles.ts) | `applyVehiclesForWeek(prev, ctx)` — pure function that mutates ctx (money, health, reputation, notifications) and returns the updated `Vehicle[]`. Verbatim copy of the previous inline blocks. |
| [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) | Vehicle `.map()` body (~40 lines) + vehicle-rep-bonus block (~5 lines) replaced with a 6-line `applyVehiclesForWeek(prevState.vehicles, vehicleCtx)` call. |
| [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts) | 8 new tests: empty / undefined / single-vehicle / low-condition / unowned / rep-bonus-fires / rep-bonus-skipped / insured-accident. Each snapshots `{ vehicles, newStats, notifications }` — captures BOTH the returned array AND the ctx mutations. |

---

## WeekContext design rationale

The audit plan called for a "WeekContext" but didn't pin the shape. I picked the minimum that unblocks every remaining extraction:

```ts
interface WeekContext {
  newStats: GameStats;              // mutable
  notifications: WeekNotification[]; // mutable
  preRolls: PreRolls;                // read-only
  nextWeeksLived: number;            // read-only
}
```

Why mutable rather than `(state, ctx) => newCtx`? Two reasons:

1. **Faithful to the legacy pattern.** The inline code mutates `newStats` and `pendingNotifications` via Math.max / Math.min / array push. A "returned deltas" interface would have meant rewriting every site. The whole point of these extractions is BEHAVIOR PRESERVATION — minimal code change is the lower-risk path.
2. **JS object reference semantics are sufficient.** The caller holds the references; each reducer mutates through them; subsequent reducers see the mutations. No need for elaborate state-threading.

Trade-off: reducers aren't strictly "pure" — they mutate their input. But they ARE deterministic given the same input. Tests create a fresh ctx per call and snapshot the result, which is the same testing surface as a pure function.

---

## Why this is safe (three layers, same as 2.1 / 2.2a)

1. **Source identity.** `applyVehiclesForWeek` is a verbatim copy of the inline blocks — same Math.max / Math.min calls, same constants, same `preRolls` indices, same notification message template.
2. **Type-check clean.** `tsc --noEmit` → exit 0, 0 errors.
3. **Zero snapshot drift.** 8 new snapshots captured BEFORE the GameActionsContext change. After: 54/54 pass with no diffs. The new helper mutates ctx identically to the previous inline code.

---

## Cumulative `nextWeek()` reduction

| Step | Lines extracted |
|---|---|
| 2.1 (calculateNetWorth + decay + preRolls) | ~180 |
| 2.2a (tickPetsForWeek) | ~57 |
| 2.2b (applyVehiclesForWeek + rep-bonus) | ~50 |
| **Running total** | **~287 lines** |

`nextWeek()` is now ~287 lines shorter than where R7 started. Still 1,200+ lines to go — but each remaining extraction can now use `WeekContext` as a drop-in instead of designing a new threading pattern.

---

## What stays inline (still TODO)

The two side-effect blocks AROUND `tickPetsForWeek` from step 2.2a:

1. **Newly-dead pet penalty + notifications** — mutates `newStats.happiness`, pushes notifications. Now trivial to extract since `WeekContext` exists: it'd take `(prev, updated, ctx) => void` (no return, just mutates ctx).
2. **Alive-pet happiness bonus + food cost** — mutates `newStats.happiness` and `newStats.money`. Same shape — easy follow-up.

These can land as a small step 2.2c or roll into step 2.3 (`applyDiseasesForWeek` is bigger and uses the same pattern). Either way the runway is now clear.

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor --runInBand        → 59 passed, 54 snapshots passed (zero drift)
npx jest __tests__/startup --runInBand         → 64 passed
npx jest __tests__/integration --runInBand     → 96 passed (zero regression)
```

**Total: 219 tests across 12 suites, 54 snapshots, zero drift.**

---

## Next: Phase 2 step 2.3 — diseases (or step 2.2c pet side-effect cleanups)

Two equally-safe next options:

### Option A — Step 2.2c: pet side-effect cleanup (1 hour, small)
Move the newly-dead-pet penalty + alive-pet bonus + pet-food-cost blocks into `applyPets.ts` as `applyPetSideEffects(prev, updated, ctx)`. Closes out the pets extraction completely. Lowest risk in Phase 2 — every step's worth of work.

### Option B — Step 2.3: diseases (3-4 hours, medium)
The disease block is ~230 lines (per audit). Same pattern as vehicles: `applyDiseasesForWeek(prev, ctx)` mutates ctx and returns `Disease[]`. Complex because diseases interact with both `newStats` and a downstream `deathTriggered` flag. Bigger but highest payoff in the perf-gain estimate (5-15%).

Recommendation: do A first (it's nearly free, finishes pets), then B in the next turn.

Other priorities outside Phase 2 (still queued):
- **SB-1 HMAC rotation prep** — I can draft the migration code; you do the EAS secret + final commit.
- **SB-2 IAP server endpoint** — you deploy, I wire.
- **SB-5 SVG-initials avatars** — design + code.
- **Phase 3 sub-app gaps** (PoliticalApp / SparkApp / EducationApp) — implement-vs-hide decision.
