# Bug Fix Plan — Player Bug Report Batch (2026-07-03)

Source: Discord #bug-reports thread ("Bug hi") + written report. Every issue below has been
traced to a root cause in code. Issues are grouped into phases ordered by player impact.
Effort: S = small (≤ ~1h), M = medium, L = large.

Two systemic findings explain most of the batch:

1. **Orphaned canonical actions.** Several fully implemented, tested actions are no longer
   reachable from the UI after redesigns: `haveChild`, `proposeMarriage` (ring flow),
   `addWorker`/`buyCompanyUpgrade`, `withdrawCashFromAccount`, wedding execution. The UI
   calls simplified stubs (or nothing), which produces "feature is broken" symptoms while
   the real logic sits unused.
2. **Unguarded notification surfaces.** The blue info banners render even when `message`
   is empty, and two incompatible `showInfo(...)` signatures exist, so blank banners appear
   instead of event content.

---

## Phase 1 — Game-breaking / high impact (do first)

### 1.1 Unable to have kids (game-breaking) — **S**
- **Root cause:** The FamilyTab "Try for Baby" button is a stub showing a hardcoded
  "Coming Soon" alert (`components/FamilyTab.tsx:163-181`). The real `haveChild(partnerId)`
  action (`contexts/game/SocialActionsContext.tsx:218-318`) is fully implemented, sets
  pregnancy state, is exported from context, and passes tests
  (`__tests__/stress/marriageFlow.stress.test.ts:464-507`) — but nothing in the app calls it.
  Pregnancy progression + birth (`contexts/game/actions/weekly/applyPregnancyProgression.ts:58-120`,
  `GameActionsContext.tsx:914-920`) work once `isPregnant` is set.
- **Fix:** Destructure `haveChild` from `useGame()` in `FamilyTab.tsx` and call it from the
  button (relationship id from `FamilyTab.tsx:202-204`), removing the Coming Soon alert.
  Also allow the flow for `type === 'partner'` (action already supports it), not only spouse.
- **Tests:** component test that the button invokes `haveChild`; existing pregnancy tests cover the rest.

### 1.2 Empty blue banners when advancing weeks fast — **S–M**
- **Root cause:** Neither banner surface guards empty text: `components/ErrorMessage.tsx:108`
  and `components/ui/ToastNotification.tsx:187-193` render `<Text>{message}</Text>`
  unconditionally. Two incompatible `showInfo` signatures exist —
  `UIUXContext.showInfo(id, message, title)` (`contexts/UIUXContext.tsx:40,165`) vs
  `ToastContext.showInfo(message, duration)` (`contexts/ToastContext.tsx:123-128`) — and
  several call sites pass optional `result?.message`
  (`contexts/game/SocialActionsContext.tsx:148,189,351`), so an undefined message renders as
  an icon-only blue banner. Fast week-advance flushes a burst of these
  (`GameActionsContext.tsx:1745-1757`; flooding already documented at `UIUXContext.tsx:56-63`).
- **Fix:**
  1. Drop blank notifications at the source: early-return in `UIUXContext.showError`
     (`UIUXContext.tsx:134-156`) and `ToastContext.showToast` (`ToastContext.tsx:59-96`)
     when there is no non-whitespace title/message.
  2. Defensive `return null` in `ErrorMessage`/`ToastNotification` when there is no text.
  3. Rename the UIUX variant to `showInfoBanner(id, message, title)` to kill the
     signature footgun; audit `showInfo('X', result?.message)` call sites.
- **Tests:** extend `capErrorBanners` unit tests to assert blanks are dropped.

### 1.3 Only event ever seen is "coworker coffee" — **S–M (tuning)**
- **Root cause:** Not a data bug — the ~150+ weekly event templates are well-formed and
  `WeeklyEventModal` renders them fine. The cadence is tuned to near zero:
  `EVENT_FREQUENCY_MODIFIER = 0.06`, `MAX_EVENTS_PER_WEEK = 1`
  (`lib/events/engine.ts:2994-2995`), so a typical template chance is ~0.5%/week after the
  `baseEventChance` gate (`engine.ts:3200`) and cooldowns. The pity system
  (`engine.ts:3159-3168,3224-3250`) always picks the highest-weight eligible event, so
  players see a tiny rotation. "Coworker coffee" is actually a **LifeMoment**
  (`lib/lifeMoments/lifeMomentGenerator.ts:12-51`, only 4 templates), a separate modal that
  takes priority — which is why it's the one thing seen with content.
