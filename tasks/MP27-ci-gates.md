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
- Full coverage run and first remote workflow results: pending.
- Source coverage floors remain 55.0 statements, 36.3 branches, 46.6 functions,
  and 56.2 lines; collection scope is unchanged.

## Release gates checked during CI preparation

The browser runtime initialized, but tab discovery timed out twice after the
documented connection check. No interactive journey or visual acceptance claimed.
Read-only ASC status still fails because ASC_KEY_ID, ASC_ISSUER_ID and
ASC_KEY_P8/ASC_KEY_P8_PATH are unavailable in this session. No store mutation was
attempted. Native candidate/device and provider operational evidence is still
required; these CI changes do not satisfy those dependencies.
