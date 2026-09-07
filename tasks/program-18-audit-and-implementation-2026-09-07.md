# Program 18: repository audit and first implementation slice

Date: September 7, 2026. Repository: Wrexist/DeepLifeSimulator.
Audit runtime: `cc60c2e28436afb9724e14536886d0cd2fd3338a`.
Implementation base: `1824b9c4148340d8a66d253ed90ceb58dc883f1b`.
The only difference between these bases is the roadmap added by merged PR #196.

## Verdict

DeepLife has enough breadth for a substantial life simulator. The immediate
priority is protecting purchases and saved progress, then making existing
systems produce clearer, connected consequences. A fresh framework, more
currencies, more subscription tiers, or another large collection of isolated
apps would increase the work without resolving the strongest findings.

This pass found payment durability defects despite extensive existing tests.
The owner subsequently authorized implementation of #196. The first slice
addresses purchase persistence, transaction identity, checkpoint preservation,
legacy migration recovery, and unpaid police fines. This does not complete the
roadmap's nine phases, prove store acceptance, or establish device readiness.

## What was inspected and what remains unverified

- Read the repository's canonical instructions, release reports, latest PRs,
  configuration, weekly orchestration, feature gates, domain producers,
  persistence and purchase flows, analytics, UI patterns and CI definitions.
- Inventoried 63 `lib/` domain directories. Representative complexity measures:
  `GameActionsContext.tsx` 5,604 lines, state types 3,917, IAP service 2,500,
  and save validation 2,756 at the audit base. Size is a review/performance risk,
  not proof of a runtime defect.
- Installed locked dependencies, ran repository checks and focused failure
  reproductions. Exact final results belong in the validation section below.
- The production web export succeeded. The available browser could not open
  the local preview, so no new interactive browser pass is claimed. Existing
  repository screenshots were inspected as historical design evidence only.
- No physical iPhone/Android session, real purchase, cancellation, refund,
  VoiceOver/TalkBack, large-font pass or production dashboard was available.
- This is a broad, risk-based audit with deeper checks on critical paths. It is
  not a guarantee that every possible state or every line is defect-free.

## Latest PRs and release evidence

