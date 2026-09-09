# R7 Phase 2 step 2.6-ii-A — mining crypto earnings extracted (complete)

> First half of mining. Warehouse miner array + halving + auto-repair cost deduction across both earning and non-earning paths.

---

## Scope reduction (honest)

The mining inline block at lines 1032-1209 was ~178 lines covering TWO concerns:

- **2.6-ii-A (this step)** — cryptos earnings + halving + auto-repair deduction. ~88 lines.
- **2.6-ii-B queued** — warehouse durability + difficulty + repair-to-100 logic. ~87 lines.

Splitting along the natural inline boundary (the two `calculateUpdated*` IIFEs).

---

## What landed

| File | Change |
|---|---|
| **NEW** [contexts/game/actions/weekly/applyMiningCryptos.ts](contexts/game/actions/weekly/applyMiningCryptos.ts) | `applyMiningCryptos(input)` — pure. Returns `{ updatedCryptos }`. Preserves prevCryptos ref when no warehouse / no selected crypto. |
| [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) | Inline IIFE (~88 lines) → 7-line call. |
| [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts) | 11 new tests covering every code path. |

---

## Test coverage breakdown

| Test | Code path exercised |
|---|---|
| no warehouse | early-return (ref preserved) |
| no selectedCrypto | early-return (ref preserved) |
| selected crypto + no miners | cryptoEarned = 0, returns prev |
| basic miners | normal BTC bump |
| industrial miners | larger BTC bump |
| halving 1 | cryptoEarned × 0.5 |
| halving 4 | cryptoEarned × 0.0625 (1/16) |
| mining ETH | different multiplier in calculateMiningEarnings |
| auto-repair + earnings | deducts cost from autoRepairCryptoId |
| auto-repair, no earnings | still deducts cost (separate path) |
| auto-repair cost > owned | floored at 0 |

The "auto-repair no earnings" path is a SEPARATE branch from the auto-repair-with-earnings path in the inline code. Both are now snapshot-locked.

---

## One preserved-as-is decision

The helper retains the `require('@/contexts/game/actions/MiningActions')` call for `calculateMiningEarnings`. The same eslint-disable comment is preserved verbatim. Converting to ES import would be a separate refactor — beyond byte-faithful extraction.

---

## Why this is safe

1. **Source identity.** The 8-tier `MINERS_DATA` array (basic / advanced / pro / industrial / quantum / mega / giga / tera) with weeklyEarnings + powerConsumption values, the `calculateMiningEarnings` call signature, the `Math.pow(0.5, halvingCount)` halving math, the two separate auto-repair branches, and the `Math.max(0, ...)` floor are verbatim from the inline code.
2. **Type-check clean.** `tsc --noEmit` → exit 0, 0 errors.
3. **Zero snapshot drift.** 11 snapshots locked BEFORE the GameActionsContext swap. After: 244/244 pass across the full battery.

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
| **Running total** | **~1,182 lines** |

Original was ~2,300 lines. **~51% extracted**, all behavior-preserving. **Half of `nextWeek()` is now in pure helpers.**

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor                    → 249 passed, 244 snapshots passed (zero drift)
npx jest __tests__/startup                     → 64 passed
npx jest __tests__/integration                 → 96 passed (zero regression)
```

**Total: 409 tests across 12 suites, 244 snapshots, zero drift.**

---

## Next: step 2.6-ii-B — warehouse durability + difficulty + auto-repair

The remaining warehouse update block at the (now shifted) lines ~1042+. ~87 lines including:
- `lastDifficultyUpdate` cyclic-vs-absolute reconciliation (legacy migration path).
- Difficulty multiplier with 10-week cooldown + 10% bump capped at 2.0×.
- Per-miner durability degradation (uses `preRolls.minerDegradation`).
- Auto-repair logic (8-tier `MINER_REPAIR_COSTS` catalog, repair under 50%, restore to 100%).

Estimated 1.5-2 hours. Snapshot count likely 12-15.

Alternatives:
- **Step 2.6-iii** — relationships (~200 lines, will need 3-4 sub-sub-splits).
- **Step 2.7+** — events + cliffhanger + life-moments + meta (~350 lines).
- **Outside Phase 2** — SB-1 / Phase 5 / Phase 3 still queued.

Say "continue" for step 2.6-ii-B (closes mining), name another priority, or stop here.
