---
name: weekly-audit
description: Run the weekly routine audit — static checks plus the deep 5-domain qualitative pass — and act on blocking findings
---

# Weekly Audit

The repeatable health check for DeepLife Simulator. The static suite is the
**floor**; the value is the qualitative pass that hunts for what the suite
can't catch. Treat every candidate finding as an UNVERIFIED LEAD until you have
read the actual source line (see `tasks/lessons.md` — a prior run over-graded 9
"P0s" that were all non-bugs).

## 1. Run the static checks

```
npm run audit:weekly          # type-check + lint errors + full Jest suite
npm run audit:weekly:full     # also runs perf + money-conservation stress suites
```

This writes `tasks/weekly-audit-<YYYY-MM-DD>.md`. Read it. A red row means a
real regression — fix it before going further. (On a fresh web/cloud container
`node_modules` may be absent; run `npm ci` first — the SessionStart hook in
`.claude/settings.json` does this automatically.)

## 2. Deep qualitative pass — the five domains

Go beyond the static checks. Use the project subagents where useful and run the
domains in parallel. For each candidate, open the file and confirm the bug at
the line before recording it.

1. **Economy & Balance** — new money printers / positive-EV repeatable events;
   every `money` write routed through `applyMoneyDelta` / `updateMoney`;
   re-entrancy (trailing dispatches that read stale outer `gameState`);
   real-estate / rental / crypto / loan math.
2. **Crash & Stability** — unguarded array/object access in the weekly tick
   (`contexts/game/actions/weekly/**`); `Modal`s without `onRequestClose`;
   `JSON.parse` into Maps/iterables; divide-by-zero / NaN in visualizations.
3. **Save & State Integrity** — `STATE_VERSION` (canonical in
   `contexts/game/initialState.ts`); every unbounded array covered by the
   `utils/saveQueue.ts` prune pass; migration-chain integrity; schema drift
   (fields written but absent from `types.ts` or the prune).
4. **Game Logic Correctness** — `week` (1–4, UI only) vs `weeksLived` (absolute,
   use for ALL time comparisons); event-chain stage counts; income-vs-death
   ordering in the weekly updater; cadence drift across pauses.
5. **Week-Loop Performance** — full-state `useGame()` subscriptions defeating
   selectors/memos; redundant per-tick `setGameState` commits; per-tick passes
   that grow with playtime.

Project subagents to launch (per `CLAUDE.md`):
- **Game State Reviewer** — mutation bugs, signature mismatches, `week` vs `weeksLived`.
- **Save System Auditor** — schema drift, corruption vectors, prune gaps.

## 3. Act on findings

- **Critical / High (P0/P1) — blocking:** fix directly. Develop on a new branch
  (NEVER push to `main`), prove the fix (`npm run audit:weekly` + targeted
  tests), and open a PR. Summarize the medium/low (P2) findings in the PR body.
- **Nothing blocking:** summarize the verdict + the top 3 actions. Do not open a
  PR. Append any lessons to `tasks/lessons.md`.

## 4. Always

- Source-verify before reporting or fixing — no severity inflation.
- Record the dated report and update `tasks/lessons.md` after any correction.
- Run `npm run audit:weekly` once more after a fix to prove green.
