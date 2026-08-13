# Plan — Make lobbyist specialty real (option A)

## The finding

Three facts, each re-verified:

Line references below are given as **pre-change → post-change**, because this
document is both the plan and the record: the pre-change numbers are what the
finding was verified against, and the post-change ones are where a reader looks
today.

1. `calculateTotalLobbyistInfluence` (`lib/politics/lobbyists.ts:153` → `:276`)
   is the only reader of `Lobbyist.specialty` in the repo, and it has **zero call
   sites**.
2. `PoliticalApp.tsx` advertises the specialty three times (`:887`, `:936`,
   `:1373` → `:912`, `:962`, `:1399`), so the player picks a lobbyist on a
   distinction the game does not implement.
3. `PolicyType` is declared **twice** and they diverge — 5 members in
   `lobbyists.ts`, 11 in `policies.ts`. That divergence is *why* the targeting
   was never wired: 7 of the 11 policy types have no possible specialist.

## Design

`policyInfluence` is NOT repurposed. It has three other consumers — the
`Influence` StatCard (`PoliticalApp.tsx:486`), an achievement at `>= 50`
(`achievementsData.ts:1311`), and an event effect (`lib/events/engine.ts:53`) —
and its discount was itself a recent fix for a dead stat. Taking the discount
away from it would re-open that exact hole.

So the targeted discount **stacks on top** rather than replacing:

```text
base     = min(0.25, policyInfluence / 100)          // unchanged, every existing source
targeted = min(0.15, matchedLobbyistInfluence / 100) // NEW: only lobbyists who match
discount = min(0.35, base + targeted)
```

- No existing save loses a single point of discount — `base` is byte-identical.
- A matching specialist is now worth more on its policy type than off it, which
  is precisely what the three UI strings already claim.
- Generalists (`'all'`) match everything, consistent with their price and copy.

**No `STATE_VERSION` bump.** Specialty is catalogue data keyed by lobbyist id;
`calculateTotalLobbyistInfluence` already derives from ids, so nothing new is
persisted and existing saves work untouched.

## Steps

- [x] 1. `lib/politics/policies.ts` — no change; it owns the canonical `PolicyType`.
- [x] 2. `lib/politics/lobbyists.ts` — delete the duplicate 5-member `PolicyType`,
      re-export the canonical 11-member one from `policies.ts`. Root cause.
- [x] 3. `Lobbyist.specialty: PolicyType` → `specialties: readonly LobbyistSpecialty[]`
      (`LobbyistSpecialty = PolicyType | 'all'`). The catalogue descriptions already
      name multi-type coverage ("Great for social and economic policies") that the
      singular field could not express.
- [x] 4. Retag the catalogue from its **own existing names and descriptions** — no
      invented coverage. Add specialists for the types left genuinely uncovered.
- [x] 5. `calculateTotalLobbyistInfluence` — read the array; keep the `'all'` wildcard.
- [x] 6. `PoliticalActions.enactPolicy` — stack `targeted` onto `base`. Must be
      recomputed from `prev` inside the updater as well as the snapshot pre-check
      (CLAUDE.md §4.4) — the existing `influenceCost` closure already does this and
      must keep doing it.
- [x] 7. `PoliticalApp.tsx` — the three sites print the specialty list, and the
      policy card shows the discount actually applied.
- [x] 8. Tests: targeting changes the price; a non-matching specialist does not
      discount; every `PolicyType` has at least one catalogue specialist (the guard
      that stops the two lists diverging again); no existing player loses discount.

## Verification

```sh
npm run type-check && npm run type-check:tests
npx jest __tests__/politics lib/politics __tests__/economy/gateThenGrantAtomicity.test.ts \
         __tests__/stress/legacyPulsePoliticsFlow.stress.test.ts \
         __tests__/stress/fallbackOperatorSweep.stress.test.ts \
         __tests__/actions/runForOfficeRace.test.ts
npx jest __tests__/render   # PoliticalApp is a rendered screen
```

## Done — 2026-08-12

All eight steps landed. Verification actually run:

- `npm run type-check` — clean
- `npm run type-check:tests` — clean (baseline stays 0)
- `npm run lint:errors` — clean
- `npx jest lib/politics __tests__/economy/gateThenGrantAtomicity.test.ts
  __tests__/actions/runForOfficeRace.test.ts __tests__/progression/inertBonusesWired.test.ts
  __tests__/refactor` — 541 passed, 1 skipped
- `npx jest __tests__/render __tests__/stress/legacyPulsePoliticsFlow.stress.test.ts
  __tests__/stress/fallbackOperatorSweep.stress.test.ts` — 390 passed
- `npm test -- --ci` — **536 suites / 6,768 tests passed**, 1 skipped

New coverage: `lib/politics/__tests__/lobbyistSpecialty.test.ts` (18) and
`__tests__/economy/policyDiscountTargeting.test.ts` (11).

Left deliberately untouched: `VoteCard` still prints the sticker price, because
it renders bills that are ALREADY enacted — a discount quote on a historical
purchase would be noise.

---

## Player report 2026-08-13 — "cannot redeem weekly reward, can't use features of smartphone and PC"

Save: week 1 / weeksLived 52, age 19, job `graphic_designer`, money $3,000,
bank $0, prestige 0, generation 1, edu 0. Validation clean, no error logs — so
nothing crashed. The player is *gated*, not broken.

`unlockTier` (`lib/progress/featureUnlocks.ts`) puts that save at tier 2:
no chapter flags past 2, `weeksLived` 52 < the 120-week veteran hatch, and the
milestone fallback reads `stats.money + bankSavings` = $3,000. At tier 2 the
app grid padlocks Stocks, Real Estate, Bitcoin, Vehicle, Travel, Company,
Gaming, Streaming, Statistics, Onion, Political and Luxury — twelve of the
phone/PC apps. That is the second complaint verbatim, and the weekly-challenge
card is the first: its objectives are wealth/asset gated, so a player parked at
tier 2 watches a reward they have no route to.

Three defects behind it:

- [x] **A. The chapter spine is circular.** `ch3_invest` requires owning a stock
      or a property, but `app:stocks` / `app:realestate` are tier 3 = "Finish
      Chapter 3". `ch4_business` requires a company, but `app:company` is
      tier 4 = "Finish Chapter 4". Neither chapter can be completed through the
      chapter path; the only escape is the cash milestone.
- [x] **B. `unlockTier` is not monotonic**, despite Rule 2 in its own header
      promising nothing is ever taken away. The milestone axis reads current
      liquid cash, so spending re-locks apps — buy a $200k property at tier 3
      and the Real Estate app that manages it padlocks itself. Assets do not
      count at all.
- [x] **C. Chapter money goals are balance snapshots**, not the cumulative
      figures their titles claim ("Earn $500", "Net Worth $50K" both read
      `money + bankSavings`). `applyChapterProgress` needs every goal true in
      the SAME tick, so a player who spends as they earn can miss a chapter
      permanently.

Fix:
- [x] `wealthMark()` in `lifeChapters.ts` — max of liquid, live net worth and
      `lifetimeStatistics.peakNetWorth` (already persisted, already monotonic,
      already written every tick). Derived, no new field, no migration.
- [x] Both the chapter money goals and `unlockTier`'s milestones read it.
- [x] Re-tier `app:stocks` / `app:realestate` 3 → 2 and `app:company` 4 → 3, so
      the app a chapter goal needs is open one tier below that chapter.
- [x] Regression tests, including a table-driven guard that no chapter goal can
      require an app gated at or above that chapter's own tier.