- **Fix:** Raise `EVENT_FREQUENCY_MODIFIER` / `baseEventChance`; make pity selection
  weighted-random among eligible events instead of strict highest-weight; verify the
  modifier isn't effectively double-applied against `baseEventChance`.
- **Tests:** simulate N weeks in `lib/events/__tests__/engine.test.ts` and assert an
  expected events-per-year band (add as a regression guard for tuning).

### 1.4 Incurable/terminal diseases far too common (terminal heart disease at 21) — **S–M**
- **Root cause (several compounding):**
  - `generateRandomDisease` (`lib/diseases/diseaseGenerator.ts:208-261`) **normalizes**
    disease chances into a distribution and always picks one — the tiny per-disease
    `baseChance` values decide *which* disease, not *whether*. Past the narrow
    healthy-young gate (`:226-232`, requires health > 80 AND age < 30), a disease lands
    every 4-week cooldown (~13/year).
  - No `minAge` gating exists anywhere: Heart Disease (terminal, `weeksUntilDeath: 15`,
    `curable: false` — `lib/diseases/diseaseDefinitions.ts:264-289`), Stroke, Organ
    Failure, Kidney Disease are all eligible from age 0 (youth only *reduces* weight,
    `diseaseGenerator.ts:148-161`).
  - No cap on concurrent serious conditions (`applyDiseases.ts:118-149` just pushes).
  - Heart Disease is terminal **and** incurable: all three treatment paths only cure
    `curable === true` (`ItemActionsContext.ts:345,389,436-437`), so the countdown
    (`applyDiseases.ts:266-286`) is unstoppable — an unwinnable state.
- **Fix (in order of leverage):**
  - A: Gate occurrence on total absolute chance (e.g. `Math.random() < totalChance`)
    before the weighted pick in `diseaseGenerator.ts:244-258`.
  - B: Add optional `minAge` to `DiseaseTemplate` and set realistic thresholds (40-60) on
    Heart Disease/Stroke/Organ Failure/Kidney Disease/Dementia/Arthritis/Diabetes;
    filter in the generator.
  - C: Cap concurrent non-mild conditions (1-2) at admission in `applyDiseases.ts:118-149`.
  - D: Make Heart Disease curable (or drop its `weeksUntilDeath`) so terminal+incurable
    traps can't occur.
  - E: Widen the healthy-young escape hatch and/or lengthen the 4-week cooldown.
- **Tests:** update `__tests__/lib/diseases/*.test.ts`, `__tests__/stress/diseaseLifecycle.stress.test.ts`;
  regenerate `subsystemEquivalence` snapshot.

### 1.5 Tab bar blocks buttons (Home/Work/Computer/Market/Health) — **S–M**
- **Root cause:** The tab bar is absolutely positioned over content
  (`app/(tabs)/_layout.tsx:79-95`). Main tab screens reserve space via
  `getTabBarSafePadding` (`utils/scaling.ts:159-161`), but standalone computer sub-apps
  rendered by `app/(tabs)/computer.tsx:330-360` don't — e.g. `OnionApp.tsx:384-386` pads
  only `scale(40)` vs the bar's `scale(70)+inset`, so bottom buttons sit under the bar.
  iOS bar height also omits the safe-area inset (`_layout.tsx:88-94`).
- **Fix:** Apply `paddingBottom: getTabBarSafePadding(insets.bottom)` in `OnionApp.tsx:386`
  and audit/patch all ~15 standalone computer sub-apps (BitcoinMiningApp, GamingApp,
  StatisticsApp, bank apps, etc.). Include `insets.bottom` in the iOS tab-bar height.
