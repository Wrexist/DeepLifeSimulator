# Current work

## Discord watcher repair — 11 September 2026

Observed run 34578762105 repeatedly seeds both baselines and then reports no
state change: git diff ignores the new untracked checkpoint files. Plan: stage
before comparing, persist with tested Git helper, serialize watcher commits,
show explicit no-post/sent outcomes, verify and prepare PR. Do not backfill old
announcements or send test messages without the owner's explicit message scope.

## Post-merge continuation — 10 September 2026

PR #209 merged as `4046365e`; its four final CI gates passed. Main production
update and support deployment were running when this task started. No open PRs.
Current plan: close the observed missing analytics permission refresh on return
from iOS Settings; test denied/error/rapid lifecycle transitions, run preflight,
record evidence and prepare a separate PR. Native consent, cached ad requests and
the designated deletion rehearsal remain explicit acceptance cases.

Evidence and exact device steps: [R11 resume consent](release/evidence/R11-resume-consent-2026-09-10.md).
Focused verification: 5 suites / 40 tests passed. Policy revision 3 is now live,
verified directly after the successful support deployment. Native defaults still
require a rebuilt binary; a main OTA does not supply them.
The owner can run an iPhone rehearsal on a fresh installation with no real
purchases. Next after this PR's CI: reconcile and prepare the exact signed build
and its TestFlight instructions. The local standalone EAS CLI is unavailable;
no new cloud build or submission has been dispatched.

## Priority execution — 10 September continuation

Current bounded plan: add a player-reviewed deletion request with existing
provider IDs only; verify unavailable/failed SDK paths, no provider initialization
or consent changes, compact/tablet presentation and final PR checks. Provider
deletion rehearsal and signed-device consent remain separate acceptance gates.

- [x] Refresh main, PR #209 and its successful final-head checks.
- [ ] R11: reconcile actual App Privacy/provider settings with the code data/consent map.
- [ ] R04: exercise remaining journeys, reproduce and fix reachable player defects.
- [ ] R08/R06/R09: resolve candidate identity and available native acceptance access.
- [ ] R07/R10: prepare exact metadata/submission evidence, retaining unresolved gates.
- [ ] Verify changes, update the review branch and inspect final checks.

Continuation evidence: [privacy/provider reconciliation](release/evidence/R11-privacy.md)
and [actual TestFlight candidate](release/evidence/R08-candidate-2026-09-10.md).
Isac Molin is the owner-confirmed individual operator in Sweden; Molin Inc. is
an unregistered project name. The owner monitors support and reports no prior deletion
requests. A researched deletion procedure is drafted, not yet adopted. Local work adds
fail-closed ATT and UMP ad-request gating. A follow-up adds separate optional usage
analytics, default denied native purposes and withdrawal handling. Its full local
run caught one eager-storage startup import; fixed, then six focused suites / 40
tests passed. Final-head CI must confirm the full suite. These Firebase defaults
require a new native build. Latest native
upload is 2.14.0 (186), older than these fixes.
Full local verification: 787 suites / 9,822 tests / 308 snapshots pass, preflight
exit 0, zero source/test type and lint errors. Analytics property 545257707 has
2-month event / 14-month user retention (activity reset on); its iOS stream
reports missing consent signals. The optional control passed web phone/tablet
inspection, opt-in persistence and withdrawal persistence. Next: verify actual
native signals and system ATT revocation, then a minimal player privacy-request
ID flow and a designated test-account deletion rehearsal.

Follow-up: prior `f6279b48` CI now PASS (789 suites / 9,835 tests / 308 snapshots).
The player privacy-request ID flow is implemented with 23 focused tests passing,
preflight exit 0 and phone/tablet web evidence. New request-flow CI remains to
be inspected after push. Native ID/consent checks and a designated test-account
deletion rehearsal are still required; no real request or deletion was sent.

## Release audit refresh — 10 September 2026

