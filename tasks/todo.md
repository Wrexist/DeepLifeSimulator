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


---

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
