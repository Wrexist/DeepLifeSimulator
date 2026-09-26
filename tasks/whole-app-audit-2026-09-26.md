# Whole-app imperfection audit - 26 September 2026

> Follow-through: D01-D08 and D10-D12 have implementation fixes in the [audit-fix checklist](audit-fixes-2026-09-26.md), with the Family target portion of D09 also addressed. See [current fix evidence](release/evidence/audit-fixes-2026-09-26.md). The original observations below are preserved as the audit baseline; native acceptance and the remaining 47 register items are still open (D09 partially complete).

**Audit result: one reproduced high-priority save defect, additional finance and
feedback defects, and substantial remaining presentation/acceptance work.**
The app is more coherent, but green CI is not evidence that all journeys are safe
or all screens meet the visual brief. This report is an audit, not an implementation
claim. No gameplay code was changed.

Source: `9a4422c6`, branch `codex/visual-ux-rebuild-2026-09-26`, draft PR #229.
Remote main refreshed: `9e729ac2`. Version 2.15.0; Expo 54 / RN 0.81.5; schema 51.
Unrelated marketing work and named stash backups were preserved.

[Current screenshot gallery](release/evidence/whole-app-audit-2026-09-26/gallery.html)
| [Save review](release/evidence/whole-app-audit-2026-09-26/save-review.md)
| [Logic review](release/evidence/whole-app-audit-2026-09-26/logic-review.md)
| [79 named overlays](release/evidence/whole-app-audit-2026-09-26/modal-inventory.md)

## Checkable plan completed

- [x] Reconcile current branch, CI and prior completed work.
- [x] Inventory routes, app families, shared presentation and system owners.
- [x] Inspect current screens and exercise representative nested journeys.
- [x] Review accessibility, motion, art consistency and responsive evidence.
- [x] Review persistence, weekly progression, economy and provider evidence.
- [x] Publish prioritized defects, polish items and unreached acceptance cases.

## How to use this list

P1 = fix before a release candidate; P2 = significant correctness/usability/polish;
P3 = secondary refinement or maintenance. **Reproduced** means observed in the
browser or executed against production code. **Source** means verified code behavior
without native reproduction. **Visual** means an observed design imperfection or
recommendation, not a broken game rule. **Unreached** means missing acceptance,
not proof of a defect. Rows are independent work items; do not treat every row as
a release blocker or every screenshot as verification of its entire subsystem.

The register has 14 defect/implementation findings (D), 18 presentation work items
(V), 22 acceptance cases (A), and 4 maintenance/release-preparation items (O).
This is the complete recorded result of this audit, not a claim to have exercised
every save state, branch, modal permutation or device.

## 1. Correctness, accessibility and implementation findings

