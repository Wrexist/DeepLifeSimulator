# Repository cleanup: 9 September 2026

Base: `811cfc2cec03f9cae1f0b0bb4e55298dcadf06c5`.

## Changes

- Replaced stale root overview and cloud-backend example with navigation to current sources.
- Added docs/tasks indexes and 35 master-prompt briefs from the current audit.
- Archived 76 older task reports and relocated seven supporting files (83 moves total).
- Preserved the exact 1,494-line TODO ledger from the initial `811cfc2` audit.
- Also preserved the full pre-integration `a470e79:tasks/todo.md` in
  `tasks/archive/todo-before-integration-2026-09-09.md`, including concurrent
  release/conflict/review work. The short current index links both snapshots.
- Preserved old release copy, planning documents and the historical paywall capture.
- Removed three identical, unreferenced PNG outputs under `undefined/` and an unreferenced malformed marketing index.
- Fixed the accidentally commented-out Playwright output ignore and ignored `/undefined/` output.
- Updated in-repo path references. Five source/test edits change comments only.

## Boundaries

No runtime logic, dependency, migration, asset catalog, native configuration,
workflow, production support page or store metadata changed. Existing cloud,
legacy save fields and source assets remain. File age and missing imports alone
are not sufficient evidence for deleting runtime code or assets.

PR #203 merged independently during cleanup review. PR #206 fixed its two P1
review findings. Cleanup #205 integrated that work and merged at `6c89195` after
current checks passed. Follow-up #207 preserves the complete concurrent ledger
and corrects the executable wrapper's repository paths. Historical audit claims
above describe the cleanup's own changes, not the inherited runtime fixes.

## Verification

Route, ASO, content and live-ops checks passed locally. The original ledger
is byte-identical to its pre-cleanup source. All five source/test modifications
are mapped path references in comments only. All 224 new navigation links resolve.
Published as PR #205. GitHub reports it mergeable; EAS Update CI is running.
The connected GitHub publication produced the exact locally verified tree. The source audit's test
results are recorded separately in MASTER_PROMPT_BACKLOG.md and must not be
relabeled as tests of this cleanup commit.
