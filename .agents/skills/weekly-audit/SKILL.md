---
name: weekly-audit
description: Run the five-domain weekly routine audit (Economy, Crash/Stability, Save/State, Game Logic, Week-Loop Performance) — automated static checks plus a deep qualitative pass
args: "[domain]"
---

# Weekly Routine Audit

The standing weekly health check for DeepLife Simulator. It has two layers:

1. **Automated layer** — deterministic static analyzers in `scripts/audit/` that read the
   real constants/source and enforce documented invariants. Fast, runs in CI every Monday.
2. **Qualitative layer** — a guided deep pass (you, optionally with the project subagents)
   that catches what static analysis can't: new exploits, balance regressions, subtle
   correctness bugs.

`args` (optional): a single domain to focus on — `economy`, `stability`, `save`, `logic`,
or `perf`. With no argument, run all five.

## Step 1 — Run the automated suite (always)

```bash
npm run audit:weekly        # static, fast — writes tasks/weekly-audit-<date>.md
# or, with the dynamic perf/conservation jest backstop:
npm run audit:weekly:full
```

Read the generated `tasks/weekly-audit-<date>.md`. Any 🔴/🟠 finding is a blocker — fix it
or, if it's a false positive, tighten the analyzer (don't just suppress it). 🟡/⚪ are
review items: trace each to root cause and decide fix-now vs. backlog.

Per-domain scripts: `npm run audit:economy | audit:stability | audit:save | audit:logic | audit:perf`.

## Step 2 — Deep qualitative pass (per domain)

For each domain in scope, go beyond the static checks:

### 1. Economy & Balance
- Re-run the real long-game loop expectation (`__tests__/stress/economy*.stress.test.ts`,
  `moneyConservation.stress.test.ts`). Confirm money is conserved and the default loop is
  not trivially exploitable.
- Hunt new exploits with `.claude/prompts/exploit-audit.md` framing: any new income source
  added this week — is it capped, taxed, and not a per-week % refund printer (see H-3)?
- Verify every new cost/price sits on the correct ladder and respects `BANKRUPTCY_FLOOR`.

### 2. Crash & Stability
- Run `.claude/prompts/crash-audit.md`. Focus on native-module load paths, union access
  without `'prop' in obj` guards (Hard Rule #2), and `app.config.js` ↔ `package.json`
  plugin alignment (Hard Rule #4).
- Confirm `npm run preflight:quick` (type-check) is green.

### 3. Save & State Integrity
- Launch the **Save System Auditor** subagent (`.claude/agents/save-system-auditor.md`).
- Did any field get added to `initialState.ts` this week? Confirm: a migration is
  registered, `repairGameState` backfills it, and `createTestGameState` includes it.
- Run `__tests__/stress/saveMigrationAudit.stress.test.ts` and `longRunSaveLoad`.

### 4. Game Logic Correctness
- Launch the **Game State Reviewer** subagent (`.claude/agents/game-state-reviewer.md`).
- Audit any new time comparison: must use `weeksLived`, never `week` (1–4 display cycle).
- Verify `DatingActions` money calls use `updateMoney(setGameState, …)` (Hard Rule #5).

### 5. Week-Loop Performance
- `npm run audit:perf` then `npm run test:performance`.
- Inspect the nested-loop hotspots the static audit lists; confirm none became O(n²) over
  a player-growable array (NPCs, holdings, diseases). Re-baseline the ceiling only with a
  perf-suite run that proves timing is still within budget.

## Step 3 — Report & act

- The Markdown report is the deliverable. Summarize the verdict and the top 3 actions.
- Fix blockers immediately (Correctness > everything). File 🟡/⚪ items into the backlog.
- After any correction, append the lesson to `tasks/lessons.md`.

## Invariants enforced by the automated layer (reference)

| # | Domain | Key invariants |
|---|--------|----------------|
| 1 | Economy | savings APR < loan APR · progressive/marginal tax · monotone miner ladder · soft-cap sane · 15%-APR regression guard |
| 2 | Stability | native requires lazy + try/catch · config-plugin alignment · `as any` budget · ErrorBoundary present |
| 3 | Save | STATE_VERSION consistent across code+docs · full migration coverage [2..N] · no `as GameState` in tests |
| 4 | Logic | no `.week` in time math · DatingActions signature · no in-place state mutation |
| 5 | Perf | no JSON deep-clone in tick · subsystems try/catch-wrapped · nested-loop regression ceiling · perf test present |