| ID | Priority / evidence | Imperfection and player impact | Next action / acceptance |
| --- | --- | --- | --- |
| D01 | **P1, reproduced** | Prestige persistence bypasses the save/load mutex. Holding the mutex as `load` did not prevent a real prestige reset from changing the saved prestige level on disk. `contexts/game/GameActionsContext.tsx:5644-5648`; `utils/saveQueue.ts:113-125`. Actual lost-player-save outcome was not simulated, but concurrent write exclusion is broken. Persistence failure only logs after memory changes. | Route the outgoing-life snapshot and replacement save through a coordinated owned transaction. Await durability and surface recoverable failure. Regression: no write until the competing owner releases; preserve the original life on failure and retry. [Details](release/evidence/whole-app-audit-2026-09-26/save-review.md). |
| D02 | P2, reproduced | FIRE savings rate depends on starting age. Identical four-week finances ($1,000 savings and $1,000 weekly salary) show **25% at age 18 versus 0.93% at age 20**. Years-to-FIRE is also distorted. `lib/statistics/fireTracker.ts:62-73`. | Use life-relative elapsed time; add equal-progress/different-start-age regression. Coordinate the metric definition with D12. No cash balance is changed by this display bug. |
| D03 | P2, reproduced | Business campaign launch reports success when latest-state energy rejects the operation. The UI can save, clear inputs and play success feedback although no campaign exists. Funds remain protected in the reproduced case. `HustleActions.ts:503-513`, `LaunchCampaignModal.tsx:72-80`. | Acknowledge the committed result, not the pre-commit intention. Test energy/funds races, duplicate presses and successful launch. |
| D04 | P2, source | Profile Life Stats summary uses raw `weeksLived`, while its expanded value uses `weeksInThisLife`. An age-20 fresh life can read **104 weeks versus 0**. `app/(tabs)/progression.tsx:315-319`. | Use one life-relative elapsed-week formatter for both. Verify fresh age18/20/25 and inherited lives. |
| D05 | P2, reproduced | Bank amount entry silently accepts partial numeric strings: entering **`1,000` deposits $1**, not $1,000. `components/banking/AmountInputModal.tsx:61` uses `parseFloat(text)`. | Strictly parse the whole input, deliberately support or reject grouping/locale separators, and show the interpreted amount before submitting. Regression for pasted grouped amounts, decimals, malformed suffixes, negatives and non-finite values. [Result](release/evidence/whole-app-audit-2026-09-26/bank-grouped-amount.png). |
| D06 | P2, browser + source | Shared bank amount input has no accessible amount/currency label; confirm and preset touchables lack explicit button semantics. The browser Deposit button could be found by text but not by button role. `AmountInputModal.tsx:88-156`. | Label amount and currency, add button/disabled semantics, associate validation text and announce outcomes. Verify actual VoiceOver order and keyboard submission on device. |
| D07 | P2, visual + source | Selected player portrait is not used consistently in Pulse: the header shows the chosen portrait while the story/composer shows a different generated face. `StoriesRail.tsx:85-101,146-164` passes name/sex/photo but not the stored portrait identity; inspect `FeedScreen.tsx:206` too. | Pass the canonical profile to the shared avatar renderer at every player surface. Check old saves, custom avatars, portraits and uploaded-photo fallback. [Evidence](release/evidence/whole-app-audit-2026-09-26/pulse.png). |
| D08 | P2, measured/source | Education cash controls render white text on `accent.success` #10B981, contrast approximately **2.54:1**, including the smaller cash-on-hand line. `EnrollModal.tsx:173-177,307-315`. Shared action colors already offer a darker success fill. | Apply shared accessible action colors to both payment selection and confirmation; measure enabled/disabled/selected text and test Larger Text. [Evidence](release/evidence/whole-app-audit-2026-09-26/nested-education.png). |
| D09 | P2, measured/source | Some touch targets remain small: Family is approximately 82x35 CSS px at 375 width; the HUD gem-plus is 16x16 with hit slop only 28x32 before parent clipping. `life.tsx:212-234`; `TopStatsBar.tsx:705-717` / styles `gemChipPlus`. | Keep visual size if needed but provide a genuine 44-point target without overlapping the gem-breakdown target. Verify physical taps and VoiceOver; browser bounds are not native touch-hit evidence. |
| D10 | P2, source | Shared locked segments announce disabled while still invoking an explanation handler. `SegmentedControl.tsx:102-108` routes to `onLockedPress` but sets accessibility disabled. The Apps launcher was fixed previously, this shared control was not. | Distinguish unavailable content from an operable explanation action. Test locked segments with/without explanation handlers. |
| D11 | P2, source | Education and amount-entry modals always request a fade, bypassing the reduced-motion behavior of the shared BaseModal. `EnrollModal.tsx:90`, `AmountInputModal.tsx:65`. | Apply the same reduced-motion policy to custom modals; inventory the other custom overlays before centralizing them. Test preference changes while open. |
| D12 | P2, source | FIRE planning presents assumptions as measured finances: expenses are assumed to be 70% of salary with a $15,600 floor; savings rate derives from the current legacy savings balance. Transfers alter the supposed rate and other deposit accounts are omitted. `fireTracker.ts:45-62`; `StatisticsApp.tsx:564-600`. | Either compute from real cash-flow history or clearly label assumptions and unavailable history. Do not fabricate history or silently change economic rules. |
| D13 | P3, browser + source | Secondary apps expose unexplained absolute stamps: fresh-life Bank and Statistics say **Week 104**, while Home says Week 1. Account openings, credit inquiries, vehicle expiry and records use similar raw counters. | Introduce a shared display-only calendar/elapsed/remaining formatter. Preserve absolute clocks in mechanics; handle pre-life stamps honestly. [Bank](release/evidence/whole-app-audit-2026-09-26/bank.png), [Statistics](release/evidence/whole-app-audit-2026-09-26/statistics.png). |
| D14 | P2, browser + source | Advanced career requirements expose internal keys such as `masters_degree`, `business_degree`, `medical_school` and `social_celebrity`. `app/(tabs)/work.tsx:1310` joins raw IDs. | Resolve human-readable education/achievement names and distinguish alternatives from cumulative requirements. Verify all advanced careers and longer translated labels. |

