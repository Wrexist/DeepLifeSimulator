<!-- `tasks/todo.md` is a single active-plan file that each branch rewrites. The
     ACTIVE plan is first; finished plans are kept below it rather than dropped,
     so a merge finds complete records instead of a diff. -->

# Prestige balance pass + incomplete-feature audit (owner request, 2026-08-23)

Owner: "fix this the best way and balanced... also audit for more bugs and
features that incomplete or not working."

## A. Income cap — from silent hard clamp to a soft cap (balanced)

- [x] A1. Replace the hard `min(1.5, sum)` with: full effect to +50%, excess at
      25% effectiveness, absolute ceiling 2.0x. Fully stacked catalogue
      (3.35x raw) lands at ~1.96x — every purchase now grants SOMETHING, the
      snowball stays tamed (was heading to 3.35x uncapped).
- [x] A2. Shop banner + card notes read the new shape automatically via
      `incomeGainFromPurchase`; update copy to explain diminishing returns.
- [x] A3. Update the pinned tests (`incomeCapVisible`, `prestigeShopEffects`).

## B. The three inert bonuses — wire real, cost-proportionate effects

- [x] B1. `early_item_access` (4,000, rare) → item shop prices −15%. Charge and
      display through ONE helper (§4.4 advertised-vs-actual).
- [x] B2. `early_real_estate` (6,000, epic) → property purchase prices −10%.
- [x] B3. `auto_manage_properties` (5,000, rare) → rental income +15%.
- [x] B4. Update catalogue descriptions, empty the inert registry (leave the
      mechanism), re-enable purchase, update tests.

## C. Parallel audit (agents)

- [x] C1. Every remaining prestige bonus id: verified wired with a real call
      chain, or flagged.
- [x] C2. Gold upgrades + onboarding perks: advertised vs actual.
- [x] C3. Incomplete features repo-wide: empty branches, uncalled predicates,
      TODO/stub systems.
- [x] C4. Verify agent findings myself before fixing (lessons.md rule).

## C-results — what the three agents found and what was done

Fixed this pass (each verified against source before touching):
- `starting_real_estate` (12,000 pts) DEAD — filtered an always-empty state
  array; now grants the cheapest catalogue property, built like a purchase.
- `achievement_progress_multiplier` (4,000×2) DEAD, zero callers — re-wired as
  +20%/level on the prestige points achievements pay.
- `skill_gain_multiplier` (3,000) DEAD — wired into pursuit XP beside the gold
  skill_mastery upgrade.
- `social_master` + `reputation_gain_multiplier` bypassed by the two
  highest-volume relationship paths — now applied on dates and gifts;
  reputation_gain_multiplier's copy corrected to the relationship wiring it
  has always had.
- Education speed quantization (ceil) — fractional deterministic roll; the
  paid tiers are distinguishable again.
- `familyBusinesses` dropped by the prestige RESET path (killing
  legacy_business income) — carried now, without a generation increment.
- Repurchase sink: 11 boolean bonuses purchasable forever at flat cost for
  zero effect → maxLevel: 1.
- `SKILL_BOOST` IAP ($12.99) — REAL-MONEY no-op (looped the deleted hobbies
  system) → re-pointed at pursuits, +3 levels each, honest copy.
- `applyPerkEffects` + `buyStarterPack`/`buyGoldPack`/`buyRevival` — dead code
  shaped like wiring for real SKUs → deleted, pinned deleted.
- Policy votes (`effects.policy`) never enacted the bill → wired into
  resolveEvent via calculateActivePolicyEffects.
- Federal Judge required `law_degree` (an id in no catalogue) → `law_school`.
- Real Estate Hustler's advertised driver license never granted →
  `hasDriversLicense` flag set from the scenario item.
- `requiresItem` discovery gate silently passed unknown ids → blocks now.
- Legacy buffs (mentor/luckyCharm): three consumers, zero writers → two new
  legacy-shop nodes (A Family Mentor 250, The Heirloom Charm 220) stamp timed
  buffs on the heir.