- **Tests:** lint-style regression test asserting standalone sub-apps use `getTabBarSafePadding`.

### 1.6 Dark web jobs stuck at "0w stage 1" — **S**
- **Root cause:** Progression logic is correct and player-driven ("Run Stage" →
  `attemptJobStage`, `lib/darkweb/operations.ts:257-367`, tested). Three UX failures make
  it look frozen: (1) the "Run Stage" button is physically under the tab bar (issue 1.5),
  so taps hit the Health/Market tabs; (2) low energy silently no-ops with only a log
  (`contexts/game/actions/CrimeActions.ts:124-128`); (3) failed rolls reset to stage 0 and
  3 failures silently remove the job (`operations.ts:291-306`).
- **Fix:** 1.5's padding fix restores the button; add a visible toast/alert for the energy
  gate and for stage failure/job loss. Optionally decide whether stages should also
  auto-advance weekly (design choice — currently intentional manual play).
- **Tests:** add a test that `runJobStage` surfaces feedback when energy-blocked.

---

## Phase 2 — Economy: banking & company

### 2.1 Savings accounts pay no APR — **M**
- **Root cause:** No accrual step exists. `runWeeklyBankingTick` (`lib/banking/weeklyTick.ts:129-173`)
  never reads `baseAPR`; only the legacy scalar `bankSavings` earns interest
  (`applySavingsInterest.ts:51-83`) and flows to the `savings-default` mirror. Accounts
  opened via `openAccount` (`lib/banking/operations.ts:150-174`) store `baseAPR` that the
  UI advertises (`AccountRow.tsx:55-59`) but nothing ever pays.
- **Fix:** Add `accrueAccountInterest(banking, currentWeek)` in `operations.ts`, called as
  a new step in `runWeeklyBankingTick`; skip `MIRRORED_ACCOUNT_IDS` to avoid double-paying;
  credit `balance * baseAPR / 52` weekly (reuse the soft-cap pattern from
  `applySavingsInterest.ts:65-79`). CDs/locked accounts still accrue.
- **Tests:** `lib/banking/__tests__/weeklyTick.test.ts`, `operations.test.ts` (APR fixtures exist).

### 2.2 Can't withdraw from savings / money market — **S**
- **Root cause:** Withdraw logic is implemented and tested
  (`operations.ts:95-121`, `BankingActions.ts:78-110`) but unreachable: `AccountRow` has a
  single `onPress` bound to deposit only (`AdvancedBankApp.tsx:219`, `BankApp.tsx:145`);
  the withdraw modal exists but `setWithdrawTarget` is never called (dead code silencers
  at `AdvancedBankApp.tsx:544`, `BankApp.tsx:371`).
- **Fix:** Give `AccountRow` a Deposit/Withdraw/Close action sheet (shared fix with 2.3);
  wire withdraw to `setWithdrawTarget(acct)`; hide for mirrored/locked accounts.

### 2.3 Duplicate accounts; no way to close an account — **M**
- **Root cause:** `openAccount` appends unconditionally (`operations.ts:150-174`) with no
  per-type uniqueness check, and no `closeAccount` exists anywhere (confirmed by grep).
- **Fix:** Guard duplicate account types in `openNewAccount` (`BankingActions.ts:138-164`);
  add `closeAccount(banking, accountId)` to `operations.ts` (refuse while `lockUntilWeek`
  active; return residual balance via `applyMoneyDelta`; block mirrored IDs); expose Close
  in the `AccountRow` action sheet from 2.2.
- **Tests:** `operations.test.ts`, `__tests__/banking/mirrorAccountExploit.test.ts`.

### 2.4 Auto-Pay rules can't be deleted / Budget tab useless — **S + M**
- **Root cause (auto-pay):** Bill-pay rules DO have a working delete (`BillPayRow.tsx:59-63`,
  wired in both apps → `removeBill` → `removeBillPayRule`). What's missing is the
  pause/disable toggle (`onToggle` supported by `BillPayRow` but never passed) — and a
  second, fully orphaned automation engine (`lib/automation/`, rules executed weekly at
  `GameActionsContext.tsx:1839` with **no add/remove functions and no UI**). Verify on a
  current build whether the reporter's undeletable rules are the automation kind; if the
  delete button is simply hidden under the tab bar, 1.5 fixes it.