| Item | Verified result | Implication |
|---|---|---|
| [PR #196](https://github.com/Wrexist/DeepLifeSimulator/pull/196) | One 649-line Markdown roadmap, no runtime changes | Useful direction, not implemented features or proof of the weakness list |
| [PR #195](https://github.com/Wrexist/DeepLifeSimulator/pull/195) | PAC efficiency and pinned-holiday delivery corrected | Do not reopen those bugs from older reports |
| #195 wealth claim | Retracted because the two persona policies did not meaningfully differ in wealth use | No evidence for the blanket claim that wealth buys no gameplay value |
| #195 happiness work | Taper and extra-decay limitations documented, harmful experiment reverted | Preserve early-game survivability, investigate varied situations rather than blindly increasing drains |
| [iOS run #72](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/34054920090) | Production preflight, native build and IPA artifact upload succeeded on `cc60c2e`; TestFlight submission step succeeded | The old claim that 2.13.0 has never been built is stale |
| Submission watcher | Skipped in run #72 | Submission initiation does not prove completed processing, tester availability or App Store approval |

Several #196 implementation tasks are stale. Current code already includes:

| Roadmap assertion | Actual code to preserve |
|---|---|
| Creator levels are frozen | Weekly orchestration writes `creatorLevelFromExperience`, perk tiers and membership income |
| New companies miss the Hustle overlay | `CompanyActions.ts` seeds `createDefaultCompanyOverlay`; the weekly engine consumes it |
| Pets need wiring to their real care engine | `applyPets.ts` calls `tickAllPets` on the real weekly path |
| Banking interest totals lack writers | `lib/banking/weeklyTick.ts` updates interest earned and paid from real tick inputs |
| Education lacks semester/exam/study-group wiring | `applyEducationProgression.ts` already applies these and emits campus events |
| Analytics must be designed from scratch | `lib/analytics/` already has a taxonomy, funnels, cohorts, adoption and experiments |

These systems may still need depth or better presentation. Their existing
implementation must be measured before creating replacement machinery.

## Findings and first-slice disposition

Severity: P1 affects paid property/recovery, P2 affects gameplay or operational
quality, P3 is defensive hardening or maintenance. A source-confirmed failure
path is distinct from an observed incident affecting a real customer.

| ID | Priority | Finding | Disposition |
|---|---|---|---|
| PAY-1 | P1 | `IAPHandler` ignores `saveGame(true)` resolving false. The service treats the live grant as persisted, skips the additive disk grant, and can mark an old save fulfilled without purchased gems | Fixed save-result propagation and same-save transaction identity |
| PAY-2 | P1 | A non-idempotent grant reserves an ID in the fulfilled ledger before granting. A disk throw or process interruption can leave an ungranted purchase looking completed | Fixed separate pending/completed semantics with fault tests |
| SAVE-1 | P1/P2 | Cold IAP disk writes decode the main envelope without restoring its checkpoint sidecar. Saving the partial object can replace the sidecar with an empty list | Fixed sidecar preservation with the real save pipeline in the regression test |
| PAY-3 | P1 residual | RevenueCat completes the store transaction before local fulfillment. A failed local consumable grant cannot be recovered by entitlement-only Restore | Requires durable, slot-bound pending-grant replay and a reconciliation policy. Do not claim the first slice solves all process-kill windows |
| SAVE-2 | P3 | v11/v13/v14 migrations access null array elements. The loader survives but repeatedly stalls at the old version | Fixed malformed-entry filtering while preserving valid neighboring careers, deals and loans |
| ECON-1 | P2 | Police liability is capped by wallet cash before `chargeOrDefer`, so an illiquid wealthy player evades most or all financial penalty | Fixed: assess full bounded liability, collect available cash, defer the remainder |
| STORY-1 | P2 | Journal deduplication uses notification ID globally while real producers reuse IDs for births, exams, arrests and breakups | Next slice: week + event/entity identity, preserving replay deduplication |
| CLAIM-1 | P2 conditional | Prestige/heir transitions rebuild state without retaining live-event claim IDs and the real-time reward budget | Decide and implement per-lineage claim continuity before adding more cross-life events. Exploit reachability depends on active event eligibility/objectives |
| SOCIAL-1 | P2 design | Free contact calls cost no energy or money, while close bonds provide weekly support | Measure a limited social-action budget or maintenance choices. Avoid making early survival depend on more repetitive taps |
| BAL-1 | P2 design | Established social lives can remain emotionally flat or near the happiness ceiling | Work on varied needs/consequences. Stronger global decay already failed an early-game experiment |
| EDUC-1 | P2 design | Student borrowing starts ordinary loan repayment while the player is still studying | Add an affordability preview first, then measure deferment/income-linked alternatives |
| END-1 | P2 design | Voluntary prestige begins at $10M, with later wealth thresholds increasing | Add meaningful recognition for family/career/community paths. Death-to-heir already exists and is a separate route |

### What the purchase fixes must prove

1. A live grant and its transaction identity are written together.
2. A failed save is not a successful durable grant.
3. Retrying after failure never adds the same quantities twice, even if a
   later autosave persisted the earlier in-memory grant.
4. A pending reservation never causes a listener to finish an unfulfilled
   store transaction as though it had already succeeded.
5. A disk-only grant preserves rewind checkpoints and unrelated save state.
6. A failure after one successful durable write does not undo its identity and
   create a second payout on retry.

The existing global completed ledger and the per-save
`processedIAPTransactions` field have different purposes. They must not be
treated as interchangeable with a pending-grant recovery journal.

### Recovery still required after this slice

The new pending key stores transaction IDs, not complete recoverable grants.
It neither binds a grant to a character/slot nor starts recovery on launch.
RevenueCat can finish a store purchase before local fulfillment, while Restore
deliberately omits consumable quantities. The current failure message telling
the player to tap Restore consequently overpromises for consumables.

The next purchase slice should persist a verified product/transaction/target
record, reconcile it on startup and before changing slot, and track local
quantity delivery separately from cross-slot entitlement completion. Define
how a purchase already finished by the SDK is recovered when the app dies
before that record is written. This may require store/server reconciliation,
not just another local key. Update failure copy to provide an accurate support
route. Test process interruption at each durable boundary, with slot changes,
Restore and later autosaves. Do not mark this residual P1 complete based only
on the pending-ID tests in this PR.

### Source locations for findings

These paths are relative to the repository. The audit base records pre-fix
behavior; the PR diff and regression tests record the corrections.

| Findings | Source |
|---|---|
| PAY-1, PAY-2, PAY-3 | `components/IAPHandler.tsx`; `services/IAPService.ts` (`applyBenefit`, transaction ledger and purchase/restore flows); `services/RevenueCatService.ts` |
| SAVE-1 | `services/IAPService.ts` (`applyBenefitToDisk`); `utils/saveQueue.ts`; `utils/checkpointSidecar.ts` |
| SAVE-2 | `utils/saveMigrations.ts`, migrations 11, 13 and 14 |
| ECON-1 | `contexts/game/actions/weekly/applyCrimeTick.ts`; `contexts/game/actions/weekly/chargeOrDefer.ts` |
| STORY-1 | `lib/lifeMoments/journalWriter.ts`; birth notifications in `contexts/game/GameActionsContext.tsx`; education and relationship notification producers |
| CLAIM-1, END-1 | `lib/prestige/prestigeExecution.ts`; `lib/dynasty/transition.ts`; `lib/liveops/claim.ts` |
| SOCIAL-1, BAL-1 | Contact call actions and weekly close-bond support; #195 experiment report |
| EDUC-1 | `contexts/game/actions/EducationActions.ts`; `contexts/game/actions/weekly/applyLoanAutopay.ts` |

## Existing feature inventory and useful next improvements

The entries below describe the existing feature families, not a claim that
every branch has been exercised on a device during this audit.

| Feature family | Existing foundation | Best next improvement |
|---|---|---|
| New lives and scenarios | Character customization, save slots, scenarios, perks, ambitions | Distinct opening dilemmas and recovery options for each starting fantasy |
| Main loop | Weekly actions, bills, stats, events and recap | Explain the three most important changes and link each to a useful next action |
| Careers | 30 career IDs, hiring, progression and specialist paths | Named mentor/rival arcs, career switching and path-specific capstones |
| Education | Programs, loans, scholarships, exams, GPA, classes and study groups | Show qualification payoff and post-bills affordability before committing |
| Health and activities | Diseases, recovery, food, fitness, pursuits and commitments | Varied recovery choices with clear costs, visible progress and fair warnings |
| Dating / Spark | Swipes, conversations, matches, relationship promotion and premium features | Multi-week shared plans and conflicts that affect a named relationship |
| Contacts | Calls, favors, closeness, NPC goals and memories | Replace repetitive maintenance taps with deliberate weekly priorities |
| Family | Partners, children, parenting, genetics and grandchildren | Shared goals, caregiving and consequences that carry into later generations |
| Banking | Accounts, loans, credit score, bills, savings goals and interest | A single understandable cash-flow forecast with causal links to charges |
| Stocks | Price simulations, trading, dividends, sectors and macro inputs | Explain movement and portfolio risk using the authoritative simulation |
| Crypto and mining | Trading, miners, market regimes and upgrades | Make upkeep, repair and net yield easy to compare before buying equipment |
| Companies / Hustle | Company operations, staffing, campaigns and overlays | Staff/customer dilemmas and succession decisions with bounded economics |
| Creator apps | Posts, videos, streams, levels, subscriptions and memberships | Cross-system reputation, sponsor and audience consequences |
| Real estate | Rentals, ownership, tenants, management and upgrades | Housing decisions with lifestyle and relationship effects, plus clear debt risk |
| Vehicles | Ownership, financing and vehicle systems | Explain total ownership cost and make specific vehicles useful in specific paths |
| Travel | Destinations, progression and travel systems | Local story arcs that use existing stats and leave persistent memories |
| Pets | Real care tick, traits, bonding and care actions | Improve care feedback and family-story connections using the existing engine |
| Crime / dark web | Wanted level, police, prison and underground systems | Investigation/consequence arcs and viable legitimate exits |
| Politics | Offices, elections, policies, lobbyists and PAC | Public trust and rival consequences, preserving the recent recovery fixes |
| Luxury | Collection, upkeep, activities and status | Distinct uses and tradeoffs instead of larger passive bonuses |
| Events / life moments | Authored events, cliffhangers, seasons and journal | Repair journal identity, then build a few connected arcs with aftermath |
| Prestige / dynasty | Legacy points, heirs, upgrades, vault/endowment/trials/seat | Broaden strategic recognition and carry claims across lives safely |
| Retirement | Pension, elder activities and legacy summary | Succession and unfinished-story closure, extending existing retirement code |
| Challenges / live operations | Objectives, windows, reward caps, local and remote catalogues | Maintain offline runway and validate real-time claim continuity |
| Time Machine | Checkpoints and rewind | Keep checkpoints intact across purchases/restores and explain rollback boundaries |
| Monetization | Gem packs, perks, subscriptions, lifetime premium, revives and ads | Fulfillment recovery, clearer product roles and truthful benefits |
| Support / analytics | Diagnostics, Firebase funnel, cohorts, event taxonomy | Verify event arrival and make purchase/support outcomes actionable |
| Cloud backup | Preview-gated backup/transfer machinery | Establish recoverable identity, slot ownership and conflict rules before wider rollout |

## Product, UI and architecture weaknesses

**Discovery is still tied heavily to wealth.** Feature tiers can rise at $500,
$2K, $10K, $50K and $200K, with a 120-week veteran escape hatch. This protects
new players from an overwhelming launcher but delays certain fantasies, such
as creator or political play. Test path-specific early previews or controlled
alternate unlocks. Do not simply expose everything on the first screen.

**The product needs an emotional center.** A player should be able to name what
changed this week, who mattered and what decision comes next. Bank, family,
creator and career screens already contain much of the required state. Connect
their consequences instead of adding a second parallel story database.

**Visual cleanup remains measurable debt.** The UI ratchet at this base records
152 gradient elements, 94 raw numeric font-size declarations and 652 heavy
font-weight declarations. These are code-pattern counts, not 898 visual bugs.
Prioritize the first viewport, consistent modal dismissal, meaningful hierarchy,
readable small-screen copy and native accessibility over broad restyling.

**Whole-state subscriptions remain easy to introduce.** Selector infrastructure
already exists. Profile specific hot screens before replacing broad `useGame`
subscriptions. Split the 5,604-line action module gradually along existing domain
boundaries, retaining action contracts and deterministic tick order.

**Static checks cannot establish gameplay quality.** The content scanner found
251 multi-choice events, of which two have no substantial stakes by its rule.
Only 5.27% of scanned outcomes meet its 20-point threshold. That threshold is a
proxy, not a mandate to multiply all rewards. Relevance, future effects and
variation matter more than the number of large deltas.

**CI still has blind spots.** Ordinary EAS Update CI runs tests without coverage.
The coverage ratchet exists but is not enforced there. The preflight workflow
is path-filtered, so a components-only change need not execute its UI ratchet.
Add cheap domain checks to every relevant PR and run costly soaks on a scheduled
or explicit gate. Do not label thousands of mocked tests as native end-to-end
coverage.

**Observability exists but needs operational proof.** Firebase is enabled in
the committed production profile. The optional self-hosted queue is deliberately
off, and Firebase forwarding is independent of it. Do not enable an unconfigured
HTTP sink. `RemoteLoggingService` has no active remote destination in repository
code, and no crash-reporting SDK is installed. Verify native crash visibility
through the available store/device reporting before selecting another SDK.

**The monetization catalogue needs clear roles.** Configured monthly membership
is $4.99 with 250 daily gems, 500 welcome gems, a salary boost and other benefits.
The configured 5,000-gem pack is $19.99. Thirty eligible daily member claims mean
7,500 gems before the welcome reward. This may deliberately reward retention,
but can also make instant packs feel poor value. These are repository reference
prices, not a live-store price verification. Assess actual conversion, retention,
purchase failures and long-term gem spending before changing any price or reward.

**Premium support is an operational promise.** The benefit catalogue promises
priority support. The inspected support route uses email/share/Discord without
a visible entitlement-based queue. A manual support process may exist outside
the repository. Verify that process or adjust the promise before treating it as
a delivered product feature.

## Prioritized feature roadmap

Effort is relative: S is a contained slice, M spans several existing components,
L spans multiple domains and requires broader balancing. These are proposals,
not measured retention or revenue forecasts.

| Order | Improvement | Effort | Proof of value / acceptance |
|---|---|---|---|
| 1 | Complete durable, slot-bound purchase recovery | L | Crash/failure at each await yields either one durable payout or a recoverable pending record |
| 2 | Native release matrix on the actual candidate | M | Buy, restore, kill/relaunch, rewind, death/revival, large font and screen reader work on device |
| 3 | Repair journal event identity | S–M | Second birth and two same-week graduations appear, replay adds no duplicates |
| 4 | Explainable weekly recap | M | Each major change traces to real simulation inputs and opens a useful action |
| 5 | Three cross-system story arcs | L | Setup, two viable choices, later consequence and remembered aftermath per arc |
| 6 | Safe claim continuity across prestige/heirs | M | Same live-event instance cannot repay or reset its real-time budget through transitions |
| 7 | Cash-flow preview before tuition/housing/loans | M | Forecast agrees with actual mandatory costs and distinguishes cash from assets |
| 8 | Path-specific onboarding and discovery | M | Story/creator/family players reach one meaningful action in their chosen path early |
| 9 | Relationship time budget and shared plans | M | Social play creates tradeoffs without pushing ordinary new lives below survival gates |
| 10 | Family/career/community capstones | L | A worthwhile ending exists without requiring all players to become tycoons |
| 11 | Business and creator consequence chains | L | Staff, education, reputation and family choices affect bounded outcomes across systems |
| 12 | Retirement and succession extensions | M–L | An heir inherits meaningful obligations and unresolved stories, not only advantages |
| 13 | First-viewport and modal accessibility polish | M | Clear lead action, reachable exit, focus restoration and acceptable native targets |
| 14 | Verified funnel and support dashboard | M | Real purchase failure, activation, recovery and retention questions are answerable |
| 15 | Cloud backup rollout | L | Identity recovery, conflict handling and install/slot separation proved before production enablement |
| 16 | Localization and cultural content pass | L | UI strings, events and store claims remain consistent across supported languages |
| 17 | Local shareable life summaries / challenge seeds | M | Opt-in sharing is understandable and does not expose private user text unexpectedly |

Defer synchronous multiplayer, public free-text social feeds, a framework rewrite,
new currencies and live AI-generated stories. Each brings a large reliability or
operating burden while existing systems still need better connections.

## Validation

Final full-suite result: **766 suites, 9,658 tests and 308 snapshots passed**,
with 17 suites/32 tests skipped. Command: `npm test -- --ci --maxWorkers=2`,
exit 0. This includes the configured stress, save, startup and monetization
suites. No skip was introduced by this change.

The run also reported late imports from `socialBoundaries.test.ts` after Jest
teardown and a worker forced-exit warning. The same late-import failure path
appears in the initial audit run and is documented in the existing lessons.
The assertion result and exit 0 are real; the test harness teardown is not
clean. Track that harness debt separately instead of hiding it with a blanket
`--forceExit`. The focused purchase/checkpoint run exited normally.

`npm run preflight`: **exit 0**. Source/test types pass, lint has zero errors
and 716 warnings against the unchanged 716 ceiling, UI/content ratchets pass,
and the combined live-event catalogue has runway for every stage. Individual
published/compiled catalogues still have the quiet-stretch advisories printed
by the checker. No ratchet was relaxed. `git diff --check` passes.

Confirmed red-before / green-after so far:

- Police fine regression: four failing cases before the fix. Afterward,
  police/mandatory-charge/subsystem suites pass: 430 tests and 308 snapshots.
- Legacy malformed migrations: all three version-specific cases fail before
  the fix. Afterward the regression and migration stress suites pass: 33 tests
  across two suites. The fix filters only non-record entries and preserves valid data.
- Purchase/checkpoint final focused run: 32 tests across five suites, exit 0.
  This uses the real IAP handler for false-save behavior and the real checkpoint
  save pipeline for sidecar preservation. Native SDK calls remain mocked.
- Source type-check and test-tree type-check pass with zero errors.
- `npm run audit:weekly`: exit 0, no blockers, three existing warning groups:
  54 test `as GameState` assertions, one hand-built pre-roll fixture and two
  modules with no importer. These are maintenance findings, not 57 runtime bugs.
- Initial full-suite run: 763 suites, 9,639 tests and 308 snapshots passed,
  17 suites/32 tests skipped, exit 0. The final post-change result supersedes
  this for implementation acceptance.

The web production export passed at the audit base. No new native binary was
cut. The app remains 2.13.0 and save schema remains 51 because this slice reuses
existing fields and repairs existing migrations. Bump the app version before
the next TestFlight/EAS build, as required by `CLAUDE.md`.

No device tests or customer-impact counts are inferred from these reproductions.