- Copy honesty: Stable Life, Eventful Life, astute_planner, crime_boss,
  landlord, UNLOCK_ALL_PERKS, PrestigeInfoModal's hand-copied effect strings.

Left to the owner (deliberately not done):
- `starting_energy` / the health/happiness/energy halves of `perfect_start`
  and `starting_stats_*` are no-ops on the RESET path because a fresh life
  already starts at 100 — they bite on the heir path and via fitness. Fixing
  would mean lowering baseline start stats (a big balance change) or
  re-designing the bonuses.
- Scenario `rewards.achievement`/`rewards.title` — data with no code behind
  it, invisible to players (cards advertise gems only). Wiring it is content
  design.
- `FEATURE_FLAGS.weeklyEvents`/`analytics`/`bootBreadcrumbs` have zero
  readers; `analytics` is documented in CLAUDE.md as a deliberate hard-disable
  so left alone.
- Legacy shop Name-branch reputation totals can overflow the 100 clamp
  (documented in the file header as accepted).
- Perk income multipliers remain unscoped by source (cards now say so).

## D. Verify + ship

- [x] D1. Full suite, type-check both trees, lint, routes.
- [ ] D2. Commit + push to claude/new-session-17ah17.

---

# Prestige shop — tester bug report (BBQ, 2026-08-23)

Reported: "Prestige shop does not work. The unlock all careers from start, start
with all educations completed, start companies without education needed, wealth
master synergy does not apply to revenue, multiplier income benefits cap at 50%
making multiple income buffs moot and wasteful which applies to bonuses not yet."

## Verified findings (repro'd in a scratch test before writing any fix)

- [x] F1 `early_education_access` (3,000 pts, "Start with all educations completed")
      grants NOTHING. `applyUnlockBonuses` maps over `gameState.educations`, which
      is `[]` for every new life — the list only grows when the player ENROLLS
      (`lib/education/operations.ts`). Mapping an empty array completes nothing.
