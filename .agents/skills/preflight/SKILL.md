---
name: preflight
description: Validate DeepLife Simulator source, tests, lint and release configuration before an iOS or Android candidate build.
---

# Preflight

Read current package.json scripts and docs/RELEASE_RUNBOOK.md. Preserve the worktree
and report the exact revision plus uncommitted changes.

If the lockfile changed or dependencies are broken, run npm ci and
npm ci --prefix art/game-assets-v1/source. An incomplete install is not a gameplay
failure. On Windows fix path/CLI portability rather than suppressing checks.

Run npm run preflight for iOS (or the requested platform script). It includes
source/test types, lint and current quality/content/liveops gates. Read the entire
result: an intermediate success banner does not override a later ratchet failure.
The script does not perform a full native build.

Run relevant unit/integration tests. For a release candidate or broad game/save
change use npm test -- --runInBand --watchAll=false, which subsumes those categories.
Do not repeat redundant unchanged suites. Run required opt-in stress/simulation
cases separately and identify skips. Run coverage plus coverage:ratchet when in
scope; preserve all floors.

Complete a production bundle export separately when requested; syntax checks are
not Metro/Hermes exports. Record locally unverifiable production configuration
without printing keys. EAS environment verification and a processed signed binary
are separate from local tests.

Report exact failed commands and causes, fix authorized local failures, and rerun
affected checks. Do not dispatch a build with failed prerequisites. If a specific
build is already authorized, proceed once its prerequisites pass; otherwise finish
the requested validation without automatically asking for or starting a build.
Native acceptance remains in tasks/release/R06.md, R08.md and R09.md.
