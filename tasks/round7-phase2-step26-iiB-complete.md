# R7 Phase 2 step 2.6-ii-B — warehouse update + closes mining (complete)

> Second half of mining. Difficulty, durability, auto-repair-to-100 all extracted. Mining pipeline now fully out of `nextWeek()`.

---

## What landed

| File | Change |
|---|---|
| **NEW** [contexts/game/actions/weekly/applyMiningWarehouse.ts](contexts/game/actions/weekly/applyMiningWarehouse.ts) | `applyMiningWarehouse(input)` — pure. Returns `{ updatedWarehouse }`. Handles difficulty cooldown (every 10 weeks, +10%, cap 2.0×), per-miner durability degradation (using `preRolls.minerDegradation`), and auto-repair (repair to 100% when crypto can afford the weekly cost). |
| [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) | Inline IIFE (~87 lines) → 7-line call. |
| [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts) | 14 new tests including: no-warehouse / no-miners / degradation / 10-week boundary / 9-week boundary / 2.0× cap / legacy `lastDifficultyUpdate` corruption migration / no-money / partial-repair-mix / boundary repair (<50 AFTER decay vs >=50) / no-repair-needed-fallthrough / explicit-absolute-precedence. |

---

## Test coverage breakdown

| Test | Code path exercised |
|---|---|
| no warehouse | early return (undefined) |
| no miners | early return (warehouse unchanged) |
| degradation | `Math.max(0, current - roll)` |
| floor at 0 | low durability + high roll |
| difficulty at 10w | multiplier × 1.1 |
| difficulty at 9w | no update |
| difficulty cap | clamps at 2.0 |
| legacy field migration | `lastDifficultyUpdate > currentWeek` corrupts → migrated to current |
| can't afford auto-repair | repair skipped |
| mixed durabilities | only `<50` are repaired |
| boundary 50→47 after decay | triggers repair (<50 post-decay) |
| boundary 56→53 after decay | NO repair (>=50 post-decay) |
| no miners needing repair | totalRepairCost=0, falls through to bottom return |
| explicit absolute precedence | `lastDifficultyUpdateAbsoluteWeek` wins over legacy `lastDifficultyUpdate` |

The "boundary 50→47 vs 56→53" tests are critical — they verify that the `<50` repair check happens AFTER degradation, not before. Locked in by snapshot.

---

## Mining pipeline complete

Two helpers, ~175 lines extracted, 25 snapshots locked.

| Sub-step | Helper | Concern | Lines | Tests |
|---|---|---|---|---|
| 2.6-ii-A | `applyMiningCryptos` | Crypto earnings + halving + auto-repair cost | ~88 | 11 |
| 2.6-ii-B | `applyMiningWarehouse` | Difficulty + durability + auto-repair-to-100 | ~87 | 14 |
| **Total** | **2 helpers** | **Full mining pipeline** | **~175** | **25** |

---

## Why this is safe

1. **Source identity.** The P0-12 legacy migration comment + math, the `Math.min(2.0, ...)` cap, the `>= 10` cooldown check, the `Math.max(0, current - roll)` durability floor, the 8-tier `MINER_REPAIR_COSTS` catalog, the `currentDurability < 50` repair gate, the `100 - currentDurability` health-to-restore calc, the early-return on auto-repair success, and the bottom fallthrough return are verbatim from the inline code.
2. **Type-check clean.** `tsc --noEmit` → exit 0, 0 errors.
3. **Zero snapshot drift.** 14 snapshots locked BEFORE the GameActionsContext swap. After: 258/258 pass across the full battery.

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
| **Running total** | **~1,269 lines** |

Original was ~2,300 lines. **~55% extracted**, all behavior-preserving.

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor                    → 263 passed, 258 snapshots passed (zero drift)
npx jest __tests__/startup                     → 64 passed
npx jest __tests__/integration                 → 96 passed (zero regression)
```

**Total: 423 tests across 12 suites, 258 snapshots, zero drift.**

---

## Next: step 2.6-iii — relationships (the big one)

The remaining ~200-line relationships block. The audit estimated 4 sub-concerns:
- Pregnancy + birth (uses `preRolls.childGender`, `preRolls.childIdSuffix`, `preRolls.childPersonality`)
- Scheduled weddings (execute / postpone / expire)
- Child aging
- Low-relationship breakup + disappointed rolls (uses `preRolls.relBreakup[i]`, `preRolls.relDisappointed[i]`)
- NPC depth tick (calls `npcDepth.tickRelationship`)

Will likely need 3-4 further sub-sub-splits.

Alternatives:
- **Step 2.7+** — events + cliffhanger + life-moments + meta (~350 lines).
- **Outside Phase 2** — SB-1 / Phase 5 / Phase 3 still queued.

Say "continue" for step 2.6-iii (with safe sub-sub-splits), name another priority, or stop here.