- [x] F2 `legacy_education` (15,000 pts, "Future generations start with all
      educations") is the same code shape in `applyLegacyBonuses` — same result.
- [x] F3 `early_career_access` (5,000 pts, "Unlock all careers from start") lifts
      ONLY the `education` requirement. `fitness` and `items` still gate, so the
      advertised "all careers" is false for 8 of the 15 education-gated careers.
- [x] F4 `synergy_wealth_master` (18,000 pts) never shows the income-cap warning.
      `isIncomeBonusWasted` probes `getIncomeMultiplier([bonusId])` on an EMPTY
      list to decide "is this an income bonus"; the synergy needs 2+ income
      bonuses to do anything, so the probe returns 1.0 → "not an income bonus" →
      no warning, while the cap eats it whole. This is the tester's "wealth master
      synergy does not apply to revenue" AND "which applies to bonuses not yet".
- [x] F5 `early_company_access` — NOT reproduced. Wired correctly in all three
      gates (`company.ts`, `CompanyActions.createCompany`, `CreateCompanyScreen`).
      Covered by a regression test rather than a fix.

## Plan

- [x] 1. Extract the education programme catalogue out of
      `components/mobile/EducationApp.tsx` into `lib/education/programs.ts`
      (`lib/` may not import values from `components/`, CLAUDE.md §5).
- [x] 2. F1/F2: complete every catalogue programme from the catalogue, not from
      the player's empty enrolment list. One shared helper for both bonuses.
- [x] 3. F3: one `meetsCareerRequirements` helper in `lib/careers/`, used by both
      `work.tsx` and `JobActions.applyForJob`, where `early_career_access` lifts
      the whole `CareerRequirements` gate. Kills the UI/action drift too.
- [x] 4. F4: `isIncomeBonusWasted` must ask "does this bonus enter the income sum
      AT ALL" against the UNCAPPED multiplier, so a prerequisite-gated bonus is
      classified correctly. No hardcoded id list.
- [x] 5. Tests for each, plus the F5 regression test.
- [x] 6. type-check + full prestige/career/education suites.

## Deliberately NOT changed (owner's call — flagged in the report)

- The `INCOME_MULTIPLIER_CAP = 1.5` itself. CLAUDE.md documents it as deliberate
  anti-snowball design. The bug was the shop being silent about it, not the cap.
- Blocking a zero-effect purchase. `prestige_bonuses_all` measures completion
  against `PURCHASABLE_PRESTIGE_BONUSES`; refusing the sale would make a
  25,000-point achievement uncompletable — the exact trap the existing comment
  in `prestigeBonuses.ts` warns about.
- `career.requirements.reputation` is enforced NOWHERE (2 careers carry it).
  Adding the gate would newly BLOCK existing players, so it stays as-is.


---
---

# Previously completed plans (kept for the record)

<!-- Two plans, both finished, both landed on 2026-08-22. `tasks/todo.md` is a
     single active-plan file that each branch rewrites, so a merge finds two
     complete records rather than a diff. Neither is dropped: the income work
     below is this branch's, the subscription-funnel work follows it. -->

# Plan — Work tab: the ladder question, and three bugs found answering it — 2026-08-22 — DONE

## The ladder question: already handled, my earlier claim was wrong

I told the user BBQ's save "can't reach the capstones without a migration".
Not true. `repairGameState` (`utils/saveValidation.ts` ~line 904) already
reconciles every saved ladder against the catalog on load — it adopts the
catalog `levels` whenever the catalog is LONGER, preserves level/progress/
raiseMultiplier, and clamps the level index. It runs on every load path
(`loadGame` and CloudSync both go through `hydrateLoadedState` → repair), and
it is covered by `__tests__/actions/careerPromotionGating.test.ts`.

Verified by probe: a 6-rung surgeon save comes back with 8 rungs, level index 4
("Surgical Director") intact, repair logged. So BBQ's "Lv 5/6" is simply a
build that predates the capstone rungs; the next update fixes it with no work
from us. Nothing to do — and the git history here is a shallow clone rooted at
0a8fd34, which is why `git log -S` appeared to date both changes to one commit.

## What the search DID turn up — all three in the reported family

- [x] **A. The "Current Job" hero shows base pay next to the raise percentage.**
      `work.tsx:952` `currentJobSalary = currentJobLevel?.salary` — raw base,
      rendered at :1009 as `$13,000/wk · Lv 5/8 · +100%`. It prints the base and
      the premium side by side without applying one to the other. This is the
      most prominent income surface on the screen, and the previous commit made
      it worse by fixing the card below it and not this. → `paidWeeklyCareerSalary`.

- [x] **B. Three careers render nowhere.** `work.tsx:917`
      `advancedIds = ['politician', 'celebrity', 'athlete']` excludes them from
      "Standard Careers", but the "Advanced Careers" section iterates
      `ADVANCED_CAREERS`, which is `ceo · research_scientist ·
      creative_director · investment_banker · surgeon` — a different set. So
      politician, celebrity and athlete are filtered out of the only screen that
      can apply for them. All three are live content: achievements read their
      level (`achievementsData.ts`), ambitions read them (`POLITICS_CAREERS`,
      `FAME_CAREERS`), and `events/engine.ts:524` gates an event on holding one.
      → exclude the ids the Advanced section actually renders.

- [x] **C. The five real advanced careers render TWICE once applied.** They are
      pushed into `gameState.careers` on apply, so they pass the `basicCareers`
      filter and render via `renderCareerCard` (real level, real pay, "Manage
      Job"), AND again from the catalog via `renderAdvancedCareerCard` at
      `levels[0].salary` with the button "Working". For BBQ that is
      "Surgical Director $26K/wk" and "Resident $1,150/wk" on one screen — a 22x
      disagreement, which is exactly the report. → one card per career: the
      Advanced section delegates to `renderCareerCard` for a career the player
      has already applied to or holds, and keeps the catalog stub only for ones
      they have not.

- [x] D. `renderAdvancedCareerCard`'s reward is `$${salary.toLocaleString()}/wk`
      off `levels[0]` — a fourth money format with no multipliers. → same
      `formatMoney(paidWeeklySalaryForLevel(...))` as everywhere else.

- [x] E. Test + full verification.

## Verification
- `type-check` ✓ · `type-check:tests` ✓ · `lint:errors` ✓ · `check:routes` ✓
- Full Jest: **621 suites / 8136 tests pass**, 308 snapshots, 1 skipped.
- New `__tests__/economy/workTabCareerLists.test.ts` (9) — pins the PARTITION,
  not the literal: the derived id set matches the catalog, the two catalogs are
  disjoint, and every catalogued career lands in exactly one list.
- New case in `__tests__/save/hydrateLoadedState.test.ts` — the ladder question
  answered end to end. `careerPromotionGating` already covered `repairGameState`
  in isolation; what was uncovered is the step AFTER it, where this function
  merges onto `initialGameState` and could have taken `careers` from the wrong
  side and undone the repair silently. Both load paths run through here.

## Follow-up: one more, found by asking "is anything left?"
- [x] **`PoliticalApp` quoted the ANNUAL political ladder as "/wk".** The Politics
      app renders the whole 7-rung ladder with `formatMoney(salaryWeekly)}/wk`
      off `POLITICAL_CAREER.levels[i].salary`, which is annual: a President read
      **$100K/wk** against the $1,923 the tick pays, a Local Council Member
      **$800/wk** against $15. Worst instance of the three, because that ladder
      exists to weigh an office against its campaign COST — and the cost side was
      always real. Third screen to read this field raw; routed through
      `paidWeeklySalaryForLevel`, which owns the conversion. 3 tests added to
      `paidWeeklySalary.test.ts` (24 total).

## Checked and deliberately left alone
- `work.tsx:929` sorts careers by `levels[0].salary` — ordering only, never shown.
- Hustle employee salaries (`CompanyTile`, `HireEmployeeModal`, `CompanyDetailScreen`)
  are per-employee weekly wages the player sets, a different quantity entirely.
- `HealthBreakdownModal` / `HappinessBreakdownModal` / `DeathPopup` read
  `levels[level].name` — titles, not money.

## Final verification
- `type-check` ✓ · `type-check:tests` ✓ · `lint:errors` ✓
- Full Jest: **621 suites / 8139 tests pass**, 308 snapshots, 1 skipped.

# Active plan — Political Life expansion (player request, 2026-08-21)

Source: support email from a player who asked for "a focus on being a president …
campaign retirement and other positions you can have that pay, you can choose to
steal stake money, join political parties or other things that concern with
government."

What already exists in `lib/politics/`: the six-rung office ladder, elections and
re-election, scandals, PAC clean/dirty fundraising, lobbyists, policies,
alliances, government contracts, office perks. What the request names and the
game does NOT have is below.

**Not doing: monthly ticks.** The player asked for months instead of weeks. That
is story mode (v38), which shipped to TestFlight and was REMOVED after
playtesting. Rebuilding it is a reversal of a playtested decision, not a feature
request to fill — flagged to the owner instead.

## Plan

- [x] 1. Save format: five optional fields on `PoliticsState`, one carve-out
      migration, `STATE_VERSION` 46 → 47 (stub migration, no backfill, no
      `repairGameState` mirror — every default is `undefined` and every value
      would be a guess that hands out or takes away something real).
- [x] 2. `lib/politics/parties.ts` — party standing that means something.
      `partySupport` 0-100, endorsement threshold, a real cost to switching
      sides, and party-machine campaign funding the player has not paid for.
- [x] 3. `lib/politics/appointments.ts` — paid positions that are not the
      ladder: Party Chair, Ambassador, Cabinet Secretary, Federal Judge,
      Lobbyist, Corporate Board Seat. Eligibility, weekly pay, reputation and
      party-support consequences. One at a time.
- [x] 4. `lib/politics/embezzlement.ts` — divert campaign / PAC money into
      personal cash. Bounded per week, builds heat, heat feeds the EXISTING
      scandal roll so getting caught uses the machinery already there.
- [x] 5. `lib/politics/retirement.ts` — stand down voluntarily with a pension
      scaled by highest office × terms × approval, keeping the title.
- [x] 6. Wire the weekly tick: heat decay, party-support drift, embezzlement as
      a scandal driver.
- [x] 7. Wire income: appointment salary and pension through the ONE political
      income path (`getPoliticalWeeklySalary`), so the $50K/wk political
      per-source cap still binds and nothing mints money outside it.
- [x] 8. Actions in `PoliticalActions.ts`, all charge/credit in ONE updater (§4.4).
- [x] 9. A "Career" tab in `PoliticalApp` for party, appointments, embezzlement
      and retirement.
- [x] 10. Tests per module + a save round-trip test for the new fields.
- [x] 11. `npm test`, `type-check`, `type-check:tests`, `lint:errors`.

## Done

All eleven steps landed. Added after the plan was written, at the owner's request:

- [x] 12. Fix the annual-vs-weekly `/wk` mislabel across every career surface.
      `Career.levels[].salary` is WEEKLY on every ladder except `political`,
      which is ANNUAL — so a President was shown "$100,000/wk" and paid $1,923.
      One shared `displayWeeklySalary` converter, applied at six surfaces plus
      the promotion record at its SOURCE, with a source-level ratchet
      (`__tests__/careers/annualSalaryDisplay.test.ts`) so a new screen cannot
      reintroduce the raw read.

      Worth recording: an earlier survey reported that `PoliticalApp` "correctly
      divides by WEEKS_PER_YEAR". It does not — its variable was NAMED
      `salaryWeekly` and held the raw annual figure. CLAUDE.md §8 says not to
      trust a survey claim without re-reading the source; this is the second
      time that has paid.

- [x] 13. Harden to the C-9 / ARCH-1 contract. The first cut of the four new
      actions rejected from inside their `setGameState` updaters and then
      returned `{ success: true }` unconditionally — the shape
      `__tests__/refactor/updaterResultRatchet.test.ts` ratchets against, and it
      caught all four plus a `let applied` capture. Rewritten as preview/commit
      over five pure resolvers in `lib/politics/lifeOperations.ts`, which is the
      sound fix that file prescribes. The ratchet stayed at 101 — it was not
      raised.

## 2026-08-21 — follow-up pass (owner request)

- [x] Work tab lands on Career, not Street Hustle. Career is also the first
      segment now, and the one-shot effect that used to force the tab is gone
      (with Career as the default its only firing would land on the tab already
      shown, leaving a `setGameState` on every Work open for a broke player).
- [x] Three prestige bonuses verified dead and registered in
      `lib/prestige/inertBonuses.ts`, so the shop warns before taking 15,000
      points. The product call — wire, remove, or re-purpose — is the owner's
      and stays open.
- [x] Closed the blind spot that hid them: `prestigeBonusReaders` no longer
      counts a hollow reader (an empty guard body, or a predicate nothing
      calls) or a description surface as wiring.
- [x] Deleted the five uncalled helpers that made them look wired, and lowered
      the lint ceiling 842 → 797 in the same commit.
- [x] Fixed an id-collision bug found via a flaky suite: four call sites minted
      `${prefix}_${Date.now()}_${rand(0..999)}`. For pets a collision was
      silently destructive — the duplicate-id guard dropped a genuine second
      purchase, took no money, and still reported "Welcome Rex!".

# Pass 2 — the same shape, audited across the economy — 2026-08-22

Asked: does "two places compute one quantity" appear elsewhere? Yes, and the
biggest instance in the game was on the same panel as the reported bug.

## Found: "Weekly Cash Flow" was not the player's cash flow
Three costs the tick charges had NO representation in `calcWeeklyExpenses`:

| line | charged by | size |
|---|---|---|
| luxury upkeep | `applyLuxuryItems` | up to **$556,820/wk** (full collection) |
| pet food | `applyPets` | $15/wk per living pet |
| subscriptions | `applySubscriptions` | Pulse Verified Pro + Spark Premium |

…and luxury **yield** (up to $301,200/wk, credited by the same subsystem) was
missing from the income side. Net: a collector's Cash Flow was optimistic by
more than a quarter of a million dollars a week. Two further lines —
`studentLoans` and `incomeTax` — were inside the TOTAL but had no row, so the
itemisation did not add up to the figure printed above it.

- [x] `lib/subscription/billing.ts` — `isInGameBillable` / `isPrepaidThisWeek`
      moved down out of `applySubscriptions` (lib cannot import from contexts),
      plus `totalSubscriptionWeeklyCharge`. The tick imports them back.
- [x] `PET_WEEKLY_FOOD_COST` moved to `lib/pets/lifecycle.ts`, re-exported from
      `applyPets` so its importers are untouched.
- [x] `calcWeeklyExpenses` gains `luxury` / `pets` / `subscriptions`, each
      computed by calling the CHARGING subsystem's own function — never by
      restating its rules.
- [x] `IdentityCard` gains the five missing rows and the luxury-yield income
      line. Yield is added at the DISPLAY layer, not to `calcWeeklyPassiveIncome`
      — the tick consumes that function's `.total` directly (`applyIncome.ts`)
      while `applyLuxuryItems` credits the yield separately, so folding it in
      would pay it twice. A test guards that reasoning.
- [x] `__tests__/economy/cashFlowCompleteness.test.ts` — 11 tests.

## Checked, no divergence found
- Net worth — already single-sourced (`canonicalNetWorth`); its own comment
  records killing a "sixth divergent basis".
- Company income — already single-sourced (`companyIncomeFactors`).
- Political office pay — `getPoliticalWeeklySalary`, one copy, now read by the
  Politics app too (previous commit).
- Vehicles / diet / mining / rent / loans — already in the breakdown.
- `applyContentMemberships` — no direct `stats.money` mutation found; left
  alone rather than guessed at.

## Verification
- `type-check` ✓ · `type-check:tests` ✓ · `lint:errors` ✓
- Full Jest: **622 suites / 8150 tests pass**, 308 snapshots, 1 skipped.
- App boots clean in the web preview with every change in place (no page
  errors beyond the expected `Unsupported platform: web` from IAP). Driving the
  automated browser deeper than the perks screen was blocked by an overlay
  intercepting the tap, so the Cash Flow panel itself is verified by tests and
  by the provider-tree mount test, not by eye.


# Plan — DeepLife+ subscription funnel: honest pricing, honest offers, measurable funnel (2026-08-22) — DONE

## Audit summary (what already exists)

The subscription system is NOT a stub. `lib/subscription/deepLifePlus.ts` is the plan/benefit
source of truth, `services/SubscriptionService.ts` owns entitlement (with the MON-1/MON-3 fixes
already in place), `components/SubscriptionModal.tsx` is a designed paywall with an annual
default, a value stack, trust row, Restore/Manage/Terms/Privacy and a compliant legal
disclosure. Benefits are truthful — all seven are really granted (ad-free, 250/day gems,
+25% income via `applyCareerSalaryAndPenalty`, Legacy Pass premium, cosmetics, welcome gems,
VIP support via `HelpModal.handleContactSupport`).

Things the brief asks for that are ALREADY satisfied and need no work:
- Paywall frequency / dismissal control (§29-30): every paywall entry point is user-initiated
  (crown, gem shop, daily gems, progression). The one auto-shown upsell (`PremiumPassPromo`)
  already has a blocking-moment guard, an 8-week cooldown, once-per-session and the shared
  `useInterruptionSlot` priority queue. Nothing to add.
- No fake discounts/countdowns/scarcity anywhere (§0). `lib/offers/pricing.ts` already encodes
  "never claim a discount you cannot prove".
- Restore, Manage, cancellation route, auto-renew disclosure (§25-27) all present.

## Defects found (this is the work)

P1. PRICES ARE HARDCODED USD. `DEEP_LIFE_PLUS_PLANS[].price` comes from the static
    `SUBSCRIPTION_CONFIGS` map ('$4.99' / '$49.99'). Every price on the paywall — plan cards,
    CTA, legal disclosure, lifetime row, `yearlyPerWeek()` "just $0.96/week",
    `yearlySavingsPercent()` "SAVE 17%" — renders that constant. A non-US player is shown a
    price and a currency they will not be charged, and the savings % is computed from USD
    figures so it can be simply false in a storefront with different price tiers. The gem shop
    already resolves live localized prices; the paywall is the one money surface that does not.
    (§42, §44, §45, §48, §62)

P2. NUMERIC STORE PRICE IS DESTROYED AT THE ADAPTER. `normalizeProduct` in
    `services/expoIapAdapter.ts` overwrites `price` with a display string, and nothing else
    carries the number. So `lib/offers/pricing.ts` (reads `priceAmount`) and GemShopModal's
    `storePriceInfo` (same) can NEVER fire — the offer discount badge and the currency-honest
    gems-per-unit line are both dead code today. Both were written correctly; the data just
    never arrives.

P3. THE TRIAL IS PROMISED ON UNKNOWN ELIGIBILITY. `trialEligible = introStatus !== 'ineligible'`,
    so 'unknown' shows a CTA reading "Start for $0.00 Today" and a banner reading "no charge".
    RC returns 'unknown' for ALL of Android, RC-disabled builds, and any failed call. A player
    who already used their trial taps a $0.00 promise and is charged immediately. There is also
    no check that the PRODUCT carries a free trial at all — `DEEP_LIFE_PLUS_FREE_TRIAL_DAYS = 7`
    is a hand-maintained constant that the store never validates. (§14, §49, §62)

P4. THE FUNNEL IS UNMEASURABLE PAST THE CTA. Only `paywall_open_tapped`, `paywall_viewed`,
    `paywall_cta_tapped` exist. No purchase result, plan selection, dismissal, restore,
    activation or first-premium-value event. §38 says find the biggest drop-off first — the
    CTA→purchase step, normally the biggest, is invisible. (§37, §38, §58)

P5. NO ACTIVATION MOMENT. On success the modal sets a one-line `message` string and leaves the
    player on the paywall. No welcome, no "here is what you unlocked", no route to a first
    premium win. (§32, §33)

## Tasks

- [x] T1  `services/expoIapAdapter.ts`: preserve the numeric price as `priceAmount` (additive;
          `price` stays a string so no existing reader changes). Unblocks P2's dead code + P1.
- [x] T2  NEW `lib/subscription/planPricing.ts` — pure, no service imports (lib layering rule):
          resolve a plan's display price from a loaded store product; per-week and savings%
          computed ONLY from same-currency numeric store prices; store-reported free-trial
          detection (iOS intro-offer fields + Android pricing phases).
- [x] T3  `services/RevenueCatService.ts`: `getSubscriptionStoreProducts()` so the paywall has a
          second price source in RC-driven builds where the expo-iap catalog may be empty.
- [x] T4  `components/SubscriptionModal.tsx`: wire live prices with explicit
          loading / unavailable / loaded states — never print a price we cannot stand behind.
- [x] T5  Trial decision matrix: store-confirmed offer × per-user eligibility. Only a confirmed
          -eligible user sees the "$0.00 today" promise.
- [x] T6  `lib/analytics/events.ts` + paywall: complete the funnel (plan selected, dismissed,
          purchase started/succeeded/failed/cancelled, restore x3, premium_activated,
          first_premium_value, intro_offer_shown).
- [x] T7  Premium activation moment: post-purchase welcome state listing what was unlocked and
          pointing at the first premium win.
- [x] T8  Tests: pure pricing/trial logic + paywall render smoke + adapter numeric preservation.
- [x] T9  Verify: npm run type-check, type-check:tests, lint:errors, targeted suites. Show output.

## Deliberately NOT doing

- Inventing new premium features/tiers (§3, §10, §34, §35). The brief says only implement perks
  that genuinely improve the game; new premium content is a product decision for the owner and
  would balloon this diff. Recommendations go in the final write-up instead.
- A/B experiment infrastructure (§39-41). No experiment framework exists; building one is its
  own project. The roadmap goes in the write-up.
- Changing prices, trial length or plan structure — owner's call, and they are configured in
  App Store Connect, not here.

## What shipped

**T1 · `services/expoIapAdapter.ts`** — `normalizeProduct` now keeps the numeric price as
`priceAmount` alongside the display string. This was a latent defect beyond the paywall: the
featured-offer discount badge (`lib/offers/pricing.ts`) and the gem shop's currency-honest
gems-per-unit line both read `priceAmount`, so both were unreachable code on every live
storefront. Two regression tests pin it.

**T2 · NEW `lib/subscription/planPricing.ts`** (+ 37 tests) — pure resolution of display price,
per-week framing, savings percentage and store-reported trial length. Derived claims return
empty/0/null whenever their inputs cannot support them: cross-currency savings are refused, the
per-week line is silent without a numeric amount, and the trial length comes from the product's
own introductory offer. Per-week rounds UP and savings FLOOR, so neither can under-state a price
or over-state a discount. Formatting is reused from the store's own string (no `Intl`, no
currency table), so symbol, symbol position and separators stay correct in every storefront.

**T3 · `services/RevenueCatService.getSubscriptionStoreProducts()`** — a second price source, so
an RC-driven build with expo-iap off still has real prices. Without it the new "never print an
unproven price" rule would have blanked the paywall in the one configuration that can charge.

**T4/T5 · `components/SubscriptionModal.tsx`** — live localized prices everywhere (cards, CTA,
lifetime row, legal disclosure, accessibility labels), all reading ONE resolved value so the
button and the disclosure can never quote different figures. Four explicit CTA states
(loading / store-disabled / unavailable→retry / buy); a purchase is only offered when a real
store price is in hand. The config USD price now appears solely where no store exists at all
(Expo Go, web preview) with the CTA disabled — mirroring how `GemShopModal` already degrades.
Trial copy splits into promise / conditional / none, and the "100% RISK-FREE" seal rides only on
a confirmed promise.

**T6 · Funnel** — 9 new events plus a `purchase_cancelled` / `purchase_failed` split in
`IAPService` (a `cancelled` flag added to `PurchaseResult`, set on both the RevenueCat and native
paths). The funnel now runs unbroken from surface tap to first premium use.

**T7 · Activation moment** — a post-purchase welcome state listing what was unlocked, with the
CTA turning into the way out. `first_premium_value` is recorded once per install
(`utils/premiumValueTracking.ts`, AsyncStorage-latched so it is not a save-format change) when a
member collects the 250-gem member drop.

**Red team** — the purchase and restore handlers now latch on a REF rather than the `busy` state:
`setBusy(true)` does not update `busy` until re-render, so two taps in one batch could both have
opened a store sheet (the gate-then-act shape from CLAUDE.md §4.4).

**Removed** — `yearlyPerWeek()` / `yearlySavingsPercent()` and their USD parsing helpers in
`deepLifePlus.ts`. Deleted rather than deprecated: a helper that silently answers in the wrong
currency is exactly what gets reached for again. A comment records where they went and why.

## Verification
- `npm run type-check` ✓ · `npm run type-check:tests` ✓ · `npm run lint:errors` ✓
- Targeted: `lib/subscription` (37 new) · `__tests__/monetization` · `__tests__/services` ·
  `lib/analytics` · `lib/offers` → 37 suites / 338 tests ✓
- `__tests__/render` + `__tests__/startup` → 55 suites / 488 tests ✓
- Full suite ✓ (see the final report)

## Left to the owner (deliberately not done)
- New premium features / tiers / a content calendar — product decisions, and the brief's own rule
  is to add only perks that genuinely improve the game.
- A/B experiment infrastructure — none exists; building it is its own project.
- Price, trial length and plan structure changes — configured in App Store Connect, not here.
- Win-back promotional offers — needs App Store Connect offer configuration plus a signing
  endpoint before any app-side work is meaningful.

### Still open for the owner

- Story mode / monthly ticks (the player's other ask) — v38, removed after
  playtesting. Not rebuilt.
- Income caps made visible but not retuned: $200K/wk company ceiling, and
  `ops_management` lifting the soft-cap floor only 25% → 45%.
- The three inert prestige bonuses: wire, remove, or re-purpose.