### Reproduction evidence

- D01: real provider + real save queue and signed envelopes over stateful mock
  storage; one reproduction test passed in 56.021 seconds (764 ms test body).
- D02/D03: production financial helper and production campaign action; two
  reproduction checks passed in 16.55 seconds. Passing asserts the defects exist.
- D05: actual browser Bank -> Accounts -> Deposit -> enter `1,000` -> Deposit;
  account displays $1. Ordinary `100` input separately deposited $100.
- Saved copies: [prestige reproducer](release/evidence/whole-app-audit-2026-09-26/prestige-reproduction.test.ts.txt),
  [logic reproducers](release/evidence/whole-app-audit-2026-09-26/logic-reproduction.test.ts.txt),
  [prestige output](release/evidence/whole-app-audit-2026-09-26/prestige-reproduction.txt),
  [logic output](release/evidence/whole-app-audit-2026-09-26/logic-reproduction.txt).
  These scratch tests are investigation artifacts, not added production regressions.
  Convert them to clean permanent behavioral tests when implementing the fixes.

## 2. Visual and product-quality work

These are observed polish gaps and design recommendations. Preserve the approved
HUD, working rules and existing architecture while addressing them.

| ID | Priority | Area / observed imperfection | Concrete next step |
| --- | --- | --- | --- |
| V01 | P2 | **Home density:** player record, Details and first-job block push the goals below the initial compact viewport. Scenario label Food Courier alongside Unemployed can look like contradictory occupation data. | Shorten secondary identity content, label it as the starting scenario, and keep the useful objective/progress visible. Do not remove the successful first-job guidance. |
| V02 | P2 | **Work density:** header, category group and career artwork push the first Apply below the initial compact view. Salary/requirements compete with decorative space. | Compress section spacing/art placement, prioritize the best available opportunity and expose Apply sooner. Keep lock explanations. |
| V03 | P2 | **Life density:** the vitals block and scene occupy most of the first view before any activity. | Reduce nested padding and redundant headings; bring the first affordable/relevant action into view while retaining readable vitals. |
| V04 | P2 | **Profile hierarchy:** repeats the full Home record; long-term progress and achievements are far below it. | Make Profile lead with life progress, achievements and legacy; reduce repeated identity/net-worth content. Verify unlocked, empty and completed states. |
| V05 | P2 | **Creator density/style:** large portrait panel, heavy header and glowing footer obscure much of the actual editor on a compact phone; Custom adds an aging row and pushes choices farther down. | Use a compact live preview/editor layout with reachable options. Align footer, shadows and typography with the current in-game controls. Preserve portrait/custom save semantics. |
| V06 | P2 | **Avatar family mismatch:** soft rendered portraits coexist with very different vector NPC/custom faces. Static portraits cannot change hairstyle/clothes or visibly age, whereas Custom can. | Define the shared face/framing/material language; improve custom/NPC art within the existing genetics system. Keep the current mode limitations explicit. Broader roster/aging portraits are an art decision, not an automatic engine rewrite. |
| V07 | P2 | **Media identity:** YouVideo and Streaming prominently show named external-game artwork (Among Us, Fortnite, Minecraft, etc.), unlike the original Deep Life scenes. `GamingApp.tsx:169-173`. | Replace hero/thumbnail families with authored fictional media artwork aligned to Deep Life; document provenance of retained assets. This is an identity/provenance task, not a legal conclusion. |
| V08 | P2 | **Asset consistency:** realistic cars and luxury photography, emoji pets/travel, vector NPCs and isometric destination rooms feel like separate visual families. | Create a per-family retention/replacement manifest; prioritize repeatedly visible pet/travel/vehicle art. Keep local optimized assets and loading fallbacks. |
| V09 | P2 | **Stocks hierarchy:** six large sector cards precede actual securities; first actionable stock starts near/below the fold. | Compress sector context into a summary/expandable area and prioritize holdings/watchlist/search and stock rows. |
| V10 | P2 | **Finances duplication:** Bank Pro shows a net-worth hero and a second account-statement card repeating net worth before accounts/transactions. Phone Bank and Bank Pro organize similar tasks differently. | Establish shared financial vocabulary and clear routes for accounts, income, assets and borrowing; reduce repeated totals. Retain genuine data and domain-specific capabilities. |
| V11 | P2 | **Segmented controls:** long labels such as Travel Destinations are cramped; Bank hides later categories in a horizontal strip with weak overflow cues. | Choose wrapping/scrolling rules and visible overflow affordances in the shared control; verify selected state, long names and tablet resizing. |
| V12 | P2 | **Currency presentation:** Health uses raw `$17500 / wk`, while neighboring apps use `$17.5K` or grouped amounts. `health.tsx:265,431`. | Adopt the canonical formatter and consistent precision for prices, recurring costs, holdings and deltas. Keep unit and cadence explicit. |
| V13 | P3 | **Education copy:** a free diploma goes through Pay cash / Pay $0, and catalog duration 2yr becomes 104w in the modal. | Say Enroll free for zero-cost courses and use one duration vocabulary; make auto-picked classes and irreversible tuition clear. |
| V14 | P2 | **Contacts action clarity:** expanded Call / Hang Out / Ask $ / Lend $100 controls do not visibly summarize effects, energy/cooldown or limitations before action. | Show concise cost/requirement/status next to actions and accurate disabled explanations; verify parent/friend/partner variants. |
| V15 | P3 | **Pulse personality:** repeated ambient text (the same coffee-shop post twice in the initial feed) and generic posts weaken the feeling of an individual life. | Improve authored variation and context from real relationships/life events; avoid fake notifications or added AI-network dependencies. |
| V16 | P2 | **Navigation consistency:** Contacts centers its title; most apps left-align it; DeepMail places Back on the right while most place it on the left. | Standardize back/close placement and shared headers, retaining intentional fictional-app branding. Internal app tabs may stay distinct from the primary game navigation. |
| V17 | P2 | **Typography and component debt:** current ratchet permits 148 gradients, 94 raw font-size declarations and 650 heavy weights. Company Detail alone still uses many 10-11-size metadata styles. | Migrate by shared component family, validate actual readability and reduce needless visual emphasis. Counts are a workload indicator, not 892 individual defects. |
| V18 | P3 | **Semantic color drift:** screen identity colors leak into cash values, and empty-state stat summaries can imply status by color alone; e.g. Pets' zero happiness appears red. | Separate app accent from money/stat semantics; ensure zero/neutral, gain/loss and disabled states have explicit text/icons. Preserve the approved HUD stat colors. |

