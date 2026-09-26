# Audit fixes - 26 September 2026

- [x] Implement D01-D06 and D12: mutex-owned prestige, durable celebration/retry, strict money entry, committed campaign feedback and life-relative planning/Profile counts.
- [x] Verify 40 focused regressions and capture compact phone/tablet changes.
- [x] Save/finance CI: 826 suites / 10,047 tests / 308 snapshots; preflight and quality passed. Further UI follow-through: 26 focused tests and source/test types pass; results in [fix evidence](release/evidence/audit-fixes-2026-09-26.md).
- [x] D07/D08/D10/D11: Pulse identity, enrollment contrast, locked-control semantics and reduced motion. Family target is 44 points high.
- [ ] Next: finish D09 HUD gem-plus target, then D13-D14 display labels. [Remaining register](whole-app-audit-2026-09-26.md): 47 open items, D09 partially complete.
- No production deployment or signed native acceptance.

# Whole-app audit - 26 September 2026

- [x] Audit current source, 5 tabs / 19 app entries, nested/onboarding states and core save/game logic.
- [x] Compile [58-item prioritized register](whole-app-audit-2026-09-26.md) with screenshots, reproductions and native acceptance gaps.
- [ ] Next: fix the reproduced prestige writer mutex bypass (D01); then grouped-money parsing, FIRE/progression clocks and committed campaign feedback.
- Audit only; no gameplay fix or production release performed. Current code CI: 822 suites / 10,016 tests / 308 snapshots passed.

# HUD circle edge refinement - 26 September 2026

- [x] Replace nested rounded clipping with inset vector circles; retain icons and hit targets.
- [x] Check phone/tablet browser renders and focused HUD tests.
- [ ] Verify the curves on a signed iPhone build.
- Evidence: [circle edges](release/evidence/hud-circle-edges-2026-09-26.md).

# Whole-game polish follow-through - 26 September 2026

- Cleaned HUD utility circles per screenshot: one round surface, no inner bloom;
  gold store keeps its footprint without an expanding pulse.
- Settings now leads with preferences, uses shared tabs, has clearer switches and
  a compact header. Slot switching awaits a durable save and explains failure.
- Shared modal, button, app-header, stat-strip and empty-state refinements;
  Contacts/Mail/Hustle polish, specific Market labels, and direct-link lock checks.
- Browser: all five tabs and all 19 app entry screens at compact phone/tablet sizes;
  computer purchase survives save-slot switch/reload. Isolated QA fixture labelled.
- [Acceptance inventory and evidence](release/evidence/game-polish-2026-09-26.md).
- Next: nested transaction/player journeys and native accessibility/provider
  acceptance. No merge, OTA, paid build or store submission performed.

# Identity refinement ? 2026-09-26

- Implemented original street-line artwork across menu, player record and compact destination strips; removed generic motivational copy and oversized title badges. Approved HUD and save schema 51 unchanged.
- Evidence: [identity checklist](deeplife-identity-2026-09-26.md), [remaining work](visual-ux-remaining-2026-09-26.md). Signed-device acceptance is still outstanding.

# Current work

## Premium presentation, characters, 3D destinations and audio - 26 September 2026

Branch `codex/visual-ux-rebuild-2026-09-26`, based on current main `9e729ac2`.
[Checklist](visual-ux-rebuild-2026-09-26.md) and
[evidence](release/evidence/visual-ux-rebuild-2026-09-26.md).

- [x] Shared presentation tokens/primitives, five-tab navigation and main-screen polish.
- [x] Six curated GPT portraits; preserve custom avatar codec, genetics and old saves.
- [x] Six original 3D destinations, bundled renders, reduced-motion-aware movement.
- [x] Seven original sound effects, real Settings switch and committed-week feedback.
- [x] Browser phone/tablet inspection, creator modes, portrait save/reload, Bank and week feedback.
- [x] Production iOS export: 4,051 modules, 13.7 MB Hermes bundle, exit 0.
- [x] Full-suite evidence and focused follow-up (16 suites / 141 tests) recorded; draft PR #229 opened.
- [x] Complete local preflight exits 0; GitHub preflight/quality green on code `fe47c98f`.
- [x] Final-head CI on `1a95a49b`: 821 suites / 10,011 tests / 308 snapshots; coverage, preflight and quality pass.
- [ ] Complete remaining product polish and native acceptance: [prioritized next work](visual-ux-remaining-2026-09-26.md).
- [ ] Exact signed native build acceptance: audio/silent switch/interruption,
  VoiceOver/Larger Text, compact iPhone/iPad, purchases/restore/ads, old saves and
  background/kill/relaunch. No paid build, OTA or submission authorized here.

Prior local work remains in named stash `pre-sync-local-work-2026-09-26`.
Do not pop it into the presentation branch. Schema remains 51; HUD structure,
canonical weekly/save/purchase owners and production release state are unchanged.

## Purchases lost on reload (YouVideo, App Store 1.2.5 CA) — 25 September 2026

