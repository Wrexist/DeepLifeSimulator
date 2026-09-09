# R7 Phase 2 step 2.6-iii — relationships pipeline (complete)

> The big one. Five sub-sub-splits. Pregnancy + weddings + child aging +
> breakup/disappointed + NPC depth — all out of `nextWeek()` and into
> pure helpers, snapshot-locked.

---

## What landed

| Sub-step | Helper file | Concern | Lines | Tests |
|---|---|---|---|---|
| 2.6-iii-A | [applyNPCDepthTick.ts](contexts/game/actions/weekly/applyNPCDepthTick.ts) | NPC life events + 2-notif cap + try/catch swallow | ~17 | 8 |
| 2.6-iii-B | [applyChildAging.ts](contexts/game/actions/weekly/applyChildAging.ts) | Age by 1/52, re-clamp score | ~8 | 8 |
| 2.6-iii-C | [applyScheduledWedding.ts](contexts/game/actions/weekly/applyScheduledWedding.ts) | Execute / postpone / expire / stale + anti-exploit gates | ~35 | 13 |
| 2.6-iii-D | [applyPregnancyProgression.ts](contexts/game/actions/weekly/applyPregnancyProgression.ts) | Birth (10w) + late energy drain (≥7w) + mid happiness bump (==5w) | ~55 | 22 |
| 2.6-iii-E | [applyRelationshipHealth.ts](contexts/game/actions/weekly/applyRelationshipHealth.ts) | Breakup / disappointed / weeksAtLow tracking / healthy reset | ~60 | 15 |
| **Total** | **5 helpers** | **Full relationships pipeline** | **~175** | **66** |

Plus the corresponding [GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) swaps — each sub-step replaced its inline block with a single helper call.

---

## Where the inline complexity went

Before: one ~200-line `.map((rel, relIdx) => ...)` body inside `nextWeek()`,
with five mutually-exclusive branches and four closure variables
(`newBornChildren`, `newShowBirthPopup`, `birthMessage`,
`relationshipHappinessPenalty`) accumulated across iterations.

After: a flat 50-line orchestration shell that calls 5 helpers in order:

```ts
processedRelationships = (prevState.relationships || []).map((rel, relIdx) => {
  if (!rel || typeof rel !== 'object') return rel;
  const pregResult = applyPregnancyProgression(rel, weeklyCtx);
  if (pregResult) { /* push newborn, set popup */ return pregResult.rel; }
  const weddingResult = applyScheduledWedding(rel, weeklyCtx);
  if (weddingResult) { /* set wedding popup */ return weddingResult.rel; }
  if (rel.type === 'child') return applyChildAging(rel);
  const healthResult = applyRelationshipHealth(rel, relIdx, weeklyCtx);
  relationshipHappinessPenalty += healthResult.happinessPenalty;
  return healthResult.rel;
}).filter(rel => rel !== null);
```

Plus four lines after the map for newborn append + birth notif + happiness
penalty application, and one helper call for NPC depth.

---

## Subtle behavior preservation gotchas

| Gotcha | How preserved |
|---|---|
| `preRolls.relBreakup` is size 20 — `relIdx >= 20` reads `undefined`, and `undefined < x` is `false`. The 21st+ rel never gets a roll. | Snapshot-locked test (`relIdx >= 20`). Helper does NOT defensively size-check. |
| Wedding "expire after 1yr" gate at line 904 of the inline code is effectively unreachable — `originalScheduled = scheduledWeek || nextWeeksLived` and the outer gate is `scheduledWeek === nextWeeksLived`, so `weddingAge = 0` always. | Documented in test (`expire: ...`). Helper preserves the dead branch verbatim. |
| `childName = rel.pregnancyChildName \|\| (gender === 'male' ? 'Baby' : 'Baby')` — both branches return `'Baby'`. | Preserved 1:1, not "fixed" to differentiate. |
| The `>= 7` (late preg) and `=== 5` (mid preg) checks DON'T overlap — at week 5 only mid fires; at weeks 6 there's nothing; at week 7+ only late fires. | Snapshot-locked at boundaries (4, 5, 6, 7). |
| `processWeeklyNPCDepth` failure is silently swallowed by try/catch — needed for test environments without the module. | Preserved in helper. Dedicated test exercises the throw path. |
| NPC depth notification cap of 2 per week. | Locked in test (`5 notifications (over cap)`). |
| Healthy threshold is `>= 30` (strict, NOT `> 30`). | Locked in test (`score 30 — boundary`). |

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
| **Running total** | **~1,444 lines** |