- [x] Clear verified stale Git lock, fast-forward main, preserve and reapply local popup fix.
- [x] Refresh open/merged PRs and actual CI/build history.
- [x] Repair local dependency installation and rerun automated audits, full tests and preflight.
- [x] Review save/state, logic/economy/performance and release/provider evidence.
- [x] Write a dated prioritized release audit with verified results and explicit external gaps.
- [x] Fix reproduced save-replay and weekly-cash recap defects with behavioral regressions.
- [x] Repair current Apple API compatibility and Windows tooling without weakening checks.
- [x] Install reviewed mobile skills; add concise future-chat guidance and repair stale local skills.
- [x] Verify combined changes locally, document native/device limits and preserve [draft PR #209](https://github.com/Wrexist/DeepLifeSimulator/pull/209).
- [ ] Inspect PR #209 checks at its final head; native acceptance remains separate.

Latest: [10 September audit and ordered release list](release/evidence/ios-quality-audit-2026-09-10.md).
Candidate branch: `codex/ios-release-quality-2026-09-10`; native/provider gates remain HOLD.

Updated 10 September 2026. This is the short entry point, not a second release queue.
Verify current main, PR heads and provider records before acting.

## Start here

- [Master-prompt backlog](MASTER_PROMPT_BACKLOG.md): 35 scoped packages with dependencies and acceptance criteria.
- [Task guide](README.md): where plans and evidence belong.
- [Initial audit ledger](archive/todo-before-cleanup-2026-09-09.md) and [full pre-integration ledger](archive/todo-before-integration-2026-09-09.md): both preserved verbatim at their named revisions.
- [Lessons](lessons.md): recurring engineering constraints and past corrections.

## Active release

[PR #203](https://github.com/Wrexist/DeepLifeSimulator/pull/203) merged the
release queue and save/research/validation fixes at `c32f2b9`.
Use the [remaining-work guide](release/REMAINING_WORK.md),
[release queue](release/queue.json), and [execution contract](release/CONTRACT.md).
[PR #206](https://github.com/Wrexist/DeepLifeSimulator/pull/206) merged verified
save/load timeout handling and evidence ancestry validation at `a470e79`.
Cleanup [PR #205](https://github.com/Wrexist/DeepLifeSimulator/pull/205) merged at
`6c89195`. User authorized the reviewed merge loop on 9 September 2026.

| Package | Remaining acceptance |
|---|---|
| R11 | Verified provider/operator facts, accurate live privacy/support and store answers |
| R04 | Reached player journeys and visual acceptance |
| R08 | Exact signed production candidate and processed TestFlight identity |
| R06 | Native purchases, interruption, recovery and Restore |
| R09 | iPhone/iPad lifecycle, ads, accessibility and performance |
| R07 | Current store record, release notes, locales and native screenshot parity |
| R10 | Complete evidence and submission packet |

The release remains HOLD until the required evidence exists. Do not reuse stale
“dispatch 2.13.0” instructions without checking current build/store records.
R00/R01/R02/R03/R05 have recorded implementation evidence. #206 corrects unpublished
local commit references; native/store acceptance remains separate.

## Recently merged

| PR | Finished implementation | Still separate |
|---|---|---|
| #197 | Purchase persistence/recovery, legacy migration repairs, journal and claim continuity | Native and cross-install recovery boundaries |
| #199 | Education quotes/atomic enrollment and loan/pension cash-flow corrections | Full post-bills forecast and optional deferment |
| #201 | Compact HUD and one first-job/goal surface | Native layout/accessibility acceptance |
| #200 | Reusable assets and recap presentation | HomeScene intentionally not mounted on Home |
| #204 | Ten game-themed store stories in three sizes | Native parity and current store upload |

## MP27: CI gates and handoff corrections — PR #207

Master prompt: close the confirmed ordinary-component/content/liveops CI gap.
Add a small relevant-path workflow running existing UI/content/liveops ratchets;
add weekly/manual coverage and run it on coverage-workflow/configuration changes.
Keep all floors, native release gates and existing EAS behavior unchanged.
Validate YAML, representative matching/nonmatching paths, actual ratchet commands
and a full coverage measurement. Review the diff, open a focused PR after MP00,
inspect its current checks and merge only when they pass. Keep provider/device
release gates explicitly blocked when their evidence is unavailable.

- [x] Confirm missing ordinary-component filters and absent coverage cadence.
- [x] Add targeted workflows and document their cadence.
- [x] Validate YAML/path cases and unchanged quality/coverage floors locally.
- [x] Confirm full-checkout CI on the latest [PR #207](https://github.com/Wrexist/DeepLifeSimulator/pull/207) head.
- [x] Preserve concurrent ledger history and correct master-prompt repo paths.
- [x] PR #207 merged on 9 September; main `ea9880d0` EAS Update passed. Do not repeat MP27.

## Next product work after release

1. MP08: authoritative cash/arrears/rental/noncash forecast before commitments.
2. MP09: causal weekly recap with useful actions.
3. MP10–MP13: path discovery, connected arcs, deliberate relationships and non-wealth endings.

Later experiments, maintenance, Android and marketing remain separate packages
in the backlog. Historical hypotheses are not confirmed defects.

## Repository cleanup

- [x] Inspect current source, PRs, TODOs and literal source markers.
- [x] Archive old reports, preserve historical evidence and add navigation.
- [x] Remove only verified unreferenced generated outputs from `undefined/`.
- [x] Verify references/content preservation and relevant local checks.
- [x] Publish [cleanup PR #205](https://github.com/Wrexist/DeepLifeSimulator/pull/205) and inspect latest CI. Latest integrated checks passed before merge.

## MP00 integration review

- [x] Inspect both PR heads, review comments and completed CI logs.
- [x] Repair the encoding fixture exception after its historical report moved.
- [x] Verify cleanup CI and merge #205 at its checked head.
- [x] Merge verified #206 save/load acquisition and evidence ancestry corrections.
- [x] Refresh merged #203 and integrate its release queue without restoring old TODO history.
- [x] Refresh release blockers and execute independent MP27. R11 source is now published; native/provider acceptance remains blocked.

Integration note: if #203 updates this file, retain its live release entries and
the navigation above. Do not restore the archived 1,500-line mixed history.
