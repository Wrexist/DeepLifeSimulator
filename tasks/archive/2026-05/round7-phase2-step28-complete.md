# R7 Phase 2 step 2.8 — consequence + ribbon + checkpoint (complete)

> Three more IO-wrapping helpers. Both checkpoint IIFEs are now named
> exports with explicit tests; the consequence progression try/catch
> finally has a unit test instead of being hidden inside the giant updater.

---

## What landed

| Sub-step | Helper file | Concern | Lines | Tests |
|---|---|---|---|---|
| 2.8-A | [applyConsequenceProgression.ts](contexts/game/actions/weekly/applyConsequenceProgression.ts) | progressionProcess + initialize merge + try/catch fallback | ~21 | 4 |
| 2.8-B | [applyDeathRibbon.ts](contexts/game/actions/weekly/applyDeathRibbon.ts) | death-edge classify + collection-add + try/catch | ~15 | 6 |
| 2.8-C | [applyAutoCheckpoint.ts](contexts/game/actions/weekly/applyAutoCheckpoint.ts) | year-boundary + before-death checkpoints + try/catch | ~30 | 9 |
| **Total** | **3 helpers** | | **~66** | **19** |

---

## Behavior gotchas preserved

| Gotcha | Where | Preserved |
|---|---|---|
| Death ribbon fires on the popup edge (`newShow && !prevShow`), not while still showing. Re-fire on every tick during death-screen would re-award. | applyDeathRibbon | Test covers `prevState.showDeathPopup=true` → empty partial. |
| Pre-death checkpoint snapshots `prevState` UNMODIFIED — uses pre-decay stats so rewind lands on alive state. | applyAutoCheckpoint | Test asserts `createCheckpoint(prevState, 'Before Death')`, NOT the synthetic post-tick view. |
| Year-boundary checkpoint uses the SYNTHETIC post-tick view (so the label reads "the year you just finished"). | applyAutoCheckpoint | Test asserts createCheckpoint receives `{ weeksLived: 52, stats: newStats }`. |
| `currentCheckpoints = prevState.checkpoints ?? []` — undefined slice becomes `[]` in the final state, even when no gate fires. | applyAutoCheckpoint | Test (`no gate fires + undefined checkpoints slice`) verifies `[]` returned. |
| Both gates can fire in the same tick. Year-boundary added FIRST, then before-death. Order matters for `addCheckpoint`'s slot-rotation. | applyAutoCheckpoint | Test asserts call order. |
| Consequence progression spread order: initialize THEN progression result. Progression fields override initialize fields on conflict. | applyConsequenceProgression | Test (`progression result overrides initialize fields`) verifies. |
| Consequence throw: fall back to existing `consequenceState` if present, else `initializeConsequenceState`. | applyConsequenceProgression | Both paths covered by separate tests. |

---

## Cumulative `nextWeek()` reduction

| Step | Lines extracted |
|---|---|
| 2.1 (preTick) | ~180 |
| 2.2a-c (pets + vehicles + side effects) | ~127 |
| 2.3 (diseases) | ~220 |
| 2.4a-f (full finance pipeline) | ~265 |
| 2.5a-c (diet + careers + education) | ~283 |
| 2.6-i (crime) | ~19 |
| 2.6-ii-A (mining cryptos) | ~88 |
| 2.6-ii-B (mining warehouse) | ~87 |
| 2.6-iii-A through E (relationships) | ~175 |
| 2.7-A through D (events) | ~95 |
| 2.8-A through C (consequence + ribbon + checkpoint) | ~66 |
| **Running total** | **~1,605 lines** |

Original was ~2,300 lines. **~70% extracted**, all behavior-preserving.

Also removed four dead imports: `processConsequenceProgression`,
`classifyLife`, `addRibbonToCollection`, `shouldAutoCheckpoint`,
`createCheckpoint`, `addCheckpoint`.

`GameActionsContext.tsx`: 3,201 → 3,155 lines (46 lines net trimmed
locally, ~66 lines of inline logic extracted to 3 helper modules).

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor                    → 374 passed, 305 snapshots (zero drift)
npx jest __tests__/startup                     → 64 passed
npx jest __tests__/integration                 → 96 passed (zero regression)
```

**Total: 534 tests across 12 suites, 305 snapshots, zero drift.**

---

## What's left in `nextWeek()`

~700 lines, distributed across:
- **Pulse / Spark / Hustle / Stock / Banking / Crypto / DarkWeb / Politics / RealEstate weekly ticks** — already pure helpers but scattered throughout the updater, interleaved with stat mutations and the final state merge. Each is a 5-20 line block. Extracting them gains testability but minimal LoC reduction since the helper calls already ARE the meat.
- **Achievement evaluation + claimable rollup** — ~40 lines.
- **Final state merge** — ~250 lines of bookkeeping (the giant `return { ...prevState, stats: clampedStats, weeksLived: nextWeeksLived, ... }`).

The final state merge is mostly mechanical: every `name: localVar` pair
maps a closure variable to its state-slice destination. Extracting it
to a helper would just move the giant object — no net testability gain.

A more useful next step would be **step 2.9 — extract the lifetimeStatistics
accumulator** (~50 lines of `prev?.X || 0 + newStats.X` patterns that
nobody has tested in isolation), which is the last remaining
algorithmic block in the updater.

Alternatives:
- **Outside Phase 2** — SB-1 / Phase 5 / Phase 3 still queued.

Say "continue" for step 2.9 (lifetime statistics, ~50 lines, 1 helper),
name another priority, or stop here.