## 3. Remaining acceptance work (not newly confirmed bugs)

Each row below needs evidence on the relevant state/build. Browser entry captures
cannot close the nested transactions or native/provider cases.

| ID | Priority | Acceptance case | Evidence required to close |
| --- | --- | --- | --- |
| A01 | P2 | Full custom onboarding | Scenario -> identity -> perks -> start -> save/reload, all scenario prerequisites and affordability. Quick Play and creator entry were inspected; all permutations were not. |
| A02 | P2 | Career lifecycle | First wage after hiring, rejection, two-week application, promotion, quit/reapply, advanced requirements, job loss and retirement. Apply -> hired after one week passed in one fresh-life sample. |
| A03 | P2 | Weekly-loop interaction | Rapid/double taps, save failure, pending decisions, recap cash/debt/asset deltas, annual transition and event ordering through the canonical transition. |
| A04 | P2 | Health and low-cash recovery | Free actions, insufficient energy/cash, disease/treatment, gym membership, recurring diet, cooldowns and critical-stat rescue. |
| A05 | P2 | Market/inventory and equipment | Buy/use/sell, last-dollar refusal, item ownership, duplicates and save/reload across phone/computer/creator gear. Prior computer round trip is preserved evidence, not coverage of all items. |
| A06 | P2 | Full banking lifecycle | Deposit/withdraw/transfer, cards, loans, repayment/default, bill rules, budget, taxes and credit score with real state. Ordinary $100 deposit passed; grouping failed D05. |
| A07 | P2 | Stocks and crypto | Buy/sell, fractional/large inputs, orders/cancellation, dividends, loss and empty histories; wallet/mining/upgrades and offline recovery. |
| A08 | P2 | Education lifecycle | Cash/loan enrollment, study, insufficient resources, exams/failure, graduation, prerequisites, course withdrawal and save continuity. Enrollment quote was inspected. |
| A09 | P2 | Businesses | Founding prerequisites, campaigns, employees, research, IPO/acquisition/merger/liquidation, recurring costs and rejection feedback. D03 is one confirmed issue within this wider journey. |
| A10 | P2 | Relationships and family | Spark matches/messages, dating, calls/favors, breakup/marriage/divorce, pregnancy/children, money transfers, bereavement and heir selection. |
| A11 | P2 | Pets | Adoption/name, recurring food, hunger, vet/vaccination, competition, illness/death and pet save continuity. |
| A12 | P2 | Property/vehicles/luxury | Cash and financed purchase, licence/insurance, occupancy/rent/upkeep, repair, sale/default and collectible verbs. Verify affordability/confirmation and real cash-versus-asset accounting. |
| A13 | P2 | Crime and prison | Street/underground jobs, wanted levels, raid/jail, jail-only navigation, penalties, release and reward refusal. |
| A14 | P2 | Media/travel/politics | Record/upload/stream, gear unlocks, passports/trips/return, elections/policies and result feedback. Do not imply roadmap-only politics effects are already functional. |
| A15 | P2 | Progression and reward lifecycle | Achievements, goals, weekly/daily claims, legacy pass, prestige, death/revive/heirs and multi-generation completion. Recheck after D01 fix. |
| A16 | P1 before release | Signed-device layout/accessibility | Compact/standard/large iPhone and iPad, safe areas/Dynamic Island, rotation/Split View, Larger Text, VoiceOver, contrast, keyboard and reachable close/back. No xcrun/adb command was available in this Windows audit; no device was exercised. |
| A17 | P1 before release | Signed save lifecycle | Old-version upgrades, slots, background/kill/relaunch during writes and recovery, low storage, offline cloud restore and cross-device conflicts on the exact binary. |
| A18 | P1 before release | Purchases and restore | Exact signed build with real sandbox StoreKit/RevenueCat: buy/cancel/pending/interrupted fulfillment, restore, duplicate callbacks and wrong-life/slot recovery. Mocked IAP passes are not provider proof. |
| A19 | P1 before release | Ads/consent/entitlements | Reward success/cancel/no-fill/offline, exactly-once grant, remove-ads, consent/ATT choices and banner behavior on the same signed build. |
| A20 | P2 | Motion and sound | Record actual gameplay; check reduced motion throughout custom overlays, haptic frequency, scene/background behavior, seven cues, mute/silent switch/headphones/call interruptions and missing-backend fallback. Audio needs a compatible native binary. |
| A21 | P2 | Performance and long saves | Measure startup, weekly tick, scrolling, modal latency/memory on an older supported device with early and late/multi-generation saves; revisit large logs/collections. Node/static timings are not frame-time evidence. |
| A22 | P2 | Loading/error/offline/modal matrix | All 79 named overlay components plus inline overlays: loading, empty, locked, insufficient funds, network failure, back/cancel, modal priority and recovery. Recheck welcome-back -> daily reward on device and cold deep links. [Inventory](release/evidence/whole-app-audit-2026-09-26/modal-inventory.md). |

