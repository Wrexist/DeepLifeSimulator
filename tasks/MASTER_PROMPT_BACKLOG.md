# Deep Life Simulator: current status and master-prompt backlog

Prepared 9 September 2026 for Wrexist/DeepLifeSimulator.

## Recommendation

Finish the existing release candidate before starting another broad feature program. Preserve the accepted compact Home and revised game-themed screenshots. After the release gates, finish the accurate post-bills cash forecast, then improve weekly consequences, relationship choices and different life paths.

This is a repository-grounded planning audit. It reconciles current source, recent merged PRs, the open release branch, historical plans and explicit TODO markers. It is not a new native playtest or a claim that every possible defect has been discovered. The main backlog below is deduplicated; the appendix preserves every unchecked Markdown checkbox found in the tracked main tree so older items are not silently lost.

## Exact snapshot and evidence boundaries

| Item | Observed status |
|---|---|
| Main | `811cfc2cec03f9cae1f0b0bb4e55298dcadf06c5` |
| Open release PR | [#203](https://github.com/Wrexist/DeepLifeSimulator/pull/203), head `4b1aa7be9e2464c1db06515ffd2ab789205174ad` at inspection |
| Open standalone issues | GitHub search returned none |
| Main package version | `2.13.0` |
| Save schema | `51` |
| Store metadata source | `marketing/aso/metadata.mjs` still targets `1.5.0`; this is not the binary version |
| Live store / next draft | Earlier release audit observed public `1.5.5`; not independently reverified here. Current ASC draft and processed TestFlight candidate remain unverified |
| Main CI | EAS Update [34330359739](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/34330359739) succeeded on the inspected main SHA |
| PR #203 CI at inspection | Preflight [34334058367](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/34334058367) succeeded; EAS Update [34334057981](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/34334057981) was in progress |
| Fresh local checks in this audit | `check:routes`, `check:aso`, `check:content`, `check:liveops` passed on main |
| Full suite | Not rerun in this planning audit. PR #203 records 782 suites / 9,782 tests / 308 snapshots with clean exit on earlier identified implementation commits; this must not be relabeled as a fresh latest-head result |
| App review | Reviewed source and prior journey evidence; no new interactive app, physical-device, StoreKit or visual acceptance performed |

The checkout was sparse to omit large binary asset directories. The inventory uses the tracked Git tree and reads tracked Markdown directly, including Markdown outside the sparse checkout. Source inspection covered the route structure, current UI/forecast code, save/research differences, monetization recovery, policy TODOs, roadmap reconciliation and release workflows. It was not a line-by-line certification of all gameplay code.

Fresh route check: 17 routes, no conflicts. ASO lengths pass but length validation does not establish correct release identity or optimal keywords. Content checks pass with two low-stakes multi-choice events. Combined live-ops calendar has 7-day quiet stretches for new/early stages and 14-day stretches later; the separate compiled/remote calendars have longer gaps. These are content observations, not automatically release blockers.

An initial direct route-script call used an incorrect filename. The canonical `npm run check:routes` then passed. A supplemental workflow-history read failed to parse its tool response, so this audit makes no new native-build-history claim. No application files were changed, no merge/build/submission was dispatched and no app-store record was modified.

## Status vocabulary

- **Merged:** the relevant work is on main. Native behavior may still need acceptance.
- **Implemented on #203:** source exists on the open branch, with recorded tests. It is not yet on main.
- **Required verification:** a specific gate remains without sufficient current evidence.
- **Confirmed remaining contract:** current code/report identifies unfinished behavior; implement after reproducing the exact case.
- **Proposal / revalidate:** a product idea or historical suspicion. Do not call it a current bug or implement it automatically.
- **Superseded:** an older task is replaced by later implementation or evidence.

## What is already done

| Work | Current disposition | Evidence / remaining limit |
|---|---|---|
| Program 18 roadmap | Merged #196 | It is a plan; merging it did not implement all phases or confirm all 50 hypotheses |
| Purchase save-result handling, transaction identity, checkpoint preservation | Merged #197 | IAP service and Program 18 reports; real native failure/recovery matrix still required |
| Same-install, slot/life/customer-bound non-subscription recovery | Merged #197 | `services/IAPService.ts`, continuity report; does not establish reinstall/cross-device consumable recovery or subscription bonus recovery |
| Legacy malformed migration arrays | Merged #197 | v11/v13/v14 repair work; historical null-loop TODO is stale |
| Police fines preserve unpaid liability | Merged #197 | Audit report and money/stress regressions |
| Repeated journal occurrence identity | Merged #197 | `lib/lifeMoments/journalWriter.ts`; identical same-week ID/title/message still need a producer identity if distinct occurrences are intended |
| Live-event claim and reward-budget continuity across generations | Merged #197 | Shared dynasty transition; historical carry-or-reset decision is resolved for this path |
| Education quote and duplicate-enrollment guards | Merged #199 | Real loan terms, total repayment, duration and immediate obligations; deferment is not implemented by this change |
| Loan cash-flow math, pension, stale selector inputs and APR display | Merged #199 | `lib/banking/loanPayment.ts`, `components/IdentityCard.tsx`; full spendable-cash forecast remains incomplete |
| Compact HUD and single coaching/goal surface | Merged #201 | Pending application vs accepted job, actual first wage, less duplicate guidance; native accessibility still needs acceptance |
| Reusable 3D assets and weekly recap presentation | Merged #200 | Asset pack preserved; HomeScene deliberately NOT mounted on Home |
| Revised game-themed store screenshots | Merged #204, superseding #202/#198 direction | Ten stories × three device sizes. Seeded web gameplay sources still require native candidate parity |
| Creator levels/memberships, company overlays, real pet tick, bank interest counters, education semesters/exams | Existing implementation | Preserve these; Program 18's historical statements that they are absent are explicitly retracted in its audit |
| Tier-1 meeting people, annual-to-weekly partner income correction | Existing merged social work | Do not rebuild from the old tier-2-only social roadmap |
| Life-salted event selection and deterministic simulation guards | Existing merged Programs 13/14 | Keep the guards; old unsalted-event TODO is superseded |
| Luxury phases 1–5 | Documented delivered with source paths | Island property, aircraft/basing, item state, yield/appreciation, activities and hosting exist. The remaining memory/prestige/event proposals are separate |
| Stalled save watchdog protection | Implemented on #203 | Main still releases ownership while old I/O can resume; branch retains ownership. Reviewed actual diff and recorded regression |
| Research moved to real played-week transition with deterministic completion | Implemented on #203 | Main still observes provider week changes, which can also occur on slot loading. Reviewed actual source difference |
| Reject incomplete/unreached release evidence | Implemented on #203 | Validator and workflow tests; this fixes the gate, not the unexercised journeys |
| Owned async-resource cleanup | Implemented on #203 | R05 records clean-exit suite/soaks. Do not restart this as an unresolved main-independent mystery |
| Privacy/support source corrections and screenshot-tool lockfile | Implemented on #203 | Publication, operational facts and native/store parity are still separate gates |

## Execution order

1. **MP00:** refresh/reconcile the open candidate and latest evidence. Do not duplicate #203's implementation.
2. **MP01–MP03:** privacy facts, actual player journeys and exact signed candidate. Independent preparation can proceed when another gate is blocked.
3. **MP04–MP06:** native purchases, device/accessibility acceptance and store/screenshot reconciliation.
4. **MP07:** final submission packet only after the prerequisites pass.
5. **MP08–MP13:** accurate forecast, causal recap, path discovery, connected stories, deliberate relationships and non-wealth endings.
6. Select the remaining product/maintenance proposals by measured player impact. Android release is a separate track, not an automatic expansion of the next iOS release.

Seven release packages already exist on #203: R11, R04, R08, R06, R09, R07, R10. Reuse those IDs and briefs. MP00 is a reconciliation step, not an eighth newly invented release blocker. The product packages below are a selection backlog, not a requirement to finish all of them before shipping.

## Master-prompt package index

| Package | Work | Status | Priority |
|---|---|---|---|
| MP00 | Reconcile the current candidate and stale task ledger | Required coordination | First |
| MP01 / R11 | Privacy, support and operating facts | Required verification | Release |
| MP02 / R04 | Playable journeys and visible clarity | Required verification | Release |
| MP03 / R08 | Exact production candidate and TestFlight identity | Required verification | Release |
| MP04 / R06 | Native purchase, restore and recovery matrix | Required verification | Release |
| MP05 / R09 | iPhone/iPad lifecycle, accessibility, ads and performance | Required verification | Release |
| MP06 / R07 | Store identity, release notes, screenshot parity and locales | Required verification | Release |
| MP07 / R10 | Submission packet and bounded release decision | Required verification | Release |
| MP08 | Finish a truthful post-bills cash forecast | Confirmed remaining contract | Next product/correctness |
| MP09 | Weekly recap with causes and useful next actions | Partially implemented; product extension | High product |
| MP10 | Path-specific onboarding and feature discovery | Proposal | High product |
| MP11 | Three connected cross-system story arcs | Proposal | High product |
| MP12 | Relationship priorities, shared plans and meaningful bonds | Confirmed design issue; proposed solution | High product |
| MP13 | Family, career and community endings beyond wealth | Proposal | High product |
| MP14 | Happiness variation without damaging early survival | Measured historical design issue; rebaseline | Product experiment |
| MP15 | Reward cadence, chapter claims and ad-orb tradeoffs | Owner/product decisions; verify current behavior | Product experiment |
| MP16 | Education affordability and repayment alternatives | Partially complete; optional balance extension | Product experiment |
| MP17 | Political standing and policy consequences | Confirmed TODO / product extension | Later product |
| MP18 | Live-ops fallback and event-delivery observability | Historical technical leads; revalidate | Later reliability/product |
| MP19 | Subscription bonus and cross-install recovery policy | Known boundary; solution requires design | Trust follow-up |
| MP20 | Native analytics, support visibility and value measurement | Implementation exists; operational verification missing | High follow-up |
| MP21 | Cloud backup and account recovery rollout | Proposal / preview-gated system | Later platform |
| MP22 | Bank and portfolio clarity | Historical backlog; inspect current reachability | Later product |
| MP23 | Mining ownership costs and maintenance discovery | Historical backlog; revalidate | Later product |
| MP24 | Creator and company consequence chains | Existing engines; proposed depth | Later product |
| MP25 | Housing, vehicles, travel, pets and luxury finishing pass | Existing systems; selective proposals | Later product |
| MP26 | Crime, health and recovery consequences | Proposal / explicit source TODOs | Later product |
| MP27 | CI coverage and relevant change gates | Source-confirmed configuration gap | Maintenance |
| MP28 | Measured performance and incremental architecture cleanup | Risk inventory; profile first | Maintenance |
| MP29 | Legacy source TODO cleanup | Explicit source markers; mostly optional | Maintenance |
| MP30 | Localization and cultural consistency | Proposal; store slice partly required | Later product |
| MP31 | Shareable life stories and challenge seeds | Proposal | Later growth |
| MP32 | Marketing and Apple Ads follow-up | Historical campaign tasks; fresh data required | Separate growth |
| MP33 | Android production-readiness track | External state unverified; separate platform | Separate release |
| MP34 | Navigation consolidation decisions | Proposals explicitly not implemented | Optional product decision |

## Detailed briefs ready for master prompts

Each brief defines a bounded starting point. For a multi-domain package, audit the listed domains first, then split the first justified implementation into one small prompt. Do not treat a proposal's acceptance criteria as evidence that it is currently broken.

### MP00: Reconcile the current candidate and stale task ledger

**Status:** Required coordination. **Priority:** First.

**Dependencies:** None.

**Read first:** tasks/todo.md; tasks/release/queue.json on #203; .github/workflows/eas-update.yml; PRs #197/#199/#200/#201/#203/#204. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Refresh main and open PRs, pin SHAs and latest checks, map stale boxes to actual merged changes, and preserve the existing release queue. Determine which tests remain valid for the selected candidate. Prepare any ledger-only correction on a review branch. A main merge can publish production OTA and support changes can deploy Pages, so record those effects in the concrete integration plan.

**Acceptance criteria:** Every active item has one status, source and next action. #203 fixes are not reported as merged. No native/build/store status is inferred from version strings or old CI. Latest-head CI is inspected before integration.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP01 / R11: Privacy, support and operating facts

**Status:** Required verification. **Priority:** Release.

**Dependencies:** MP00.

**Read first:** tasks/release/R11.md; support-site/privacy.html; support-site/support.html; eas.json; lib/config/featureFlags.ts. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Compare enabled production providers, actual consent/data behavior and operator/retention/support facts. Reuse the existing disclosure patch. Reconcile current ASC answers and review/publish corrected support/privacy when authorized. Confirm priority-support promises against the real support process.

**Acceptance criteria:** Live pages, candidate behavior and actual store answers agree. Contact and recovery instructions are truthful. Record deployment ref, visual review and verified provider facts. Source-only corrections do not close this gate.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP02 / R04: Playable journeys and visible clarity

**Status:** Required verification. **Priority:** Release.

**Dependencies:** MP00; R02/R03 implementation available.

**Read first:** tasks/release/R04.md; app/(onboarding)/; app/(tabs)/; components/GoalsCard.tsx; components/IdentityCard.tsx. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Exercise new life → first action → application → first wage; tuition; company/research; relationships; low-cash recovery; death/revival/heir; back/navigation/modal exits. Sample the existing creator, investment, travel, vehicle, pet, health, crime and politics surfaces. Preserve compact Home. Fix only reached defects.

**Acceptance criteria:** Record reached steps, source/build, screenshots and results at phone/tablet sizes. Distinguish source-present from interactively exercised. No dead tap, unreachable required exit or contradictory money/research outcome in the required cases. Unreached cases remain open.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP03 / R08: Exact production candidate and TestFlight identity

**Status:** Required verification. **Priority:** Release.

**Dependencies:** MP00; R03/R05 accepted.

**Read first:** tasks/release/R08.md; docs/RELEASE_RUNBOOK.md; .github/workflows/eas-build-local-ios.yml; app.config.js; package.json. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Read current ASC/EAS state, choose the next permitted binary/store records, run production-environment gates and prepare a signed candidate under current authorization. Verify processing, rather than stopping when upload starts. Account for native dependencies and OTA compatibility.

**Acceptance criteria:** Commit, binary version/build number, store version, environment, build run and processed TestFlight record are explicitly linked. Applicable preflight/export/CI pass. Never guess the next version from historical 2.13.0 instructions.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP04 / R06: Native purchase, restore and recovery matrix

**Status:** Required verification. **Priority:** Release.

**Dependencies:** MP03; R01/R05 accepted.

**Read first:** tasks/release/R06.md; services/IAPService.ts; services/RevenueCatService.ts; tasks/program-18-continuity-and-recovery-2026-09-08.md. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Test catalog/prices, gems, permanent and mixed packs, Revival Pack, subscriptions, cancellation, renewal/expiry states, double taps, failed saves, kill/relaunch, wrong slot/life, retry and Restore. Test reinstall behavior without treating historical consumables as refundable inventory. Explicitly investigate subscription-specific local bonuses after lost callbacks.

**Acceptance criteria:** One authorized durable benefit per transaction, no replay grant, ambiguous outcomes remain recoverable/pending, wrong life receives nothing, paid access follows verified authority. Store/SDK evidence and truthful limitations recorded. Any actual lost paid benefit is triaged before release.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP05 / R09: iPhone/iPad lifecycle, accessibility, ads and performance

**Status:** Required verification. **Priority:** Release.

**Dependencies:** MP03.

**Read first:** tasks/release/R09.md; components/BaseModal.tsx; app/_layout.tsx; utils/saveQueue.ts; services/AdMobService.ts; docs/reviews/. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Run fresh/update install, save migration, background/foreground, offline, low storage and kill/relaunch. Exercise nested cancellation/death/wedding sheets, reward/no-fill/denied-consent ad paths, avatar rendering, VoiceOver focus, largest text and Reduce Motion. Measure representative early/late saves on actual hardware.

**Acceptance criteria:** Device/OS/build evidence covers the named matrix. No save loss, blocked critical navigation or inaccessible primary action. Confirm the historically small targets using actual hit regions. Report measured timing rather than assigning an invented performance target.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP06 / R07: Store identity, release notes, screenshot parity and locales

**Status:** Required verification. **Priority:** Release.

**Dependencies:** MP01; MP02; MP03.

**Read first:** tasks/release/R07.md; marketing/aso/metadata.mjs; WHATS_NEW.md; screenshots/player-stories-2026-09/; SCREENSHOT_GUIDE.md. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Replace stale release-target metadata only after reading current ASC. Trim factual release notes, reconcile all supported locales, verify benefit claims and links, and compare every screenshot story against the native candidate. Preserve #204 theme unless a specific error requires correction.

**Acceptance criteria:** All ten stories match reachable native behavior; exact upload dimensions/format/order checked; store draft and selected binary match the intended release. Localized fields and subscription claims are accurate. An image export pass alone is not upload readiness.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP07 / R10: Submission packet and bounded release decision

**Status:** Required verification. **Priority:** Release.

**Dependencies:** MP04; MP05; MP06; all required release gates.

**Read first:** tasks/release/R10.md; tasks/release/queue.json; docs/RELEASE_RUNBOOK.md. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Assemble current build identity, review notes, product access/review information, privacy/content answers, support/rollback plan and rollout decision. Recheck no known in-scope blocker remains. Prepare the exact authorized submission action.

**Acceptance criteria:** A reviewer can reproduce the candidate and inspect all gates. Ready-to-submit, submitted, Apple-approved and published remain separate states. Stop expanding feature scope once the agreed gates pass.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP08: Finish a truthful post-bills cash forecast

**Status:** Confirmed remaining contract. **Priority:** Next product/correctness.

**Dependencies:** Release trust gates; #199 preserved.

**Read first:** components/IdentityCard.tsx; lib/banking/loanPayment.ts; contexts/game/actions/weekly/applyIncome.ts; tasks/program-18-cashflow-correctness-2026-09-08.md. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Trace authoritative tenant/rental income and tax exactly once, exclude jailed company cash where the tick does, distinguish mining costs paid in crypto from wallet debits, represent old arrears and variable-income uncertainty. Then preview the upfront and next-week effects of tuition, housing and ordinary loans.

**Acceptance criteria:** Controlled forecast-vs-real-tick scenarios agree within explicit uncertainty. Cash, assets, tax, arrears and noncash costs are distinguished. Preserve existing payoff/interest rules. Do not make the current estimate a hard affordability gate before parity is proven.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP09: Weekly recap with causes and useful next actions

**Status:** Partially implemented; product extension. **Priority:** High product.

**Dependencies:** MP08 where money forecasts are used.

**Read first:** Existing weekly recap components; app/(tabs)/home.tsx; contexts/game/actions/weekly/; lib/lifeMoments/. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Build on #200 recap styling and existing outcome data. Select a small number of meaningful changes, explain their actual causes and link to available actions. Preserve interruption budget and compact first viewport.

**Acceptance criteria:** A tester can explain why money/stats/relationships changed and find an appropriate action. No invented causal text or duplicated simulation formulas. Empty/quiet/crisis weeks read correctly and reduced motion remains supported.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP10: Path-specific onboarding and feature discovery

**Status:** Proposal. **Priority:** High product.

**Dependencies:** MP02; release complete.

**Read first:** tasks/program-18-audit-and-implementation-2026-09-07.md; src/features/onboarding/; lib/goals/; app/(tabs)/. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Measure a story/family, career, creator and economy opening. Preserve existing first-job guidance, then test limited path-aware previews/unlocks or goal choices. Avoid exposing every system at once.

**Acceptance criteria:** Each selected opening reaches one meaningful path action and consequence. New/confused and text-skipping players remain viable. Record time/steps and actual reach before claiming better retention.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP11: Three connected cross-system story arcs

**Status:** Proposal. **Priority:** High product.

**Dependencies:** MP02; release complete; MP09 useful.

**Read first:** lib/events/; lib/lifeMoments/; lib/social/; tasks/master-prompt-program-18-roadmap-2026-09-07.md. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Choose three bounded arcs connecting existing systems, such as study/work pressure, partner/family plans and a business/creator opportunity. Reuse existing journal, NPC and event structures. Give each setup, two viable responses, delayed consequence and remembered aftermath.

**Acceptance criteria:** Each arc is reachable, life-salted, replay-stable and bounded. Choices change a later state or opportunity. Save/load and interruption-budget tests pass; no new story database or global event spam.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP12: Relationship priorities, shared plans and meaningful bonds

**Status:** Confirmed design issue; proposed solution. **Priority:** High product.

**Dependencies:** Release complete; social/survival baseline.

**Read first:** lib/social/closeness.ts; lib/social/npcDepth.ts; contexts/game/actions/SocialActions.ts; tasks/social-systems-2026-09-03.md; tasks/relationship-depth-2026-09-03.md. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Measure free-call repetition, Spark promotion cost/caps and support-event reach. Prototype a small weekly priority/shared-plan system. Resolve named-relationship life moments, networking-person payoff and estrangement end states as separate slices.

**Acceptance criteria:** Deep relationships require meaningful choices rather than repetitive maintenance. Poor/new lives remain viable. No infinite money or bond farming; real NPC identity, recency and consequences persist. Do not remove the delivered tier-1 meet-people path.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP13: Family, career and community endings beyond wealth

**Status:** Proposal. **Priority:** High product.

**Dependencies:** Release complete; MP11.

**Read first:** lib/prestige/; lib/retirement/; lib/goals/; family/career actions; Program 18 audit. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Design worthwhile capstones for non-tycoon lives. Extend existing heir/retirement/legacy systems with recognition and bounded obligations or unfinished goals. Keep death-to-heir distinct from voluntary wealth prestige.

**Acceptance criteria:** At least one non-wealth path has a meaningful completion and next-life consequence. Existing gems, purchases, claims and saves survive. Do not silently lower prestige thresholds or make every ending require money.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP14: Happiness variation without damaging early survival

**Status:** Measured historical design issue; rebaseline. **Priority:** Product experiment.

**Dependencies:** Release complete; MP12 baseline.

**Read first:** lib/economy/happinessGain.ts; lib/economy/statDecay.ts; __tests__/simulation/; tasks/relationship-depth-2026-09-03.md. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Measure ceiling time and flatness separately across real spending/social/career lives. Prototype situation/need/consequence changes before touching global decay. Include ad-orb contributions. Prior stronger decay harmed fresh lives and merely moved a flat equilibrium.

**Acceptance criteria:** Early-game survival gates pass and meaningful variation improves over multiple lives. Report distributions and recoverability. Reject changes that only lower the cap or move the equilibrium without improving choices.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP15: Reward cadence, chapter claims and ad-orb tradeoffs

**Status:** Owner/product decisions; verify current behavior. **Priority:** Product experiment.

**Dependencies:** Release complete; native ads accepted.

**Read first:** lib/progress/lifeChapters.ts; lib/liveops/; ad-orb actions; tasks/todo.md. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Measure chapter-2 bundle scaling, per-life chapter gems, play-streak tick counting and the full-stat ad reward. Choose explicit cadence/lineage rules from actual economy effects. Keep already-implemented live-event claim continuity.

**Acceptance criteria:** Sources/sinks/caps/cadence are documented; repeated taps, clock movement, relaunch and life transitions cannot bypass the chosen contract. No reward reduction based solely on a historical TODO.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP16: Education affordability and repayment alternatives

**Status:** Partially complete; optional balance extension. **Priority:** Product experiment.

**Dependencies:** MP08.

**Read first:** contexts/game/actions/EducationActions.ts; contexts/game/actions/weekly/applyEducationProgression.ts; tasks/program-18-education-costs-2026-09-08.md. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Preserve semesters/exams/study groups and the new quote. Evaluate deferment or income-linked repayment through student personas, including withdrawal and graduation. Connect qualification payoff to real job eligibility.

**Acceptance criteria:** Current terms stay transparent. Any new repayment model is simulated through graduation/withdrawal, includes migration/repair if persisted, and cannot duplicate debt, tuition or aid.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP17: Political standing and policy consequences

**Status:** Confirmed TODO / product extension. **Priority:** Later product.

**Dependencies:** Release complete; political baseline.

**Read first:** contexts/game/actions/PoliticalActions.ts; lib/politics/policies.ts; tasks/todo.md. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Reproduce standing drift and limited policy replenishment. Make favored categories discoverable and evaluate repeatable legitimate standing recovery. Decide whether policy effects should stay one-time or become a bounded recurring system.

**Acceptance criteria:** Players can understand endorsement/standing and recover through intended play. Preserve fixed office-exit/re-election/PAC behavior. Recurring payouts are not added merely because two comments say TODO; they require a tested economic contract.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP18: Live-ops fallback and event-delivery observability

**Status:** Historical technical leads; revalidate. **Priority:** Later reliability/product.

**Dependencies:** Release complete; MP15 for reward-policy changes.

**Read first:** lib/liveops/; scripts/check-liveops-calendar.cjs; __tests__/simulation/eventTelemetry.sim.test.ts; tasks/event-delivery-2026-09-04.md. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Reproduce cached disable-only payload behavior and timezone parsing before fixing. Document immutable instance-start semantics. Assess offline compiled runway and distinguish arc adjacency from unrelated interruption. Test a pity floor only if measured dry lives justify it.

**Acceptance criteria:** Disable/fallback/date contracts are explicit and tested; no duplicate rewards after event corrections. Delivery metrics separate eligibility, competition, selection and arc completion. Avoid manufacturing calendar entries just to silence advisories.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP19: Subscription bonus and cross-install recovery policy

**Status:** Known boundary; solution requires design. **Priority:** Trust follow-up.

**Dependencies:** MP04; actual provider evidence.

**Read first:** services/IAPService.ts; tasks/program-18-continuity-and-recovery-2026-09-08.md; docs/CLOUD-SAVE-BACKEND.md. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Separate entitlement restoration, subscription-local welcome bonuses and consumable quantity recovery. Define identity, redemption and support reconciliation requirements. If MP04 demonstrates a lost paid benefit on a supported path, promote that fix to the release gate. Broader cross-device consumable recovery is a separate backend decision.

**Acceptance criteria:** No historical receipt can mint consumed quantities. Identity/install/slot/life ownership and idempotency are explicit. Supported failures have a truthful recovery path. Backend scope/cost is justified before implementation.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP20: Native analytics, support visibility and value measurement

**Status:** Implementation exists; operational verification missing. **Priority:** High follow-up.

**Dependencies:** MP01; release candidate.

**Read first:** docs/ANALYTICS.md; docs/RETENTION-ANALYTICS.md; lib/analytics/; services/; eas.json. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Verify real events arrive for activation, week completion, purchase failure/recovery and retained play. Determine available native crash reports and support triage. Measure membership vs gem-pack roles using actual store prices and outcomes. Keep the unconfigured HTTP sink disabled.

**Acceptance criteria:** A small scorecard answers concrete product/support questions with verified data. No sensitive player narrative payloads or speculative new SDK. Pricing changes require evidence, not comparison of reference prices alone.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP21: Cloud backup and account recovery rollout

**Status:** Proposal / preview-gated system. **Priority:** Later platform.

**Dependencies:** MP19; operating-cost decision.

**Read first:** docs/CLOUD-SAVE-BACKEND.md; docs/SAVE-KEY-RECOVERY-RUNBOOK.md; server/cloud-save/; services/; components/settings/CloudTransferModal.tsx. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Audit existing preview transfer/backup before expansion. Define recoverable identity, install/slot ownership, conflicts, encryption/signing compatibility, deletion and support. Separate save restore from purchase fulfillment.

**Acceptance criteria:** Cross-device conflicts and interrupted restores cannot overwrite newer progress or duplicate paid inventory. Recovery works for real supported users before production enablement. No unnecessary account backend just to close iOS release gates.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP22: Bank and portfolio clarity

**Status:** Historical backlog; inspect current reachability. **Priority:** Later product.

**Dependencies:** MP08.

**Read first:** components/mobile/BankApp.tsx; components/computer/AdvancedBankApp.tsx; lib/banking/; lib/stocks/; docs/APP_DEPTH_PLAN.md. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Unify absolute-week display consistently across six bank sites, then audit savings goals/transfers/budgets/card costs and portfolio movement explanations. Interest counters and sector/macroeconomic logic already exist. One-bank navigation is a proposal, not approved restructuring.

**Acceptance criteria:** Displayed dates share one baseline; transfers conserve money; real costs and simulated prices drive labels. Every additional control has a reachable payoff. Do not rebuild banking counters from stale plans.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP23: Mining ownership costs and maintenance discovery

**Status:** Historical backlog; revalidate. **Priority:** Later product.

**Dependencies:** MP08.

**Read first:** lib/crypto/; contexts/game/actions/MiningActions.ts; components/computer/; docs/APP_DEPTH_PLAN.md. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Inventory current repair, durability, energy, upgrades, pools, staking and automation controls against their tick readers. Surface the smallest useful missing action and show net yield with correct cash/crypto units.

**Acceptance criteria:** Buying/operating/repairing/selling has an explainable conserved flow. Existing income caps remain. Dead controls are removed or wired only after reproduction; no second mining engine.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP24: Creator and company consequence chains

**Status:** Existing engines; proposed depth. **Priority:** Later product.

**Dependencies:** MP11; MP20 useful.

**Read first:** CompanyActions.ts and weekly company modules; lib/social/; creator app components; docs/APP_DEPTH_PLAN.md. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Preserve working creator levels, memberships, live-stream tab continuity and new-company overlays. Audit paid Insights, follower history, staff effects and scandal reach. Choose a bounded staff/customer/sponsor consequence chain before board-governance expansion.

**Acceptance criteria:** A real player can reach each claimed paid/operational benefit. Audience/staff changes follow authoritative calculations, no duplicate revenue or uncapped reward. Mark unbuilt board/NPC-reaction systems as proposals until source-checked.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP25: Housing, vehicles, travel, pets and luxury finishing pass

**Status:** Existing systems; selective proposals. **Priority:** Later product.

**Dependencies:** Release complete; MP08.

**Read first:** lib/realEstate/; lib/vehicles/; lib/travel/; lib/pets/; lib/luxury/; docs/LUXURY_DEPTH_ROADMAP.md. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Audit an actual buy/use/upkeep/exit journey per domain. Prioritize ownership-cost clarity, destination aftermath, pet-care feedback, luxury purchase memories and invitations. Check collection prestige recognition against existing legacy logic. Preserve delivered island, aircraft, hosting and real pet engine.

**Acceptance criteria:** Only reproduced missing/contradictory paths become fixes. Each selected addition gives an understandable use or lasting consequence, preserves caps and survives load. Do not implement five domain rewrites as one prompt.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP26: Crime, health and recovery consequences

**Status:** Proposal / explicit source TODOs. **Priority:** Later product.

**Dependencies:** Release complete; MP11.

**Read first:** lib/events/personalCrises.ts; lib/darkweb/; health/crime actions; tasks/todo.md. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Audit medical emergency and legitimate exits from crime. Health insurance is currently absent and medical copy was made honest; treat insurance as a new feature decision. Before exposing dormant hacking actions, verify caught-roll attempt identity.

**Acceptance criteria:** No advertised insurance discount without a real system. Repeated hack attempts follow the chosen deterministic attempt contract. Costs, penalties and recovery remain playable and money-conserving.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP27: CI coverage and relevant change gates

**Status:** Source-confirmed configuration gap. **Priority:** Maintenance.

**Dependencies:** MP00; coordinate workflow changes.

**Read first:** .github/workflows/eas-update.yml; .github/workflows/preflight.yml; scripts/check-coverage.js; __tests__/helpers/. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Ensure relevant UI/content/live-ops ratchets run for changes that affect them; current Preflight path filters omit ordinary component-only PRs. Add an appropriate coverage gate/cadence since normal EAS Update runs Jest without coverage. Route historical unsafe test fixtures through the canonical factory when behavior is touched.

**Acceptance criteria:** Representative changed-path cases trigger intended gates. Coverage checks run at a stated cadence with unchanged floors. Do not impose every expensive soak on every docs edit or revive #203-cleaned async leaks without evidence.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP28: Measured performance and incremental architecture cleanup

**Status:** Risk inventory; profile first. **Priority:** Maintenance.

**Dependencies:** MP05 measurements.

**Read first:** contexts/game/GameActionsContext.tsx; contexts/game/useGameSelector.ts; contexts/game/types.ts; utils/saveValidation.ts. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Profile early/late Home, bank, creator and week/save paths. Replace only measured broad subscriptions or expensive loops. Extract bounded action domains while preserving tick order and public action contracts.

**Acceptance criteria:** Before/after same-device measurements show benefit; deterministic replay/save compatibility and targeted tests pass. No framework rewrite, broad state redesign or file-size-only refactor.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP29: Legacy source TODO cleanup

**Status:** Explicit source markers; mostly optional. **Priority:** Maintenance.

**Dependencies:** Release complete; save compatibility review.

**Read first:** contexts/game/types.ts; lib/progress/achievements.ts; lib/events/personalCrises.ts; lib/politics/policies.ts. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Inventory legacy state.social and deprecated achievement readers/callers before removal. Keep old-save compatibility. Classify BigInt/clamp logging suggestions as optional unless real numeric requirements justify them. Route policy and insurance proposals to MP17/MP26.

**Acceptance criteria:** Every literal TODO has a documented disposition. Removing a legacy field does not lose supported saved information. No BigInt migration or medical subsystem just to reach zero TODO comments.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP30: Localization and cultural consistency

**Status:** Proposal; store slice partly required. **Priority:** Later product.

**Dependencies:** MP06 for next-release locales.

**Read first:** marketing/app-store-localizations/; localization sources; lib/events/; docs/STORE_LISTING.md. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Separate store-language coverage from in-app translation coverage. Audit actual supported languages for money/time terminology, benefits, fallback and event coherence. Prioritize visible core strings before translating the entire corpus.

**Acceptance criteria:** Supported-language journeys are readable and claims match behavior; fallback strings are intentional. Native text expansion passes. Do not advertise full app localization from translated store metadata alone.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP31: Shareable life stories and challenge seeds

**Status:** Proposal. **Priority:** Later growth.

**Dependencies:** MP11; MP13.

**Read first:** lib/lifeMoments/; existing life-story and obituary components; marketing/viral-growth-plan-2026-08-09.md. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Prototype local opt-in story summaries or reproducible challenge seeds using existing history. Keep private free text out by default and avoid public social infrastructure.

**Acceptance criteria:** Export represents actual life history, lets users inspect what is shared, and handles long names/content. Seeds preserve documented determinism. Measure real sharing before adding network/community features.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP32: Marketing and Apple Ads follow-up

**Status:** Historical campaign tasks; fresh data required. **Priority:** Separate growth.

**Dependencies:** MP06; MP20.

**Read first:** marketing/apple-ads/; marketing/content-calendar.md; marketing/app-preview-video-script.md; marketing/aso/. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Consolidate old campaign checklists, identify assets actually published and request/read current search-term, spend, conversion and revenue data. Tie claims to shipped gameplay. Prepare targeted campaign/creative briefs from evidence.

**Acceptance criteria:** Budget/keyword decisions use current exported data and actual product value. Historical unchecked posting tasks do not become instructions to post or spend. Do not pad keyword fields solely to fill 100 characters.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP33: Android production-readiness track

**Status:** External state unverified; separate platform. **Priority:** Separate release.

**Dependencies:** Shared trust fixes; Google Play/RevenueCat evidence.

**Read first:** docs/GOOGLE_PLAY_RELEASE_PLAN.md; docs/REVENUECAT-TODO.md; docs/DATA_SAFETY.md; docs/BETA-HUB.md; .github/workflows/eas-build-local-android.yml. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Read current Play Console account/testing/build/product state. Reconcile Android catalog, RevenueCat verification, ad units, declarations and beta feedback. Build and exercise a signed Android candidate under current authorization. Treat old first-AAB/service-account/testing checklist claims as unverified until checked.

**Acceptance criteria:** Current account-specific release requirements and real billing/lifecycle/TalkBack matrix pass. Data safety and listing match the Android candidate. Do not assume old testing durations, account type or setup status still apply.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

### MP34: Navigation consolidation decisions

**Status:** Proposals explicitly not implemented. **Priority:** Optional product decision.

**Dependencies:** MP02; measured confusion.

**Read first:** tasks/phone-apps-audit.md section 5; shared AppLauncher/catalogue. Paths are entry points, not an exhaustive edit allowlist; resolve the current file before editing.

**Objective and scope:** Evaluate Garage+Luxury, YouVideo+Streaming and phone Bank+Bank Pro consolidation only if journeys show meaningful confusion. Compare reduced navigation against migration/relearning cost. Preserve the deliberate prestige-shop structure.

**Acceptance criteria:** A narrow prototype demonstrates easier discovery without losing functionality or identity. Obtain a product decision before major app mergers. Current game-theme and compact Home remain the default.

**Deliverable:** a focused implementation or decision record, actual test/journey evidence, updated item status, unresolved limits and next eligible package. Use the wrapper below.

## Copy-paste master-prompt wrapper

```text
Work only in Wrexist/DeepLifeSimulator. Execute [PACKAGE ID AND TITLE] from
DeepLifeSimulator-Master-Prompt-Backlog.md using the detailed brief below.

Read CLAUDE.md, relevant scoped instructions, tasks/todo.md, tasks/lessons.md,
and, where present, tasks/release/CONTRACT.md and queue.json. Refresh main,
open PRs and latest CI. Pin the source SHA. Distinguish merged implementation,
unmerged implementation, previously recorded evidence and fresh verification.
Do not duplicate PR #203 or overwrite other active work.

First reproduce or measure the stated problem on current source. If the
historical claim is already fixed, record the proof and close/supersede it.
If this is a proposal, validate the need and refine one bounded slice before
implementation. Do not expand a release gate into a whole-product rewrite.

Implement the smallest sustainable change using existing domain logic.
Preserve compact Home, the accepted game theme and screenshot direction,
paid benefits, save compatibility, atomic money/reward actions, deterministic
life-salted simulation, narrow selectors and all validation ratchets.
Use canonical time/economy/loan readers. New persisted fields require the
repository's migration, repair and test-factory treatment.

Verify the package's acceptance criteria with meaningful tests and reached
journeys. Use existing required gates for the affected files. Record actual
commands, exit results, source/build/device identity and visual evidence for
visible changes. Skipped/unreached tests remain unverified. Web/Jest evidence
cannot certify native StoreKit, device lifecycle or accessibility.

Update the single tracked queue and evidence. Prepare a focused reviewable
change and inspect CI on its latest SHA. Do not weaken checks. Respect current
authorization for publishing actions: merging main can release a production
OTA, and support changes can deploy public pages.

Continue independent authorized work if an external prerequisite is blocked.
State the exact missing input once, rather than claiming completion or
repeating the same blocked check. Close only the proven acceptance scope.

Return: completed work, verification and limits, updated remaining items,
and the next eligible package. Keep ready/submitted/approved/published separate.

PACKAGE BRIEF:
[Paste the selected detailed brief here.]
```

## Stale TODO reconciliation and decisions

| Historical entry | Correct next disposition |
|---|---|
| Publish Home PR / finish #200 conflict merge / old screenshot CI pending | Superseded by merged #201/#200/#204; preserve native acceptance as open |
| Build 2.13.0 because no binary exists | Historical claim. Read current ASC/EAS; do not blindly dispatch the old version |
| Null-guard v11/v13/v14 | Merged #197; keep regression, remove duplicate implementation task |
| Add pending non-subscription RC recovery | Merged same-install scope #197. Retain native, subscription-local-bonus and cross-install boundaries separately |
| Carry liveOps claimedInstanceIds across prestige | Merged continuity policy #197; do not reopen as an unanswered product choice |
| Tear-down leaks in determinism/social soaks | #203 R05 has later clean-exit evidence. Integrate/revalidate it, do not ignore exit failures or keep listing the old leak as unresolved there |
| Fix unsalted event selection | Delivered Program 13; protect with existing guards |
| Introduce a tier-1 way to meet people | Delivered; current social depth work starts from meetSomeone |
| Creator levels, pet tick, Hustle overlay, banking counters, semesters missing | Retracted historical hypotheses. Existing implementation must be preserved |
| Wealth has no effect on happiness | Prior social harness did not actually spend wealth. Re-measure with spending personas before changing gameplay |
| AlertHost should always defer handlers | Prior investigation rejected naive deferred queue because it reorders decisions. Keep as a low-confidence hazard unless a real caller reproduces it |
| Two-phase fresh-start carry-over | Historical lead remains to verify against utils/newLifeCarryOver.ts and native transition evidence. Do not infer it is fixed by the separate purchase-intent journal |
| Chapter gem lineage policy / free-call cost / happiness ceiling / party-standing loop | Product decisions or measured design issues; grouped in MP12/14/15/17 |
| Marketing integration/posting templates | Archive or map to MP20/32 based on current deployment/campaign evidence; unchecked template does not prove missing code |
| Old key-rotation runbook boxes | Historical security lead only. Establish whether an incident/key remains active before any action; never rotate save signing keys casually |

## Program 18's 50-item weakness map: complete routing

These are the original numbered hypotheses, not 50 fresh defects. Ranges preserve every original number.

| Original IDs | Current route / disposition |
|---|---|
| 1–5 | Native/operational/store verification: MP01–07 and MP20 |
| 6 | Legacy migration fix merged #197 |
| 7 | Fresh-start two-phase protocol must be inspected separately in MP04/19 |
| 8 | Same-install non-subscription recovery merged; native and broader recovery MP04/19 |
| 9 | Entitlement-authority/offline behavior: native verification MP04, truthful support MP01 |
| 10 | Live-event continuity merged; chapter lineage policy MP15 |
| 11–13 | Happiness, ad vitality, free calls: MP14/15/12 |
| 14 | Loan disclosure merged; full forecast MP08, optional deferment MP16 |
| 15 | Chapter rewards MP15 |
| 16 | Politics MP17; wealth-persona measurement MP14, prior wealth conclusion retracted |
| 17 | Event delivery/arc telemetry MP18 |
| 18 | Existing deterministic guards; research fix #203; maintain in all simulation work |
| 19–20 | Bank/stock clarity MP22, preserve current counters/market logic |
| 21 | Mining discovery/maintenance MP23 |
| 22–23 | Spark/contact state and shared plans MP12 |
| 24 | Pulse paid value/history/reactions MP24 |
| 25 | Pet care already wired; feedback/reachability MP25 |
| 26 | Education engine already wired; affordability MP08/16 |
| 27 | Company overlay already wired; consequence/reachability MP24 |
| 28 | Real-estate management/clarity MP25 and cash forecast MP08 |
| 29 | Creator levels/membership already wired; remaining discovery MP24 |
| 30–31 | Travel/vehicles MP25 |
| 32 | Politics MP17 |
| 33–38 | Compact Home/UI work partly merged; journey/native/discovery MP02/05/10/34 |
| 39–40 | Profile before architectural/performance work MP28 |
| 41 | CI/ratchet debt MP27; no mass cosmetic rewrite |
| 42 | Forecast authority MP08 and per-domain reader reuse |
| 43 | Production/native flags MP03–05, live-ops contracts MP18, CI MP27 |
| 44 | Verified privacy-aware telemetry MP01/20 |
| 45–46 | Reachable, connected content MP11/18 |
| 47–48 | Late-life decisions, capstones and succession MP13/24/25 |
| 49 | Reward cadence MP15/18; native subscription/ads MP04/05 |
| 50 | Small verified product scorecard MP20 |

## Scope boundaries

Do not hold this iOS update for every future feature. New multiplayer, public free-text feeds, live AI story generation, a framework rewrite, extra currencies, extra subscription tiers and a new account backend are not prerequisites for the current release. Treat merging sub-apps as an explicit product choice. This audit does not authorize campaign spend, community messages or production publication.

The next master prompt should be **MP00**, using #203's existing queue. Once source integration is resolved, the next eligible release work is **R11/R04/R08**, depending on available provider, interactive and native access. The first substantive post-release code package is **MP08: finish the truthful cash forecast**.

## Source index

- [Current main snapshot](https://github.com/Wrexist/DeepLifeSimulator/tree/811cfc2cec03f9cae1f0b0bb4e55298dcadf06c5)
- [Main TODO ledger](https://github.com/Wrexist/DeepLifeSimulator/blob/811cfc2cec03f9cae1f0b0bb4e55298dcadf06c5/tasks/todo.md)
- [Program 18 roadmap](https://github.com/Wrexist/DeepLifeSimulator/blob/811cfc2cec03f9cae1f0b0bb4e55298dcadf06c5/tasks/master-prompt-program-18-roadmap-2026-09-07.md)
- [Program 18 fresh audit and corrections](https://github.com/Wrexist/DeepLifeSimulator/blob/811cfc2cec03f9cae1f0b0bb4e55298dcadf06c5/tasks/program-18-audit-and-implementation-2026-09-07.md)
- [Cash-flow remaining contracts](https://github.com/Wrexist/DeepLifeSimulator/blob/811cfc2cec03f9cae1f0b0bb4e55298dcadf06c5/tasks/program-18-cashflow-correctness-2026-09-08.md)
- [Seven release gates and existing prompt handoff](https://github.com/Wrexist/DeepLifeSimulator/blob/4b1aa7be9e2464c1db06515ffd2ab789205174ad/tasks/release/REMAINING_WORK.md)
- [Release ledger on inspected #203](https://github.com/Wrexist/DeepLifeSimulator/blob/4b1aa7be9e2464c1db06515ffd2ab789205174ad/tasks/release/queue.json)
- [Merged purchase/continuity work #197](https://github.com/Wrexist/DeepLifeSimulator/pull/197), [education/cash-flow #199](https://github.com/Wrexist/DeepLifeSimulator/pull/199), [Home #201](https://github.com/Wrexist/DeepLifeSimulator/pull/201), [assets/recap #200](https://github.com/Wrexist/DeepLifeSimulator/pull/200), [screenshots #204](https://github.com/Wrexist/DeepLifeSimulator/pull/204)


## Historical inventory

The complete original checkbox/source-marker inventory and copied release briefs are retained in [the audit appendix](archive/todo-inventory-2026-09-09.md). Their paths refer to the pre-cleanup main snapshot, not the new current task list.
