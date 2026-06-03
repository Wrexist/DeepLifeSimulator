# R7 Phase 2 step 2.3 — diseases extracted (complete)

> Largest extraction yet: ~235 lines of intricate per-disease state machine logic, now isolated in a pure helper with 10 snapshot-locked scenarios.

---

## What landed

| File | Change |
|---|---|
| **NEW** [contexts/game/actions/weekly/applyDiseases.ts](contexts/game/actions/weekly/applyDiseases.ts) | `applyDiseasesForWeek(input, ctx)` — pure helper. Takes pre-generated `newDisease` so the helper itself is deterministic (the impure `generateRandomDisease` stays in the caller). Mutates `ctx.newStats` for stat penalties, returns `{ diseases, diseaseHistory, showSicknessModal, lastDiseaseWeek, deathTriggered, deathReason }`. |
| [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) | Disease block (~235 lines) replaced with a 15-line `applyDiseasesForWeek(...)` call + try/catch around `generateRandomDisease` + `if (deathTriggered)` thread-through. The `weeklyCtx` is hoisted to the top of the disease block so the pet/vehicle blocks below reuse the same reference. |
| [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts) | 10 new tests: no-diseases / new-mild-admission / malformed-new-rejected / malformed-existing-dropped / multi-stat-clamping / chronic-worsens / mild→serious progression / death-countdown-triggers / natural-recovery / accelerated-recovery. |

---

## Design decisions

### Why `generateRandomDisease` stays in the caller

`generateRandomDisease` uses `Math.random` internally — calling it inside the helper would make snapshot tests non-deterministic. Instead, the caller:

1. Builds the generation state (`{...prevState, weeksLived: nextWeeksLived, stats: newStats}`).
2. Calls `generateRandomDisease(stateForDiseaseGeneration)`.
3. Threads the result (or `null` on failure) into the helper as `input.newDisease`.

The helper accepts this pre-generated value and either admits it or rejects it (validation matches the legacy inline code). Tests pass concrete `Disease` objects or `null` and get fully deterministic output.

### Why `deathTriggered` is returned, not in `WeekContext`

Looking at the legacy code, the disease block uses a LOCAL `diseaseDeathTriggered` variable that gets converted into `newShowDeathPopup` / `newDeathReason` immediately. The outer `deathTriggered` variable at line ~313 (from age/stat-zero paths) is separate and persists past the updater. Mirroring the original semantics: the helper returns its own `deathTriggered` flag, and the caller does:

```ts
if (diseaseResult.deathTriggered) {
  newShowDeathPopup = true;
  newDeathReason = diseaseResult.deathReason;
}
```

If a future step (e.g. age-based death) needs to combine flags from multiple reducers, `WeekContext` is the right home — but for now, the legacy split is preserved exactly.

### Why `weeklyCtx` was hoisted

The disease block now needs `WeekContext` for `preRolls` access and `newStats` mutation. The pet/vehicle blocks below (from step 2.2) already had their own `weeklyCtx`. Rather than create two contexts, the hoisted version is shared. Same object reference throughout — mutations propagate naturally.

---

## Two TypeScript fixes during extraction

1. **`prevShowSicknessModal: boolean` (not `boolean | undefined`).** GameState's `showSicknessModal` is required `boolean`. My initial helper signature was too permissive. Tightened to match; test inputs updated from `undefined` to `false`; snapshots regenerated (8 affected).
2. **`(ctx.newStats as unknown as Record<string, number>)`.** `GameStats` doesn't have an index signature, so a direct `as Record<string, number>` cast fails strict type-check. Cast through `unknown` to satisfy the compiler. Behavior is identical to the legacy inline cast.

---

## Why this is safe

1. **Source identity.** Every conditional, every Math.max/min, every constant (MAX_DISEASE_HISTORY=50, complicationChance=0.1, 0.15 cap, 0.3 progression gate, 50%/20% effect multipliers, recovery -0.5 bonuses) is a verbatim copy of the inline code.
2. **Type-check clean.** `tsc --noEmit` → exit 0, 0 errors.
3. **Zero snapshot drift on the final run.** The 10 disease snapshots locked the helper's behavior; running the FULL test suite afterward confirmed every other snapshot was unaffected. The 8 snapshots regenerated for the `prevShowSicknessModal` type tightening reflect the production-shape input — they're not a behavior change.

---

## Cumulative `nextWeek()` reduction

| Step | Lines extracted |
|---|---|
| 2.1 (preTick) | ~180 |
| 2.2a (tickPetsForWeek) | ~57 |
| 2.2b (applyVehiclesForWeek + WeekContext) | ~50 |
| 2.2c (applyPet{Death,Living}SideEffects) | ~20 |
| 2.3 (applyDiseasesForWeek) | ~220 |
| **Running total** | **~527 lines** |

Roughly one-third of the original `nextWeek()` body has been moved into testable pure helpers. The biggest remaining blocks (finance/income, relationships+family, events/cliffhanger) follow the same pattern.

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor                    → 82 passed, 77 snapshots passed
npx jest __tests__/startup                     → 64 passed
npx jest __tests__/integration                 → 96 passed (zero regression)
```

**Total: 242 tests across 12 suites, 77 snapshots.**

---

## Next options

The audit plan's remaining big reducers:

- **Step 2.4 — finance pipeline** (income + auto-reinvest + rent/housing + banking + loans). The densest section, ~250 lines. Audit estimate: 10-20% wall-clock perf improvement. Highest-payoff Phase 2 step.
- **Step 2.5 — careers + education + diet** (~150 lines). Medium-risk; education has stage transitions.
- **Step 2.6 — relationships + crime + mining** (~280 lines). Higher risk: relationships has pregnancy/wedding/breakup branches.

Recommendation: step 2.4 (finance) — biggest perf payoff, cleanest dependency profile (just needs `WeekContext` + a few constants).

Alternatives outside Phase 2 (still queued):
- **SB-1 HMAC rotation prep** — I draft migration code; you do EAS secret + final commit.
- **Phase 5 sensitive-data log scrubbing** — small verified fixes.
- **Phase 3 sub-app gaps** — implement-vs-hide decisions.

Say "continue" for step 2.4 finance, name another priority, or stop here.