## 4. Maintenance and release preparation

| ID | Priority | Remaining work | Boundary |
| --- | --- | --- | --- |
| O01 | P3 | Fix the two static audit warnings: factory-bypassing GameState assertion in `saveInSameHandlerPersistsAction.test.ts:153`; hand-built WeekContext/preRolls in `educationExamLifeSalt.test.ts:24`. | Preserve behavior/coverage; do not weaken the scanners. |
| O02 | P3 | Review legacy pre-save timeouts after the same-handler save fix, and 698 existing lint warnings by owning subsystem. | Remove a delay only after proving it redundant; broad lint suppression is not a fix. |
| O03 | P2 before release | Reconcile release ledger and historical task text: queue says binary 2.13.0 while package is 2.15.0; old remaining-work report still has superseded counts and a fixed slot-switch investigation. | Use this dated audit for current findings; refresh candidate/store identity read-only before any release decision. Do not infer live store version from local files. |
| O04 | P2 before release | Assemble exact candidate SHA/version/build, native evidence, current support/privacy/store copy, final native screenshots, release notes and rollout/recovery plan. | Main merge publishes OTA. No merge, paid build, store mutation/submission or community message is authorized by this audit. |

## 5. Screen-family coverage and next focused journey

All five primary tabs and all 19 app entry screens were opened and captured on
375x667 Chromium at 2x. There were **zero browser page errors and zero document
horizontal overflows** across those 24 entries. This does not certify text fit,
scroll position, touch geometry or every nested view. Earlier phone/tablet entry
evidence remains linked in `release/evidence/game-polish-2026-09-26.md`; this pass
also made new nested/onboarding/transaction captures.

