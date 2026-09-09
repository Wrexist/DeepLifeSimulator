# R7 Phase 2 step 2.9 — lifetimeStatistics accumulator (complete)

> The last big algorithmic block in `nextWeek()`. A 53-line nested
> ternary with 8 accumulator fields, now a 100-line pure helper with
> 22 tests.

---

## What landed

| File | Change |
|---|---|
| **NEW** [contexts/game/actions/weekly/applyLifetimeStatistics.ts](contexts/game/actions/weekly/applyLifetimeStatistics.ts) | `applyLifetimeStatistics(input)` — pure. 8-field accumulator. |
| [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) | 53-line nested ternary → 9-line call. |
| [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts) | 22 new tests covering every accumulator + boundary + history-cap. |

---

## Accumulators covered

| Field | Increment rule | Test count |
|---|---|---|
| `totalJailTime` | +1 when `prevState.jailWeeks > 0` | 3 |
| `totalChildren` | +`newBornChildrenCount` | 1 |
| `totalWeeksWorked` | +1 when `careerSalary > 0` | 1 |
| `highestSalary` | `max(existing, careerSalary)` | 1 (covering >/< cases) |
| `careerHistory` | First open entry for `currentJob` accumulates earnings+1 week | 4 (no-job, no-salary, FIRST-match-only, all-closed) |
| `peakNetWorth` | `max(existing, safeNetWorth)` | 3 (greater / equal / lesser — strict `>` for week) |
| `peakNetWorthWeek` | `nextWeeksLived` when strictly greater | (covered above) |
| `netWorthHistory` + `weeklyEarningsHistory` | `slice(-99)` + append every 10 weeks | 4 (fires-at-10, skips-at-17, caps-at-100, undefined-init) |

Plus: pass-through (no LS slice), all-undefined (?? 0 semantics), composite snapshot.

---

## Behavior gotchas preserved

| Gotcha | Where | Preserved |
|---|---|---|
| When `lifetimeStatistics` is undefined, helper returns undefined (NOT empty object) — preserves the "this save predates LS" semantics. | top of helper | `no lifetimeStatistics slice` test verifies. |
| `peakNetWorthWeek` only advances on STRICT improvement (`safeNetWorth > prevPeak`), not on tie. Otherwise the player who hits their peak twice would have the week reset. | output | `equal to prior peak does NOT update week` test verifies. |
| `careerHistory.map` only touches the FIRST open match for `currentJob`. If there are accidentally two open entries (legacy malformed save), the second is untouched. | helper `updateCareerHistory` | `only FIRST open match updates` test verifies. |
| History sampling uses `slice(-99)` THEN appends one new — so max length is exactly 100, not 99 or 101. | history blocks | `cap at 100 entries` test verifies. |
| Sample only on `nextWeeksLived % 10 === 0`. At week 17 we skip, but existing array passes through unchanged. | history blocks | `nextWeeksLived NOT divisible by 10` test verifies. |
| `jailWeeks > 0` uses `||` not `??` — so 0 AND undefined both treated as not-in-jail. Preserved 1:1 by `(prevState.jailWeeks || 0) > 0`. | helper | `jailWeeks undefined` test verifies. |

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
| 2.9 (lifetimeStatistics) | ~53 |
| **Running total** | **~1,658 lines** |

Original was ~2,300 lines. **~72% extracted**, all behavior-preserving.

`GameActionsContext.tsx`: 3,155 → 3,113 lines (42 lines net trimmed
locally, ~53 lines of inline logic extracted to 1 helper module).

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor                    → 396 passed, 307 snapshots (zero drift)
npx jest __tests__/startup                     → 64 passed
npx jest __tests__/integration                 → 96 passed (zero regression)
```

**Total: 556 tests across 12 suites, 307 snapshots, zero drift.**

---

## Where we stand

~640 lines remain in `nextWeek()`. The remaining content is the giant
final state-merge object (~250 lines of bookkeeping) plus the
already-pure subsystem ticks (pulse / spark / hustle / stocks /
crypto / banking / darkweb / politics / realestate) which are already
calls to pure helpers — just scattered through the updater.

There's no further "block of impure logic" to extract. The remaining
lines are either:
- already-pure helper calls
- mechanical bookkeeping in the final return
- closure-variable wiring

A different angle — **outside Phase 2 entirely** — would be:
- **SB-1 HMAC rotation** (user-action, queued)
- **SB-2 IAP verify URL** (user-action, queued)
- **Phase 5 sensitive-data log scrubbing** (~10-20 callsites)
- **Phase 3 sub-app gaps** (PoliticalApp / SparkApp / EducationApp decisions)
- **Old TODO sweep** in tasks/

Phase 2 itself is approaching its natural end. Recommend stopping
extraction here and asking which non-extraction work to tackle next.

Say "continue" for me to scan the remaining sub-100-line opportunities
(stock/pulse/spark wraps), name another priority (SB-1, SB-2, Phase 5,
Phase 3, TODO sweep), or stop here.
