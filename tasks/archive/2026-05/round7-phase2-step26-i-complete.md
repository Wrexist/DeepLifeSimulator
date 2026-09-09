# R7 Phase 2 step 2.6-i — crime tick extracted (complete)

> First slice of step 2.6 (relationships + family + crime + mining). Crime is the smallest and most isolated piece — natural starting point.

---

## Scope reduction (honest)

Step 2.6 covers ~280 lines across four domains:

- **2.6-i (this step)** — crime: wanted-level decay + police encounter. ~19 lines.
- **2.6-ii queued** — relationships (pregnancy / wedding / breakup / NPC depth). ~200 lines, will need its own sub-splits.
- **2.6-iii queued** — mining (cryptos + warehouse + halving). ~60 lines.

Crime is the smallest, most isolated, and uses one deterministic preRolls value — natural starting point.

---

## What landed

| File | Change |
|---|---|
| **NEW** [contexts/game/actions/weekly/applyCrimeTick.ts](contexts/game/actions/weekly/applyCrimeTick.ts) | `applyCrimeTick(input, ctx)` — mutates `ctx.newStats.{happiness, money}` and `ctx.notifications`. Returns `{ newWantedLevel, policeEncounterJailWeeks }`. |
| [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) | Inline block (~19 lines) → 8-line call. |
| [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts) | 13 new tests covering every code path — see breakdown. |

---

## Test coverage breakdown

| Test | Code path exercised |
|---|---|
| wantedLevel 0 | no decay, no encounter |
| undefined wanted/jail | defaults to 0 |
| wanted 3, not in jail | decay to 2 |
| wanted 3, IN jail | no decay (frozen) |
| wanted 5, in jail | encounter check blocked |
| wanted 5 → 4 after decay | encounter check < 5 threshold |
| wanted 6 → 5, roll 0.01 | encounter chance 5% → fires |
| wanted 6 → 5, roll 0.10 | encounter chance 5% → no fire |
| wanted 10 → 9, low roll | chance capped at 30%, jail = min(4, ceil(9/3)) = 3 |
| wanted 15 → 14, low roll | jail = min(4, ceil(14/3)) = 4 |
| encounter with $50 cash | fine = min(50, round(50 × 0.05)) = 3 |
| encounter with $0 cash | fine = 0 |
| happiness near floor | clamped at 0 after -15 |

The "wanted 5 → 4" test is the key boundary — the legacy code checks `newWantedLevel >= 5` AFTER decay. A naive read of the source would expect encounter at wanted=5, but the decay runs first and drops it to 4. Preserved exactly.

---

## Why this is safe

1. **Source identity.** The decay formula (`Math.max(0, wanted - 1)`), the encounter-chance formula (`Math.min(0.30, (wanted - 4) * 0.05)`), the jail-weeks formula (`Math.min(4, Math.ceil(wanted / 3))`), the fine formula (5% of cash, rounded, capped at cash), and the message template are verbatim from the inline code.
2. **Type-check clean.** `tsc --noEmit` → exit 0, 0 errors.
3. **Zero snapshot drift.** 13 snapshots locked BEFORE the GameActionsContext swap. After: 233/233 pass across the full battery.

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
| **Running total** | **~1,094 lines** |

Original was ~2,300 lines. **~48% extracted**, all behavior-preserving.

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/refactor                    → 238 passed, 233 snapshots passed (zero drift)
npx jest __tests__/startup                     → 64 passed
npx jest __tests__/integration                 → 96 passed (zero regression)
```

**Total: 398 tests across 12 suites, 233 snapshots, zero drift.**

---

## Next options

- **Step 2.6-ii** — mining (cryptos + warehouse + halving + auto-repair + difficulty). ~60 lines. Mid-risk: uses `preRolls.minerDegradation` + several module functions but mostly pure.
- **Step 2.6-iii** — relationships (~200 lines, will need sub-splits for pregnancy / wedding / breakup / NPC). Higher risk.
- **Step 2.7+** — events + cliffhanger + life-moments + meta-blocks (~350 lines).
- **Outside Phase 2** — SB-1 / Phase 5 / Phase 3 still queued.

Recommendation: mining next (smaller, lower risk than relationships). Say "continue" for step 2.6-ii, name another priority, or stop here.
