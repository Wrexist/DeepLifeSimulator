# Weekly Routine Audits — Setup Plan (2026-06-21)

Goal: a perfected, automated, weekly audit suite covering 5 domains, runnable locally
(`npm run audit:weekly`) and in CI (cron, Mondays). Each audit is a deterministic static
analyzer that reads the real source/constants, emits `[PASS]/[WARN]/[FAIL]` with file refs,
and contributes a section to a single timestamped Markdown report.

## Deliverables
- [x] Map codebase (week-loop, economy, save, stability, logic) — done via subagents
- [x] `scripts/audit/_lib.cjs` — shared helpers (colors, file walk, const extraction, report)
- [x] `scripts/audit/audit-economy.cjs` — 1. Economy & Balance (15 invariants, all green)
- [x] `scripts/audit/audit-stability.cjs` — 2. Crash & Stability (7 invariants, all green)
- [x] `scripts/audit/audit-save.cjs` — 3. Save & State Integrity (9 green, 1 medium warn)
- [x] `scripts/audit/audit-logic.cjs` — 4. Game Logic Correctness (4 invariants, all green)
- [x] `scripts/audit/audit-perf.cjs` — 5. Week-Loop Performance (brace-depth nesting, all green)
- [x] `scripts/audit/run-weekly-audit.cjs` — orchestrator → `tasks/weekly-audit-<date>.md`
- [x] `package.json` — `audit:*` + `audit:weekly` + `audit:weekly:full` scripts
- [x] ~~`.github/workflows/weekly-audit.yml`~~ — removed; the suite now runs as a **Claude
      Routine** (Code → Routines → Schedule, prompt `/weekly-audit`), not GitHub Actions
- [x] `.agents/skills/weekly-audit/SKILL.md` — Claude playbook tying scripts + deep audit
- [x] CLAUDE.md row + .gitignore for generated reports
- [x] Run the suite — exit 0, surfaces 1 honest non-blocking finding (20× `as GameState`
      test-drift, Hard Rule #3). Left as a visible WARN, not mass-refactored (out of scope/risky).
- [ ] Verify type-check unaffected, commit, push

## Result of first run (baseline)
Verdict: 🟡 PASS (warnings) — 0 critical, 0 high, 1 medium. All 5 domains wired and green
except the pre-existing test-factory drift the Save audit correctly reports.

## Invariants each audit enforces (tied to documented history)
1. Economy: savings APR < loan APR (no arbitrage); tax brackets progressive & marginal;
   miner prices monotonic; soft-cap/efficiency sane; regression guard on the old 15% APR.
2. Stability: no `as any` in game contexts; native requires inside try/catch; config-plugin
   alignment (Hard Rule #4); ErrorBoundary present.
3. Save: STATE_VERSION consistent across initialState/CLAUDE.md/AGENTS.md; migration registry
   covers [2..STATE_VERSION]; no `as GameState` / manual construction in tests.
4. Logic: no `.week` in time comparisons (use `weeksLived`); DatingActions signature trap;
   no direct state mutation in actions.
5. Perf: weekly-tick deep-clone / nested-loop budget; subsystem resilience wrapping.