Branch `claude/intelligent-davinci-386ee7`. `saveGame()` read `gameStateRef`,
which a post-commit effect refreshes, so `setGameState(...); saveGame()`
persisted the PRE-action state; "Switch save slot" then suspends autosave and
a reload drops the purchase.

- [x] Failing provider-level test: action + `saveGame()` in one handler → persisted payload and a reloaded slot contain the action (on `main`: `microphone: false` on disk).
- [x] Fix in `saveGame`: wait for the commit that carries every update dispatched before the call, then read. No per-call-site patches, no save-format change.
- [x] Keep R3-S1 and the slot pairing safe (a load committing inside that wait must not be written into the previous slot). Mutation-checked: guard off → slot 1 overwritten.
- [x] Save + integration (53 suites / 587), stress + startup (55 / 908), full suite on the merged tree (816 / 817; the red one is the wall-clock tick benchmark, also red on `main` on this Windows machine, A/B shows no cost). Type-checks 0. Lessons entry written.
- [x] `npm run preflight`: `main` was at 703 lint warnings against a 701 ceiling (two new `require()`s in `lib/review/__tests__/inAppReview.test.ts`, from #220). Fixed with the repo's line-level disable convention rather than raising the ceiling.
- [ ] PR with the save-system risk box; watch CI's tick-timing number against `main`'s 3.98 ms/tick.
- [x] Follow-up implemented on PR #229: Settings saves durably before suspending for the slot picker. Provider regression and real browser computer-purchase/switch/reload verified.
- [ ] Follow-up (not this PR): drop the now-redundant `setTimeout(0)` / 200 ms pre-save yields (home, work, DeathPopup, Discord grant, restoreFromCloud, resolveEvent).

## Home freeze + four-lens audit — 25 September 2026

Branch `claude/great-davinci-cr2nh8`. Report: [home-freeze-and-audits](home-freeze-and-audits-2026-09-25.md).

- [x] Reproduce the Home freeze statically and dynamically (no render loop; Modal handoff identified).
- [x] Interruption queue: handoff settle gap, no preemption of a presented Modal, orb sheet holds the slot, popup close fallbacks.
- [x] Gameplay: hidden gamble outcomes, lost karma, first-job tenure, friend-only social events, wedding gate.
- [x] UX: HUD quick actions, market toasts, recap count, coach anchor/copy, save-slot weeks.
- [x] Perf/stability: root layout + ticker narrow subscriptions; repairs on clones.
- [ ] Verify the freeze fix on an iOS device (welcome back → daily reward on a new day).
- [x] Android save budget raised (64 MB), subscription lookup fixed, exams per life, store metadata 1.6.0 + data safety, version 2.15.0.
- [ ] Run `tasks/release/MASTER-PROMPT-growth-revenue-local.md` in a local session with Claude in Chrome: ship 2.15.0, launch Android, grow revenue.

## Banner impression measurement — 24 September 2026

- [x] Reproduce missing RevenueCat display events from banner paid callbacks.
- [x] Report display/revenue with the same impression ID, preserving refresh uniqueness and failure isolation.
- [ ] Inspect final-head CI and verify delivery on the exact signed iOS candidate; existing native gates remain open.

Evidence: [banner measurement](release/evidence/banner-impression-measurement-2026-09-24.md). No ad frequency, pricing or consent changes; no deployment.

## Owner review pass - 18 September 2026

Branch `codex/restore-precompact-hud` (built on `1e766685`, v2.13.0, schema 51),
not pushed. Owner-directed fixes plus MP08/MP09:

- Restored the pre-compact two-column HUD (`TopStatsBar` from `421e2008`),
  removing the compact disclosure layout the owner rejected.
- Replaced the flat HUD discs with a shared `LiquidGlassDisc` material (body +
  accent bloom + faint sheen), removing the season disc's 1px white border that
  anti-aliased into rim crescents. Kept gradient-free to hold the UI ratchet.
- Added a left-edge `RemoveAdsOrb` that deep-links to the shop's No Ads
  purchase; gated off when ads are removed or IAP is disabled.
- Work job cards now name their toll (`Happiness -3` / `Health -2`).
- MP08: wallet forecast excludes crypto-paid mining power, labels projected rent
  as an occupancy estimate, and settles standing arrears; property/loan sheets
  show upfront cash deltas (education already did).
- MP09: the recap's promotion badge opens Work.
- Weekly audit burned down to fully clean: typed the `WeekContext` test fixture,
  deleted three dead modules, and removed all 54 `as GameState` test casts
  (factory / named sub-types / one DELIBERATE-CORRUPTION marker).
- MP11: three connected story arcs (work pressure, family plans, side project),
  each a setup + two responses + a weight-0 delayed-consequence sequel, via the
  declarative `followUpEventId` API.
- MP12: bond support now scales by band (close 1, trusted 2, confidant 95+ 3)
  with the +3 ceiling unchanged, so depth beats headcount at the top of the
  ladder instead of only at the bottom.
- MP13: three non-wealth life capstones (family, career, community) recognise a
  completed path at death and pay legacy points into the next life, named on the
  death screen. Existing currency, no new save field.

Verification: source + test type-checks clean, eslint 0 errors, lint ratchet OK,
UI ratchet at ceilings, route check OK, weekly audit fully clean. Full suite
804 suites / 9881 tests / 308 snapshots green. PR #215 open with all checks
(`update`, `quality`, CodeRabbit) passing; not merged.

Next: no in-repo defects outstanding from the review; remaining work is product
(MP10-MP13) and the external release gates R04/R06/R07/R08/R09/R10.

## TestFlight lint repair - 12 September 2026

Run 34655502072 failed on seven missing asset-tool imports, not the 700 warnings.
Install the asset project's locked dependencies before lint in all four affected
build workflows, matching EAS Update/preflight. YAML/order checks pass; local
lint and latest PR results are recorded in the repair PR. A fresh build run must
use the corrected workflow revision; no native build is verified by this repair.
Evidence: [TestFlight tooling](release/evidence/testflight-tooling-2026-09-12.md).

## Discord player notes - 12 September 2026

Replace linked PR titles with authored, playful player notes from the PR's
`Player update notes` section. Skip technical-only merges; keep upcoming versus
live wording honest. Strip GitHub links from release copy too. Offline tests and
lint results are in the PR; no Discord messages sent or edited.
Evidence: [player notes](release/evidence/discord-player-notes-2026-09-12.md).

## Five-point follow-up — 11 September 2026

- [x] Investigate repair signals and synthetic old-save continuity; no repeated repair reproduced. Historical player cause remains unknown; diagnostic denominator added.
- [x] Correct screen/week tracking and label purchase-flow quotes without inventing revenue. Signed-build revenue reconciliation remains open.
- [x] Improve the existing return journey with a concrete goal and next action.
- [x] Explain active premium benefits truthfully, including trial limitations.
- [x] Decompose the matched-week Apple download decline by Search/Browse before store edits.
- [ ] Verify focused regressions, UI evidence, full relevant gates and latest PR checks.

Baseline: origin/main 67528146, no open PRs. Work branch:
codex/retention-measurement-followup. No store edits, production publish or paid build.
Evidence: [five-point follow-up](release/evidence/five-point-followup-2026-09-11.md).
Next external acceptance: rebuilt signed candidate for screen telemetry, consent,
purchase/restore, real old saves and native accessibility. No measured retention
or trial-conversion uplift is claimed yet.

## Provider statistics audit — 11 September 2026

Read-only Firebase/GA4, RevenueCat and App Store Connect review completed for
acquisition, trial outcomes, measured retention, monetization and reliability
signals. Private dated evidence is stored outside this public repository at
`../DeepLife-statistikaudit-2026-09-11.md`; do not publish its business metrics.
PR #211 is merged; main watcher checkpoints now persist; no open PRs at review.
Next: segment save-repair signals by app/save version and reproduce old-save
hydration before making a fix. Then reconcile screen/week/purchase measurement
with consent and transaction deduplication preserved. Native performance,
provider billing/AdMob reconciliation and signed-device release acceptance
remain unverified. No runtime or provider configuration changes in this audit.

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

## Android growth — free levers (2026-09-25)

Measured first: production v2.13.0, 57 installs, 14 listing visitors / 28 days
at **93 % conversion** — the bottleneck is traffic, not the listing.

- [x] Halloween Live Ops event for ALL stages (`support-site/liveops.json`, Oct 16 → Nov 6, 250 gems); verified the 2.13.0 validator/objectives accept it; calendar + liveops suites green.
- [x] Play promotional-content art (1920×1080 + 1080×1080, no text) + field-by-field guide (`marketing/play-store/promo-events/`).
- [x] Play Console event SUBMITTED 2026-09-25 on the owner's explicit go-ahead (id 4832155368004637099, Oct 16 → Nov 6, 176 countries, AI declaration: not labelled - owner's call).
- [x] Share loop: every share now ends in one cross-platform link (`SHARE_LANDING_URL` → `support-site/get/`); Android shares used to send readers to the App Store, and the life-story share carried no link. Pinned by `__tests__/social/shareLinks.test.ts`.
- [x] Support site: Google Play badges, stale "closed beta" copy fixed, absolute OG image.
- [ ] Owner: merge #219 before Oct 16, ship 2.15.0 (carries the share fix), submit the holiday event Oct 19 - Dec 4.
- [x] All-stage December event `winter_holidays_home` (Dec 18 → Jan 4, 200 gems; late-stage budget 850/900) + winter art + guide. Owner submits the Play event between Oct 19 and Dec 4.
- [x] Skipped a "Major update" Play event for 2.15.0: it is fixes only, and Play rejects routine updates.
- [x] Reddit posts filled with per-subreddit tracked links.
