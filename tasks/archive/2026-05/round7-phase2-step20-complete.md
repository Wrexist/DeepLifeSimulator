# R7 Phase 2 step 2.0 — equivalence test infrastructure (complete)

> Test-only code. No production behavior change. Unlocks the `nextWeek()` refactor (Phase 2 steps 2.1 - 2.10) by giving each step a regression backstop.

---

## What landed

### 1. Fixture battery — [__tests__/refactor/helpers/weekFixtures.ts](__tests__/refactor/helpers/weekFixtures.ts)

Six representative `GameState` snapshots, each built via `createTestGameState()` (so they inherit any field added to `initialGameState` — no test-only state drift):

| Fixture | Scenario | What it stresses |
|---|---|---|
| `freshGame` | Week 1, defaults | Empty case (no companies, stocks, relationships, debt) |
| `earlyCareer` | Week 30, has job + savings | Common income/expense path |
| `midGame` | Week 250, banking + stocks active | Busy income tick |
| `wealthyGame` | Week 1500, all subsystems active | Worst-case tick cost |
| `inPrison` | High wantedLevel, jail | Crime + jail-decay paths |
| `nearDeath` | Stats at 5-8, edge of death trigger | Death-tracking counters |

Plus `deterministicRoll(seed)` — a stable per-key PRNG so tests are reproducible across machines and Node versions. Mirrors the `rollFor(key)` contract the existing pure subsystem ticks use.

### 2. Subsystem-tick equivalence test — [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts)

For each of the 6 already-pure ticks under `lib/<system>/weeklyTick.ts`:

- `runWeeklyBankingTick`
- `runCryptoWeeklyTick`
- `runDarkWebWeeklyTick`
- `runPoliticsWeeklyTick`
- `runRealEstateWeeklyTick`
- (`runStocksWeeklyTick` — deferred; input shape requires extracting `prices`/`yields` from the live stock module, which isn't trivially mockable. Will add when extracting the stocks-tick caller in Phase 2 step 2.9.)

Each tick is called against every fixture with a per-fixture-seeded `rollFor`, and the result is captured via `toMatchSnapshot()`. **30 snapshots locked.** Any future change — refactor, intentional behavior change, accidental drift — will surface as a snapshot diff in the PR.

### 3. Jest config update

Added `__tests__/refactor/helpers/` to `testPathIgnorePatterns` in [jest.config.js](jest.config.js) so helper files alongside test files don't fail Jest's "must contain at least one test" check. Mirrors the existing convention for `__tests__/helpers/` and `__tests__/stress/helpers/`.

---

## How future Phase 2 steps use this

Each Phase 2 step (2.1 - 2.10) extracts a chunk of the `nextWeek()` body into a pure helper. The workflow becomes:

1. **Before the extraction:** run `npx jest __tests__/refactor` — all green, 30 snapshots intact.
2. **Do the extraction:** create `contexts/game/actions/weekly/applyX.ts`, move the relevant logic, wire the new helper into `nextWeek`.
3. **Re-run the equivalence test:** if snapshots changed, INSPECT every diff. Two cases:
   - **Intentional change** (e.g. a fix was bundled with the extraction): document the diff in the PR description, run `npx jest __tests__/refactor --updateSnapshot`, commit the updated snapshot.
   - **Unintentional change**: the refactor introduced a behavior change. Fix it before merging.
4. **Add the new helper's coverage:** import the new helper at the top of `subsystemEquivalence.test.ts`, add a new `describe` block following the existing pattern. The new helper is now backstopped by the same fixture battery.

This is the same pattern as the existing per-system test files (`lib/banking/__tests__/weeklyTick.test.ts` etc.) — but **integration-level** rather than unit-level, with realistic state from the fixtures.

---

## What's NOT in this step (still TODO for Phase 2)

The bigger fish — the inline `nextWeek` body itself — isn't testable yet. The plan calls for extracting subsystems into pure reducers step by step. Each step adds another testable target.

**Next concrete unit of work** (Phase 2 step 2.1):

- Extract `calculateNetWorth` + the decay-multiplier math + the `preRolls` builder into `contexts/game/actions/weekly/preTick.ts`. Already a leaf, no `prevState` dependency.
- Add coverage in `subsystemEquivalence.test.ts` by calling the new helper on each fixture and snapshotting.
- Estimated effort: 1-2 hours.

After step 2.1, the next safe extraction is pets + vehicles (step 2.2 in the plan).

---

## Adding a new fixture

To stress a new corner of the game, add to `helpers/weekFixtures.ts`:

```ts
export const yourFixture: GameState = createTestGameState({
  week: ...,
  weeksLived: ...,
  stats: { ... },
  // any other slices you care about
});

export const fixtures = {
  freshGame,
  earlyCareer,
  midGame,
  wealthyGame,
  inPrison,
  nearDeath,
  yourFixture, // ← add here
} as const;
```

Then add a seed to the `SEEDS` map in `subsystemEquivalence.test.ts`. Every existing `describe` block will pick it up via `it.each`. Run `npx jest __tests__/refactor --updateSnapshot` and commit the new snapshots.

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json   → exit 0, 0 errors
npx jest __tests__/refactor --runInBand        → 33 passed, 30 snapshots written
npx jest __tests__/startup __tests__/refactor  → 97 passed (64 prior + 33 new)
```
