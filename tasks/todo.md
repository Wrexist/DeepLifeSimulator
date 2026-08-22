# Plan — Paywall polish + BBQ feedback batch (2026-08-21) — DONE

Executed via agents where they held (paywall, FirstWeekGuide) and directly elsewhere.
All verified: type-check ✓ type-check:tests ✓ lint:errors ✓ targeted suites ✓ visual ✓.

## A1 — Paywall (agent + coordinator fix)
- [x] Footer: Restore · Manage · Terms of Use · Privacy — Terms now on BOTH platforms
- [x] Privacy URL → https://wrexist.github.io/DeepLifeSimulator/privacy.html (appConfig constant)
- [x] Benefits compacted — all 7 fit above the fold (icon 38→28, title 15→13.5, desc 12.5→11.5)
- [x] Real game IAP art in benefit rows (remove_ads / work_pay_boost / gems_500 .webp)
- [x] Footer flexWrap fix (clipped at 390pt before)

## A2 — Politics lifecycle
- [x] applyOfficeExit (lib/politics/operations.ts): active scandals resolve 'survived' + lobbyists
      deactivated w/ influence stripped — wired into voted-out (weeklyTick) + forced-resignation (GameActionsContext)
- [x] Failed bid for higher office no longer drains a sitting official's approval (PoliticalActions loss path)
- [x] Regression tests: lib/politics/__tests__/officeExit.test.ts (93 politics tests pass)

## A3 — Company cap
- [x] Global $200k/wk pool removed → per-company cap: $200k base + $5k/employee
      (companyIncomeCap in lib/economy/passiveIncome.ts); stale comments updated

## A4 — Contacts UX
- [x] removeContact (family refused) + raiseRelationship (Bond: cash cost scales w/ score,
      diminishing gains, once/week, atomic §4.4) in ContactsActions.ts
- [x] UI: Bond · $cost + Remove (confirm) rows in ContactsApp detail (family hidden)

## A5 — First Week Guide (agent)
- [x] Root cause: lifeStartWeek carve-out → pre-v43 saves never saw it until prestige stamped
      baseline; also wasn't gated to first life. shouldShowFirstWeekGuide gate added; verified live on web.

## A6 — Post-prestige state leaks
- [x] Dark web vendor seeds reviewCount 12/84/230/3 → 0 (initialState + v18 migration):
      vendors stop appearing as contacts from birth & after prestige; snapshots updated
- [x] Achievements: repeat claims across lives now award NOTHING (gems were already guarded;
      Legacy Pass XP + lifetime counter now gated too)
- [x] Crypto rigs: Sell button wired to orphaned sellMiner (half current price, confirmed)

## Verification
- npm run type-check ✓ · type-check:tests ✓ · lint:errors ✓
- Suites: politics 8/8 (93), contacts+aggregator+economy 10/10 (135),
  integration/onboarding/monetization 39/39 (546), subsystemEquivalence 405/405 (6 snapshots updated)
- Pre-existing failures (NOT ours, confirmed on stashed clean tree): PromotionCelebrationModal +
  screens.render "$2,310" vs thin-space formatter; commitmentModalLayout stale source-pattern assert
- Visual: paywall-full.png (repo root) — benefits/art/footer verified live on web preview
