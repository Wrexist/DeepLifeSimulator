# Repository cleanup: 9 September 2026

Base: `811cfc2cec03f9cae1f0b0bb4e55298dcadf06c5`.

## Changes

- Replaced stale root overview and cloud-backend example with navigation to current sources.
- Added docs/tasks indexes and 35 master-prompt briefs from the current audit.
- Archived 76 older task reports and relocated seven supporting files (83 moves total).
- Preserved the exact 1,494-line previous TODO ledger; current entry point is 63 lines.
- Preserved old release copy, planning documents and the historical paywall capture.
- Removed three identical, unreferenced PNG outputs under `undefined/` and an unreferenced malformed marketing index.
- Fixed the accidentally commented-out Playwright output ignore and ignored `/undefined/` output.
- Updated in-repo path references. Five source/test edits change comments only.

## Boundaries

No runtime logic, dependency, migration, asset catalog, native configuration,
workflow, production support page or store metadata changed. Existing cloud,
legacy save fields and source assets remain. File age and missing imports alone
are not sufficient evidence for deleting runtime code or assets.

PR #203 owns active release work. This cleanup deliberately does not merge or
publish it. Reconcile `tasks/todo.md` with its current release entries when the
branches integrate; retain the short index and its authoritative release queue.

## Verification

Route, ASO, content and live-ops checks passed locally. The original ledger
is byte-identical to its pre-cleanup source. All five source/test modifications
are mapped path references in comments only. New navigation links resolve.
Remote CI is pending. The source audit's test
results are recorded separately in MASTER_PROMPT_BACKLOG.md and must not be
relabeled as tests of this cleanup commit.
