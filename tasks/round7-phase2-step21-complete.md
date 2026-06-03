# R7 Phase 2 step 2.1 — pre-tick helpers extracted (complete)

> First concrete extraction in the `nextWeek()` refactor plan. Byte-identical behavior verified by zero snapshot drift on the equivalence battery.

---

## What landed

| File | Change |
|---|---|
| **NEW** [contexts/game/actions/weekly/preTick.ts](contexts/game/actions/weekly/preTick.ts) | Exports `calculateNetWorth`, `computeDecayInputs`, `buildPreRolls`, plus types `DecayInputsOptions` / `DecayInputs` / `PreRolls`. Byte-faithful copy of the inline code that previously lived in `GameActionsContext.tsx`. |
| [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) | Removed the inline `calculateNetWorth` (was lines 92-212). Replaced the 30-line inline decay-input block in `nextWeek()` with a 5-line call to `computeDecayInputs(...)`. Replaced the 30-line inline `preRolls = {...}` literal with `const preRolls = buildPreRolls()`. Net reduction in `nextWeek()`: ~180 lines. |
| [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts) | Added 18 new tests covering the three new exports (12 snapshot + 6 shape/range). |

---

## Why this is safe

Three layers of evidence that behavior is unchanged:

1. **Source code is identical.** The new `preTick.ts` is a verbatim copy of the inline blocks — same field iteration order, same try/catch shape, same logger calls, same constants. I did not rewrite or "improve" anything; I only moved.
2. **Type-check clean.** `tsc --noEmit -p tsconfig.typecheck.json` → exit 0, zero errors.
3. **Snapshot equivalence: 42/42 pass, ZERO drift.** The equivalence battery was extended BEFORE the GameActionsContext change, locking in the new helpers' outputs against all 6 fixtures. Running the battery AFTER the extraction produced no snapshot diffs. The new helper outputs identically to the old inline code.

The extraction targets were chosen specifically because they had no `prevState` dependency — they read only `gameState` (the action's stable input snapshot). The `simulateWeek` call at the start of `nextWeek` (intentionally side-effecting per audit context) was left in place.

---

## Type fixes that surfaced during extraction

Two minor TypeScript errors had to be resolved. Both were trivially fixable without behavior change:

1. **`PreRolls` index signature.** The local `interface PreRolls` in [lib/social/pulseTick.ts:54-57](lib/social/pulseTick.ts#L54) uses `[key: string]: unknown`, accepting an open record. My new exported `PreRolls` had explicit fields only. Added an open `[key: string]: unknown` signature so they're structurally compatible.
2. **`safeNetWorth` destructure.** The inline code's `safeNetWorth` local variable was used again ~2,200 lines later in the `lifetimeStatistics.peakNetWorth` / `peakNetWorthWeek` / `netWorthHistory` writes. After extraction I had only pulled `netWorth` from `decayInputs`. Added `safeNetWorth` to the destructure.

Both are local to `GameActionsContext.tsx` and don't affect the snapshots.

---

## What the win actually is

**Bundle / JIT.** `nextWeek` is now ~180 lines shorter. V8's inlining heuristic has a function-size threshold (~600 nodes); the closer `nextWeek` gets to that line, the more likely the JIT can monomorphize and inline it. This step alone won't tip the scale — but it's the FIRST extraction, with 9 more to go (steps 2.2 - 2.10). Each step compounds.

**Testability.** The three helpers are now pure functions with snapshot-locked behavior. Any future refactor that touches netWorth math, decay multipliers, or pre-roll RNG will surface as a snapshot diff in the PR — no manual audit required.

**Architectural debt cleared.** `calculateNetWorth` was previously a top-level helper in a 4,400-line file with no module home. It now lives next to the `actions/weekly/` directory the audit plan called for, joined by future siblings in steps 2.2 - 2.10.

---

## What this DOESN'T claim

- **Wall-clock perf:** I did not measure `nextWeek()` execution time before and after this PR. The audit's estimate for step 2.1 alone was 0%-5% improvement. The real wins are downstream (steps 2.3 finance, 2.6 relationships+crime+mining, etc.). Measure at the end of Phase 2, not after step 2.1.
- **`simulateWeek` side effects:** The stock-module side effect at [GameActionsContext.tsx:318](contexts/game/GameActionsContext.tsx#L318) was deliberately left as-is. Touching it requires changing the stock system's RNG model and is out of scope.
- **StrictMode behavior:** `buildPreRolls` still calls `Math.random()` and `Date.now()`. The pattern is unchanged — the pre-rolls happen ONCE before `setGameState`, which is the correct StrictMode-safe approach. This step did not change StrictMode behavior.

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor --runInBand        → 47 passed, 42 snapshots passed (zero drift)
npx jest __tests__/startup --runInBand         → 64 passed
npx jest __tests__/integration --runInBand     → 96 passed (zero regression)
```

---

## Next: Phase 2 step 2.2 — pets + vehicles

Per the audit plan, the next extraction is **pets** + **vehicles** because they're leaf systems:

- They read `prevState.pets` / `prevState.vehicles` and the running stat accumulator
- They write only their own slice plus stat deltas
- They have no cross-dependency on other reducers
- Each is ~80 lines of inline code in `nextWeek` (~2110-2231 in the file)

The pattern will mirror this step:
1. Extend the equivalence battery with `applyPets` / `applyVehicles` snapshots first (lock the baseline).
2. Extract the inline code verbatim into `contexts/game/actions/weekly/applyPets.ts` and `applyVehicles.ts`.
3. Swap the inline blocks for calls to the new helpers.
4. Verify zero snapshot drift.

Estimated effort: 2-3 hours (longer than step 2.1 because each extraction has 2 helpers, and the inline code uses `preRolls.petSickness` / `preRolls.vehicleAccident` — need to thread the WeekContext shape from the plan's section B).