- **Root cause (budget):** The Budget tab only charts `banking.budgetSpend`, which is fed
  solely by bill-pay and loan payments; the general `recordCategorizedSpend`
  (`BankingActions.ts:370-380`) has zero callers, so the tab is empty for most players.
- **Fix:** Pass `onToggle` + add a `toggleBill` action (S). Wire `recordCategorizedSpend`
  into real outflows (rent, shopping, lifestyle, taxes) so the tab shows actual spending (M);
  either add per-category budget targets or remove the tab.

### 2.5 Company: flat $2k income; can't hire employees; managers don't count — **M**
- **Root cause (shared):** After the Hustle UI redesign, the canonical company mutators
  are orphaned. `weeklyIncome` is hardcoded to 2000 at creation
  (`contexts/game/actions/CompanyActions.ts:93-94`) and the only things that scale it —
  `addWorker` (`contexts/game/company.ts:192`) and `buyCompanyUpgrade`
  (`CompanyActions.ts:122`) — have no UI call sites. `CompanyDetailScreen.tsx:129-175`
  only offers the named-hire pipeline (`hireCandidate`, `HustleActions.ts:203-292`), which
  never increments `company.employees`, so headcount shows 0 and income never grows.
  Cash comes from `lib/economy/passiveIncome.ts:265-311`, which reads only `weeklyIncome`.
  There is no product-price concept at all.
- **Fix:**
  1. `hireCandidate`/`fireNamedHire` increment/decrement `company.employees`.
  2. Re-expose generic staff hiring (`addWorker`/`removeWorker`) and `buyCompanyUpgrade`
     in `CompanyDetailScreen` so the existing income-scaling math is reachable.
  3. Vary `baseWeeklyIncome` by industry at creation.
  4. Display `employees + namedHires.length` in `DashboardScreen.tsx:41,111` and
     `CompanyDetailScreen.tsx:111-113,124`.
- **Tests:** `__tests__/stress/company.stress.test.ts` already assumes employee-driven
  income multipliers — currently unreachable via UI; add UI-wiring coverage.

### 2.6 Market share & brand have no gameplay effect — **M**
- **Root cause:** `marketSharePercent` and `brand.score` are computed each tick
  (`lib/business/hustleTick.ts:128-145,207-208`) but nothing in the revenue path reads
  them — `passiveIncome.ts` only reads `weeklyIncome`. Brand feeds IPO share price only.
- **Fix:** In the `passiveIncome.ts` company loop (~`:269-303`), multiply income by a
  clamped brand/market-share factor from `state.hustleApp.companies[company.id]`, e.g.
  `1 + (brand.score - 50)/200 + marketSharePercent/200`. This also helps break the flat-$2k
  symptom. Add balance coverage in `lib/economy/__tests__/passiveIncome.test.ts`.

---

## Phase 3 — Relationships & marriage

Systemic context: two parallel marriage systems exist. System A (canonical, tested):
`proposeMarriage(ringId)` → `planWedding` → `executeWedding`
(`contexts/game/actions/DatingActions.ts`) with a full ring catalog
(`lib/dating/engagementRings.ts`). System B (what the UI actually calls):
`proposeToPartner`/`moveInTogether` in `GameActionsContext.tsx:3181-3269` — flat $5,000,
no ring, no wedding, never reaches `type: 'spouse'`. Converging the UI onto System A
resolves 3.2 and most of 3.3 structurally.

### 3.1 Multiple partners: can propose to and move in with several — **M**
- **Root cause:** No exclusivity gate anywhere: `promoteMatchToRelationship` appends
  partners unconditionally (`SparkActions.ts:455,490`); `proposeToPartner` only validates
  the target (`GameActionsContext.tsx:3181-3205`); `moveInTogether` never checks an
  existing cohabitant (`:3226-3265`); same gap in canonical `proposeMarriage`
  (`DatingActions.ts:288,337`). A stress test even documents the bigamy
  (`marriageFlow.stress.test.ts:569-577`).