| Family | What was actually inspected this pass | Next deeper case |
| --- | --- | --- |
| Main menu / slots / onboarding | Fresh menu, Quick Play into an ordinary $1,500 life, scenario picker, portrait and custom creator | Perks completion, scenario matrix, old slot upgrade |
| HUD / navigation | Approved circles retained; hit-test trial can reach Shop on all five tabs | Native safe areas and gem/cash target separation |
| Home | Identity, first-job guidance, goals, first weekly feedback | Decisions, completed goals, long names, negative/high wealth |
| Work | Career board, raw elite requirements, Apply -> pending -> hired after Next week | Wage, promotion, rejection, crime and prison |
| Apps | All 19 launched through the real launcher on the QA fixture | Ownership combinations, locks, cold deep links |
| Life | Vitals, health/action/cost source, Family launcher geometry | Actual activities, treatments, family states |
| Profile | Hero/progression hierarchy and life-clock source | Achievements, legacy, prestige/death |
| Spark | Swipe entry, NPC card/art and internal tabs | Match/chat/relationship/paid features |
| Contacts | Personal list and expanded Mom actions | Favor, debt, partner/family outcomes |
| DeepMail | Empty inbox and navigation | Populated mail, filtering, bill/payslip actions |
| Pulse | Feed, repeated content and inconsistent player face | Posting, notifications/DMs, live stream |
| Stocks | Market/sector density and AAPL detail | Quote/trade/order/portfolio history |
| Bank | Statement, Accounts, deposit dialog; $100 success and `1,000` -> $1 failure | Withdraw/loans/cards/taxes/transfer |
| Pets | Empty state and shop catalog | Adopt/feed/vet/compete |
| Education | Catalog and real enrollment quote/class selection modal | Enroll through graduation and loan repayment |
| Hustle | Empty state, business-type picker and prerequisites; campaign race reproduction | Found/run/grow/sell a company |
| Crypto | Market entry, regimes and navigation | Trade/mine/upgrade/history |
| Real Estate | Empty portfolio and browse CTA | Rent/buy/mortgage/occupancy/sell |
| Dark Web | Market, wallet/threat readouts and no-listing state | Vendor/job/gear/refusal/raid |
| YouVideo | Composer and Studio gear list | Record/upload/gear/reload |
| Streaming | Dashboard, older art, CTA/hierarchy | Go live, payouts, equipment, interruption |
| Travel | Destinations and empty Passport | Buy passport, depart/return, business trip |
| Political Office | Office ladder and schema review | Election/policy effects and refusal |
| Statistics | Overview plus FIRE helper reproduction | Planning inputs, late-life history/records |
| Garage | Licence gate and dealership | Licence/purchase/finance/insurance/sale |
| Luxury | Catalog, upkeep and collection summary | Buy/own/verb/sell and affordability |
| Settings / shop / support | Current source, prior current-day captures, save-exit tests | Native provider actions, restore, offline support links |

