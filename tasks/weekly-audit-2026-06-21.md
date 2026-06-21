# DeepLife Simulator — Weekly Audit (2026-06-21)

**Static checks: PASS** (full: incl. perf + money-conservation)

| Result | Check | Time |
|--------|-------|------|
| ✅ | `type-check` | 35.0s |
| ✅ | `lint (errors only)` | 31.2s |
| ✅ | `jest (full suite)` | 66.7s |
| ✅ | `jest (perf + money-conservation)` | 5.6s |

---

## Qualitative pass — do NOT stop at the green table above

The static checks are the floor. Now do the deep, source-verified pass across
the five domains (see `.agents/skills/weekly-audit/SKILL.md`). For each, hunt
for issues the static suite can't catch, and **verify every candidate against
the actual source before reporting it** (treat any subagent grade as an
unverified lead — see `tasks/lessons.md`):

- [ ] **Economy & Balance** — new money printers / positive-EV repeatable
      events; every `money` write routed through `applyMoneyDelta`/`updateMoney`;
      re-entrancy (trailing dispatches reading stale outer state).
- [ ] **Crash & Stability** — unguarded array/object access in the weekly tick;
      Modals missing `onRequestClose`; `JSON.parse` into Maps/iterables;
      divide-by-zero / NaN in viz.
- [ ] **Save & State Integrity** — `STATE_VERSION` (canonical in
      `contexts/game/initialState.ts`); every unbounded array covered by the
      `utils/saveQueue.ts` prune pass; migration-chain integrity; schema drift.
- [ ] **Game Logic Correctness** — `week` vs `weeksLived` discipline; event-chain
      stage counts; ordering of income vs death checks; cadence drift across pauses.
- [ ] **Week-Loop Performance** — full-state subscriptions defeating selectors;
      redundant per-tick `setGameState` commits; unbounded per-tick passes.

### Findings (fill in)

Two source-verifying subagents (Economy/Balance and Crash+Save+Logic) swept the
five domains. Every fix from the earlier 2026-06-21 consolidated audit (PR #24)
was re-read at source and confirmed correct — **no P0/P1, no broken fixes, no
regressions.** Five new P2s were found; each was verified at the line before
recording.

| # | Domain | Severity | File:line | Description | New / Broken-fix | Status |
|---|--------|----------|-----------|-------------|------------------|--------|
| 1 | SAVE | P2 | `utils/saveQueue.ts` (socialMedia prune) | `socialMedia.pendingBoosts` append-only, never drained or capped → slow save-bloat | NEW | ✅ Fixed (this PR) |
| 2 | SAVE | P2 | `lib/social/pulseTick.ts:260,380` | `socialMedia.brandInbox.history`/`.declined` unbounded, absent from prune | NEW | ✅ Fixed (this PR) |
| 3 | LOGIC | P2 | `contexts/game/actions/weekly/applyPets.ts:76,79` | Pets past the pre-roll length read `undefined` → sickness-immune (pre-rolls were length 10, no pet cap, dead pets occupy indices) | NEW | ✅ Fixed (this PR) |
| 4 | ECON | P2 | `contexts/game/GameActionsContext.tsx:1285,1311,1387` | Weekly-tick `cashDelta` writes use raw `Math.max(0, money+Δ)`, bypassing `MONEY_CEILING` (deltas position-bounded → overflow implausible) | NEW | ⏸ Deferred — hot-path semantics decision |
| 5 | ECON | P2 | `lib/events/engine.ts:2361` | `vehicle_theft` insurance pays `price*0.5` on a full insured loss with no premium check → mildly positive-EV (weight 0.05) | NEW | ⏸ Deferred — balance-number decision |

### Verdict

> **HEALTHY — nothing blocking.** No P0/P1. Static checks all green (type-check 0,
> 2560 tests pass, perf + money-conservation green). Findings 1–3 (the two
> unbounded social-media sub-arrays and the >10-pet sickness immunity) are fixed
> in this PR with a regression test. Findings 4–5 are deferred low-severity items
> that need a balance / hot-path-semantics call rather than a guessed fix —
> tracked here for a future pass.
