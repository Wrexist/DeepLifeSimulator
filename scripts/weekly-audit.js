#!/usr/bin/env node
/**
 * Weekly routine audit driver for DeepLife Simulator.
 *
 * Runs the repeatable STATIC checks (type-check, lint errors, the full Jest
 * suite, and — with --full — the perf + money-conservation stress suites) and
 * writes a dated report to tasks/weekly-audit-<YYYY-MM-DD>.md. The report seeds
 * the 5-domain qualitative pass that an agent then performs by hand per
 * .agents/skills/weekly-audit/SKILL.md — the static checks are the floor, not
 * the audit itself.
 *
 * Usage:
 *   node scripts/weekly-audit.js          # type-check + lint + full suite
 *   node scripts/weekly-audit.js --full   # + perf & money-conservation stress
 *
 * Exit code is non-zero if any static check fails, so CI / a routine can gate
 * on it. The report is still written on failure.
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FULL = process.argv.includes('--full');
const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
const reportPath = path.join(ROOT, 'tasks', `weekly-audit-${today}.md`);

/** Run a command, stream nothing, capture combined output + status. */
function run(label, cmd, args) {
  process.stdout.write(`\n▶ ${label}: ${cmd} ${args.join(' ')}\n`);
  const started = Date.now();
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', shell: false });
  const ms = Date.now() - started;
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  const ok = res.status === 0;
  process.stdout.write(`${out}\n${ok ? '✅' : '❌'} ${label} (${(ms / 1000).toFixed(1)}s)\n`);
  // Keep the last few lines for the report so a failure is greppable later.
  const tailLines = out.trim().split('\n').slice(-12).join('\n');
  return { label, ok, ms, tail: tailLines };
}

const checks = [];
checks.push(run('type-check', 'npm', ['run', 'type-check']));
checks.push(run('lint (errors only)', 'npm', ['run', 'lint:errors']));
checks.push(run('jest (full suite)', 'npm', ['test', '--', '--ci', '--watchAll=false']));
if (FULL) {
  checks.push(
    run('jest (perf + money-conservation)', 'npx', [
      'jest',
      '__tests__/performance/performance.test.ts',
      '__tests__/stress/moneyConservation.stress.test.ts',
      '--ci',
      '--watchAll=false',
    ]),
  );
}

const allOk = checks.every(c => c.ok);
const statusLine = allOk ? 'PASS' : 'FAIL';

const rows = checks
  .map(c => `| ${c.ok ? '✅' : '❌'} | \`${c.label}\` | ${(c.ms / 1000).toFixed(1)}s |`)
  .join('\n');

const failureBlocks = checks
  .filter(c => !c.ok)
  .map(c => `### ❌ ${c.label}\n\n\`\`\`\n${c.tail}\n\`\`\``)
  .join('\n\n');

const report = `# DeepLife Simulator — Weekly Audit (${today})

**Static checks: ${statusLine}** ${FULL ? '(full: incl. perf + money-conservation)' : ''}

| Result | Check | Time |
|--------|-------|------|
${rows}
${failureBlocks ? `\n## Failures\n\n${failureBlocks}\n` : ''}
---

## Qualitative pass — do NOT stop at the green table above

The static checks are the floor. Now do the deep, source-verified pass across
the five domains (see \`.agents/skills/weekly-audit/SKILL.md\`). For each, hunt
for issues the static suite can't catch, and **verify every candidate against
the actual source before reporting it** (treat any subagent grade as an
unverified lead — see \`tasks/lessons.md\`):

- [ ] **Economy & Balance** — new money printers / positive-EV repeatable
      events; every \`money\` write routed through \`applyMoneyDelta\`/\`updateMoney\`;
      re-entrancy (trailing dispatches reading stale outer state).
- [ ] **Crash & Stability** — unguarded array/object access in the weekly tick;
      Modals missing \`onRequestClose\`; \`JSON.parse\` into Maps/iterables;
      divide-by-zero / NaN in viz.
- [ ] **Save & State Integrity** — \`STATE_VERSION\` (canonical in
      \`contexts/game/initialState.ts\`); every unbounded array covered by the
      \`utils/saveQueue.ts\` prune pass; migration-chain integrity; schema drift.
- [ ] **Game Logic Correctness** — \`week\` vs \`weeksLived\` discipline; event-chain
      stage counts; ordering of income vs death checks; cadence drift across pauses.
- [ ] **Week-Loop Performance** — full-state subscriptions defeating selectors;
      redundant per-tick \`setGameState\` commits; unbounded per-tick passes.

### Findings (fill in)

| # | Domain | Severity (P0/P1/P2) | File:line | Description | New / Broken-fix |
|---|--------|---------------------|-----------|-------------|------------------|

### Verdict

> (HEALTHY / BLOCKING). Fix P0/P1 on a branch + PR; summarize P2 in the PR body.
> If nothing blocks, summarize the verdict + top 3 actions and append lessons.
`;

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, report, 'utf8');
process.stdout.write(`\n📝 Report written: ${path.relative(ROOT, reportPath)}\nStatic verdict: ${statusLine}\n`);

process.exit(allOk ? 0 : 1);
