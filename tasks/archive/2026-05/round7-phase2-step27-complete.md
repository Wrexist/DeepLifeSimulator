# R7 Phase 2 step 2.7 — events block (complete)

> Economic events + weekly events + cliffhanger resolution + life moments.
> Four IO-wrapping helpers, all snapshot-locked with mocked deps.

---

## What landed

| Sub-step | Helper file | Concern | Lines | Tests |
|---|---|---|---|---|
| 2.7-A | [applyEconomicEvent.ts](contexts/game/actions/weekly/applyEconomicEvent.ts) | shouldTrigger gate + generate + try/catch | ~12 | 5 |
| 2.7-B | [applyWeeklyEvents.ts](contexts/game/actions/weekly/applyWeeklyEvents.ts) | rollWeeklyEvents + stamp + append + cap-100 + newEventCount | ~33 | 9 |
| 2.7-C | [applyCliffhangerResolution.ts](contexts/game/actions/weekly/applyCliffhangerResolution.ts) | resolveCliffhanger + uncapped append | ~19 | 6 |
| 2.7-D | [applyLifeMoment.ts](contexts/game/actions/weekly/applyLifeMoment.ts) | generateLifeMoment + merge/init lifeMoments slice | ~31 | 6 |
| **Total** | **4 helpers** | **Full events pipeline** | **~95** | **26** |

---

## One interface adjustment caught late

The first cut of `applyWeeklyEvents` only returned `updatedPendingEvents`,
but the downstream state-merge needs `newEvents.length > 0` to drive
`lastEventWeeksLived` (the event-pity counter). Added `newEventCount` as
a return field — the raw count BEFORE stamping/capping. Tests cover:
zero-on-throw, zero-on-empty, count-matches-raw-result.

The caller now reads `weeklyEventsResult.newEventCount` and threads it to
the pity field. Same value, same gate, same behavior.

---

## Behavior gotchas preserved

| Gotcha | Where | Preserved |
|---|---|---|
| Cliffhanger append happens AFTER the MAX_PENDING_EVENTS=100 cap. A cliffhanger can push pendingEvents to 101+. | applyCliffhangerResolution | Snapshot-locked (`appends are uncapped`). |
| Cap uses `>` not `>=`. At exactly 100 events, no slice. | applyWeeklyEvents | Snapshot-locked (`at exactly MAX_PENDING_EVENTS does NOT drop`). |
| `slice(-100)` keeps the LAST 100 (drops oldest). | applyWeeklyEvents | Snapshot-locked (`drops oldest, keeps last 100`). |
| Stamping uses `nextWeeksLived` (post-tick week), not the cyclic `state.week`. | both | Test verifies. |
| Synthetic state passed to generators uses `nextWeeksLived` so they see the post-tick world. | A, B, C, D | Tests verify. |
| All four blocks wrapped in try/catch swallows — module throws cannot kill a tick. | all four | All four have explicit throw-path tests. |
| `lifeMoments` initialization when none exists uses zero-valued counters, not just empty `{}`. | applyLifeMoment | Snapshot-locked. |

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
| **Running total** | **~1,539 lines** |

Original was ~2,300 lines. **~67% extracted**, all behavior-preserving.

Also removed four dead imports: `shouldTriggerEconomicEvent`,
`generateEconomicEvent`, `rollWeeklyEvents`, `resolveCliffhanger`,
`generateLifeMoment`. (`rollCliffhanger` is retained — still used.)

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor                    → 355 passed, 302 snapshots (zero drift)
npx jest __tests__/startup                     → 64 passed
npx jest __tests__/integration                 → 96 passed (zero regression)
```

**Total: 515 tests across 12 suites, 302 snapshots, zero drift.**

`GameActionsContext.tsx`: 3,261 → 3,201 lines (60 lines net trimmed locally,
~95 lines of inline logic extracted to 4 helper modules).

---

## Next: step 2.8 — achievements / checkpoint / ribbon / stat clamps / final merge

The remaining inline content in `nextWeek()` (~750 lines) covers:
- Pulse / Spark / Hustle / Stock weekly ticks (already pure, just need wrap) — ~80 lines.
- Achievement evaluation + claimable rollup — ~40 lines.
- Auto-checkpoint creation (year-based gate) — ~50 lines.
- Ribbon awarding on death — ~40 lines.
- Consequence progression + choice application — ~80 lines.
- Final state merge — ~250 lines of mostly bookkeeping.

The pulse/spark/hustle/stocks ticks are already pure helpers — they
just need thin wrap calls. The final merge is mostly mechanical.

Alternatives:
- **Outside Phase 2** — SB-1 / Phase 5 / Phase 3 still queued.

Say "continue" for step 2.8 (likely 3-4 sub-splits), name another priority,
or stop here.