Original was ~2,300 lines. **~63% extracted**, all behavior-preserving.

Also removed three now-dead imports: `ChildInfo`, `PREGNANCY_DURATION_WEEKS`,
and `npcDepth` (`import * as`). No code uses them in `GameActionsContext.tsx`
anymore.

---

## Test coverage breakdown (66 tests across the 5 helpers)

- **A — NPC depth (8)**: empty/passthrough/under-cap/at-cap/over-cap/throw/weeksLived-forwarded/no-stats-touch.
- **B — child aging (8)**: 0→1/52, undefined→1/52, 5→5+1/52, 17.98→18.something, score < 0 clamped, score > 100 clamped, all-other-fields preserved, no input mutation.
- **C — scheduled wedding (13)**: no-plan/future-plan pass-through, execute-success/zero-budget/wAtLow-reset/score-clamp, postpone, expire, stale-cleanup/threshold-boundary, score-floor, no input mutation.
- **D — pregnancy (22)**: three gate-rejection cases; birth path (boundary, gender override, name override, spouse-not-just-partner, money clamp, happiness clamp, score clamp, all 5 personalities, childId format); late-preg energy drain (7, 8, clamp at 0, boundary at 6); mid-preg happiness bump (==5, !=4, !=6, overlap-at-7); ref preservation, no input mutation.
- **E — relationship health (15)**: branch 3 (friend/family clamp), branch 2 (healthy reset/30-boundary), branch 1a breakup (basic/score-0/cap-at-0.4/uses-relIdx), branch 1b disappointed (basic/score-floor), branch 1c neither-roll-fires, branch 1d first-week (weeksAtLow=1, no roll), out-of-bounds relIdx safety, no rel mutation, no ctx.newStats touched.

---

## Why this is safe

1. **Source identity.** Every logger message, every notification id/title/message string, every magic number (5000, 30, 100, +20 wedding, +15 birth, +30 happiness, -25 breakup, -10 disappointed, 50%, 25%, 75%, 0.4 cap, 0.3 disappointed, 2-week gate, 30-score threshold, PREGNANCY_DURATION_WEEKS=10, WEEKS_PER_YEAR=52), every clamp call, every spread order, every gate ordering is preserved 1:1 from the inline code.
2. **Type-check clean.** `tsc --noEmit` → exit 0, 0 errors.
3. **Zero snapshot drift.** 66 new snapshots locked BEFORE each GameActionsContext swap. After all swaps: 295/295 pass across the full battery.

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor                    → 329 passed, 295 snapshots (zero drift)
npx jest __tests__/startup                     → 64 passed
npx jest __tests__/integration                 → 96 passed (zero regression)
```

**Total: 489 tests across 12 suites, 295 snapshots, zero drift.**

---

## Next: step 2.7+ — events + cliffhanger + life-moments + meta

The remaining inline content in `nextWeek()` (~850 lines) covers:
- Event generation (economic / weekly / seasonal / personal crisis) — ~120 lines.
- Cliffhanger event resolution + roll — ~50 lines.
- Life moment generation + consequence progression — ~80 lines.
- Pulse / Spark / Hustle / Stock weekly ticks (already pure, just need wrap) — ~80 lines.
- Achievement evaluation + auto-checkpoint + ribbon awarding — ~100 lines.
- Final state merge (the giant `return { ... }`) — ~250 lines.

The final state merge is mostly bookkeeping — likely just thin shells that
read from the helpers' outputs. Will probably be split into 2-3 sub-steps.

Alternatives:
- **Outside Phase 2** — SB-1 / Phase 5 / Phase 3 still queued.

Say "continue" for step 2.7 (events block — likely 2-3 sub-splits), name another
priority, or stop here.
