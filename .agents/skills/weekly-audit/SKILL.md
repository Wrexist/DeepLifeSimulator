---
name: weekly-audit
description: Audit DeepLife Simulator economy, crash stability, save/state integrity, game logic and weekly performance using static checks and real gameplay transitions.
---

# Weekly audit

Read AGENTS.md, CLAUDE.md and current task/release evidence. Refresh PRs and source
before treating an old finding as open. Run npm run audit:weekly and read the dated
report. Static green is not release approval.

For a whole-app audit, use bounded independent save/state and game-logic reviews
when subagents are available. Assign clear file ownership for edits. Otherwise
review locally. This repo has no .claude/agents/ or .claude/prompts/ files.

| Domain | Deep pass |
| --- | --- |
| Economy | Atomic latest-state charges/grants; caps, marginal tax, bankruptcy, cash/debt/asset separation; real-tick conservation and economy stress tests. |
| Stability | Entry/layout, native lazy-load guards, config/dependency alignment; startup regressions and source/test types. Native launch remains a device check. |
| Save/state | Migration, repair and test-factory shape; mutex ownership, persisted replay, slot switches and purchase binding. Timeouts never permit unlocked writers. Save/integration and long-run save/load tests. |
| Logic | weeksLived and life-relative clocks; research, relationships, claims and education through the production reducer, including refusal/double taps. |
| Performance | Performance tests and growing collections/nested loops. Measure before/after; Node timing cannot certify native frame time. |

Use existing commands and the real provider/tick harness. A full suite subsumes
ordinary unit/integration/performance cases; opt-ins need their documented flags.
Record skips and interruptions. Windows scanners must normalize relative paths
before matching imports/allowlists. Never delete code solely from a reachability
heuristic.

Reproduce critical/high findings and fix authorized blockers with behavioral
regressions. Trace medium/low warnings; distinguish defects, portability errors and
backlog. Never suppress findings or loosen floors. Audit-only requests produce
findings and proposed fixes; implementation follows user scope.

Write dated evidence: revision, commands/exits, reproductions, fixed/remaining
findings, visual/native limits and next actions. Update tasks/todo.md and concrete
recurring lessons. Reopen release assertions invalidated by evidence; mocked tests
and source reviews cannot verify provider/device gates.
