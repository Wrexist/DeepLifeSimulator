# MP27: CI coverage and relevant change gates

## Master prompt

Read CLAUDE.md, the current task index, the MP27 backlog entry, existing EAS
Update/Preflight workflows, coverage/UI/content ratchets, and liveops watch.
Confirm the missing change triggers and coverage cadence on the current candidate.
Use the existing ratchet scripts and unchanged bounds. Add lightweight PR checks
for their real source inputs and scheduled/manual full coverage, with a PR check
when coverage infrastructure changes. Keep docs-only changes out of these added
jobs. Use read-only token permissions and bounded job/artifact retention. Preserve
native release checks and all existing deployment behavior. Parse the workflows,
test representative path matches/exclusions, execute the actual gates and inspect
the first remote runs. Fix real failures; never weaken the measurement to pass.
Merge only after MP00 integration and all applicable current-head checks pass.

## Findings and implementation

- Preflight filters did not cover ordinary component or authored-event changes.
  EAS Update ran tests and lint but omitted UI/content/liveops ratchets.
- No GitHub workflow ran the existing coverage ratchet. The weekly liveops watch
  remains separate and already provides an early warning.
- Added `quality-ratchets.yml`: existing source scanners, no dependency install.
- Added `coverage.yml`: Monday 03:17 UTC, manual and relevant configuration PRs.
  Full tests generate coverage; a separate step enforces unchanged floors.
- Cadence and scope: [CI gates](../docs/CI_GATES.md).

## Acceptance evidence

- Both YAML files parse. Sixteen representative path cases pass, including
  ordinary component/event/liveops changes, helper/coverage configuration changes,
  self-workflow changes and docs/archive exclusions.
- All three quality scripts pass locally with existing floors/ceilings.
- First remote quality job `102426880583` passed. Latest PR #207 checks and
  merge state are the current acceptance record.
- Local coverage: 59.94% statements, 42.33% branches, 52.23% functions and
  61.22% lines; the unchanged ratchet passes. Full local run: 781 suites passed,
  two suites failed only because the sparse checkout omitted asset/capture
  fixtures. Full-checkout remote coverage must pass before merge; no tests or
  collection paths were excluded to hide these failures.
- Source coverage floors remain 55.0 statements, 36.3 branches, 46.6 functions,
  and 56.2 lines; collection scope is unchanged.

## Release gates checked during CI preparation

The browser runtime initialized, but tab discovery timed out twice after the
documented connection check. No interactive journey or visual acceptance claimed.
Read-only ASC status still fails because ASC_KEY_ID, ASC_ISSUER_ID and
ASC_KEY_P8/ASC_KEY_P8_PATH are unavailable in this session. No store mutation was
attempted. Native candidate/device and provider operational evidence is still
required; these CI changes do not satisfy those dependencies.

## Handoff review corrections

PR #205's P2 review identified two documentation defects. Preserve the exact
full `a470e79:tasks/todo.md` as a second archive so concurrent release/conflict
and review plans are not lost. Its 1,556 lines hash to SHA-256
`3fa7df554fdf6b6f080bc29ea3b4047b6220c9269c1707a6239e9186d750870b`.
Retain the original 1,494-line `811cfc2` snapshot separately. Correct the executable
wrapper to `tasks/MASTER_PROMPT_BACKLOG.md` and `tasks/release/queue.json` and
refresh current merged-work references. Publication evidence discovered during
the loop is recorded separately under R11 without closing its external gates.