The isolated unlocked fixture was developer-funded ($1M), then bought a computer
for $5,000, leaving $996,500. It is QA evidence, not earned progression. Fresh-life
screens and the hiring/week journey used an ordinary Quick Play start. Browser
DOM text can include mounted inactive tabs; screenshots and source were used to
interpret it. Do not count every raw DOM control-size entry as a visible defect.

## 6. Verification and exclusions

- Latest inspected code SHA `9a4422c6`: GitHub coverage, preflight, quality and update
  checks all PASS. Full CI: **822 suites / 10,016 tests / 308 snapshots passed**;
  17 suites / 32 opt-in tests skipped. Coverage: 60.78% statements, 43.03% branches,
  52.70% functions, 62.15% lines. CodeRabbit skipped review because PR is draft;
  Supabase Preview skipped. Green tests did not detect D01-D03/D05.
- Five-domain static audit: exit 0, 57 pass checks, 2 warnings, no scanner high/
  critical findings. The independent prestige reproduction overrides any inference
  of global save safety from that scanner. [Output](release/evidence/whole-app-audit-2026-09-26/static-audit.txt).
- Focused save/IAP: 6 suites / 23 tests, exit 0, 12.398 s.
- Focused canonical weekly/education/business/claims/relationship/FIRE: 6 suites /
  31 tests, exit 0, 12.817 s. Existing FIRE tests omit the life-start baseline.
- Three additional defect reproduction checks succeeded; none is a claimed fix.
- Browser entry scan: 24 entries, no page errors or document horizontal overflow.
  Eight nested app views opened; new menu/creation and finance interaction captures
  are in the gallery. One initial Deposit automation lookup timed out because the
  control lacks button role; retry by visible text performed the transaction.
- No full local suite rerun for this documentation-only audit. Exact-head full CI
  and focused behavioral evidence are above. No runtime source or dependencies
  changed, no native binary built or published.
- Native VoiceOver/Larger Text, keyboard, audio, real purchases, ads, cloud provider,
  OS termination and old-installed-save upgrades remain **UNREACHED**.

Do not reopen the already-fixed same-handler save loss, Settings save-slot exit,
replay timeout, stalled-writer ownership, or the HUD circle edge fix. Current
focused tests and existing evidence support those corrections. D01 is a distinct
prestige writer, not evidence those previous fixes were undone.

## Recommended execution order

1. **Fix D01 first:** mutex-owned, durable prestige transition and recovery tests.
2. Fix D05/D06 amount parsing and accessible confirmation; then D02/D04/D12
   life-relative, truthful finance/progression readouts and D03 committed feedback.
3. Unify avatar identity and accessible primitives (D07-D11), readable requirement
   names (D14), then compact Home/Work/Life/Profile/creator layouts (V01-V05).
4. Finish secondary-app art, labels and density (V06-V18), using the journey table
   to test both successful and rejected actions with current real state.
5. Obtain the separately authorized signed candidate and close A16-A21 provider/
   device gates; complete candidate/store evidence before any production action.

Next concrete task: finish the HUD gem-plus hit target in D09, then D13-D14 week/requirement labels. Prestige, finance and accessible-control follow-through is recorded above.