- **Fix:** Add `hasCommittedPartner(state, exceptId?)` helper (true if any relationship is
  spouse / has `engagementWeek` / has `livingTogether`); enforce in all four call sites.
  Decide: allow casual multi-dating but block commitment (engagement/move-in/marriage) —
  matches existing test comment intent. Update the stress test expectation.

### 3.2 No ring option when proposing — **M**
- **Root cause:** Ring catalog + success math fully exist (`engagementRings.ts`:
  `ENGAGEMENT_RINGS`, `getAffordableRings`, `calculateProposalSuccessRate`) and
  `proposeMarriage(ringId)` charges the ring and applies its bonus — but no component
  references any of it; the UI (`ContactsApp.tsx:188`, `FamilyTab.tsx:106`) calls the flat
  $5k `proposeToPartner`.
- **Fix:** Add a `RingSelectionModal` (mirror `WeddingPlanningModal`) listing affordable
  rings with per-ring success rate; rewire both call sites to `proposeMarriage`; make
  `proposeToPartner` delegate (or delete it). Reconcile score thresholds (60 vs 80).

### 3.3 Contact title stays "Partner" after proposal/marriage — **S**
- **Root cause (3 parts):** (a) `ContactsApp.tsx:222` renders raw `r.type` instead of the
  aggregator's correct label/tags (`lib/contacts/aggregator.ts:84-91`); (b)
  `IdentityCard.tsx:195` uses `find(spouse || partner)` so an earlier partner masks a
  spouse; (c) System B's proposal only sets `engagementWeek` and says "She said YES!" —
  the player is never actually married, so "Partner" is technically true. Also,
  `applyScheduledWedding.ts:74-83` sets `type:'spouse'` but forgets `family.spouse`
  (unlike `executeWedding`), which breaks downstream gates like `haveChild`'s spouse path.
- **Fix:** Derive stage-aware labels (Spouse/Fiancé(e)/Partner) — ideally reuse the
  aggregator's `subtitle`/`tags`; prefer-spouse in `IdentityCard`; set `family.spouse` in
  `applyScheduledWedding`; and land 3.2 so marriage is actually reachable from the UI.

### 3.4 Move-in requires a property — confirmed working as intended
- Enforcement at `GameActionsContext.tsx:3240-3260` (own+occupy or rent). No change; noted
  for the release notes reply to the reporter.

---

## Phase 4 — Small fixes

### 4.1 Education starts with a failing business_degree — **S**
- **Root cause:** Scenario seeding pushes a completed education **without a `gpa`**
  (`src/features/onboarding/gameStateBuilder.ts:195-197,209-220`; 'College' →
  `business_degree` via the map at `:84-86`). `EducationRow.tsx:34-36` defaults missing
  GPA to 0.0 → `gpaBand(0)` → red "Failing" badge on a completed degree.
- **Fix:** Seed `gpa: 3.0` (and a sane `duration`) in both builder branches; defensively
  show a neutral "Graduated" badge when `completed && gpa == null` in `EducationRow`.
- **Tests:** extend `__tests__/onboarding/gameStateBuilder.test.ts:239-243` to assert GPA.

---

## Suggested implementation order

| Step | Issues | Why |
|---|---|---|
| 1 | 1.1 kids, 4.1 education, 1.6 darkweb feedback | Tiny diffs, game-breaking or trust-destroying |
| 2 | 1.5 tab-bar padding audit | Unblocks many "broken" buttons incl. dark web |
| 3 | 1.2 empty banners, 1.3 event cadence | Core loop feel |
| 4 | 1.4 disease rebalance | Mortality/prestige balance |
| 5 | 2.1–2.4 banking | Interest, withdraw, close, toggle |
| 6 | 2.5–2.6 company economy | Wiring + balance |
| 7 | 3.1–3.3 relationship convergence | Largest structural change; do last, on green tests |

Each step should ship with its listed test updates; the `subsystemEquivalence` snapshot
will need regeneration after steps 4 and 7.
