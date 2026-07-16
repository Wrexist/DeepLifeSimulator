# DeepLife "Flawless" Audit — full findings + fix tracker (2026-07-16)

7-agent game-wide read-only audit (core loop/save, mobile apps, computer apps, economy, life
systems, progression/meta, cross-cutting code health) + subagents. ~100 findings, each with
file:line + fix + repro. Fixing in verified batches (tsc 0 / eslint 0 / jest + 308 snapshots).

Invariants (required targets — some still violated, see the tracked items): `stats.money` canonical;
`banking.accounts` are mirrors; all money SHOULD route via `applyMoneyDelta` (six direct `stats.money`
writers remain tracked below); seeded weekly tick deterministic (no Math.random/Date.now — the
determinism cluster below tracks the remaining violations); new state additive/optional.

## ✅ DONE (landed)
- [x] Streaming/content hardening (5 CodeRabbit items) — NaN guards, ref-in-render, live-stream save checkpoint. (merged in #62, commit ee809e5)
- [x] Legacy-save crashes — sparkLogic scorePlayerProfile, OnionApp activeJobs, work.tsx crimeSkills. (merged in #62, dc3e337/59d2fe8)
- [x] Real estate: underwater sale no longer erases mortgage for free (keeps deficiency balance). (37a7e22)
- [x] Vehicles: underwater sale no longer erases auto loan for free (keeps deficiency balance). (e66ba7b)
- [x] Careers: CEO / investment banker / creative director unlockable (bad education IDs masters/bachelors → masters_degree/business_degree). (d551eb9)
- [x] Pulse Insights: engagement rate showed ~2000% (double ×100). (efa7659)
- [x] Save-slot data loss: currentSlot synced in loadGame (+ new-game via loadGame); deleteSlot repoints stale lastSlot/currentSlot markers; provider-level regression test. (2143dce)
- [x] Hustle money printers: seeded ROI variance kills the guaranteed marketing profit; candidate dedup + idempotent hire + 30-cap; named-hire payroll charged weekly. (295cee4)
- [x] FIRE + retirement 52x weekly-as-annual salary bug; savingsRate clamped 0-100. (e492c84)
- [x] Bank statement net worth cash double-count (mirror excluded via computeStatementNetWorth). (e492c84)
- [x] Spark Boost no-op (BOOST_MATCH_FLOOR 1.5x + immediate likedYou); swipe deck seekingGender filter; Pulse composer energy gate + surfaced errors; ComposeModal per-type energy cost; rewarded-ad boost reachable from populated notifications; Spark Premium annual toggle; match celebration partner photo. (ce49570)
- [x] Vehicle deficiency loans unsecured (vehicleId cleared, no collision with future purchase) + money finite-guard (Codex P2 + CodeRabbit). (ac07bc9)
- [x] Event chains: choiceId persisted on eventLog; invest/doctor branches reachable; 7 regression tests. (0907252)
- [x] Seeded-tick determinism: 7 sites (pulse earnings/trends/notifs, sparkTick likedYou, hustle notif timestamps, scandal comments, npc memory ids, exam/campus rolls) now seeded; determinism tests added. (2cdcfaa)
- [x] Daily-reward + work-action stale-save: saves persist the committed state (post-commit deferral; regression test). (e01e133)
- [x] Prestige re-grant farms: claimedAmbitions + claimedAchievementIds persist across prestige; payouts once-ever. (aa53e52)
- [x] Desktop lying/dead UI (7): repair price after insurance, travel preview honesty, record CTA cap, mining Buy at cap + marginal yield, stale For-sale page, IPO feedback, hire-refresh nonce. (1da86f0)

## 🔴 CRITICAL — remaining

## 🟠 HIGH — remaining
- [ ] Auto-repair free durability: whole fleet restored to 100% funded by a dust amount of coin. (applyMiningWarehouse.ts:99) [seeded tick]
- [ ] Free education financing: student-loan balance drops weekly but cash never charged. (applyEducationProgression.ts:110 + GameActionsContext:791)
- [ ] Patents never expire → perpetual weekly income. (patents.ts:75 updatePatents uncalled; passiveIncome.ts:365) [seeded tick]
- [ ] Spark profile bio/photos uneditable (updateMyProfile no UI). (SparkApp.tsx:327)
- [ ] Weekly-challenge rotation only ever shows 3 of 12. (weeklyChallenges.ts:529)
- [ ] Real estate rent lever ignored (custom rent never realized). (operations.ts:287)
- [ ] Enhanced mining / Lobbyists+Alliances / Family Business / Credit-card charging — fully built, no UI entry point (wire or remove). (MiningActions:311, PoliticalApp:636, FamilyBusinessActions:59, AdvancedBankApp:677)

- [ ] Non-BTC mining yield ~$0 (BTC-or-nothing picker) — DEFERRED: feeds the seeded tick, needs a snapshot-owning pass. (MiningActions.ts:213)
- [ ] Remaining determinism sites (not in the fixed cluster): engine.ts:3352 + applyIncome.ts:105 (Math.sin — Hermes/V8 drift), GameActionsContext:735 (rent tick Math.random). [seeded tick + snapshot regen]

## 🟡 MEDIUM — remaining (broken-UI "spend does nothing" / correctness)
- [ ] BrandDeals no saveGame → lost on reload. (BrandDealsScreen.tsx:30)
- [ ] CreateCompany affordability uses uninflated cost. (CreateCompanyScreen.tsx:116) + no prestige/edu gate pre-confirm (:70)
- [ ] Policy effects applied once but framed "weekly" (UBI/tax_cut). (PoliticalActions.ts:526)
- [ ] Gear quality is 4-step but UI shows smooth bar → in-band upgrades change earnings by 0. (quality.ts:85)
- [ ] Limit/stop stock orders skip the 2% fee market orders pay. (stocks/weeklyTick.ts:182)
- [ ] 6 asset buy/sell paths still write stats.money directly (no applyMoneyDelta) — partially addressed by sale fixes; remaining buys. (Stock/Crypto/RealEstate/Vehicle Actions)
- [ ] Lifestyle-cost sink shown in UI, never deducted. (lifestyle.ts:46)
- [ ] autoSave NaN → money/bankSavings NaN. (autoSave.ts:97); autoRenew/autoPay report success but charge nothing (autoRenew.ts:131, autoPay.ts:110)
- [ ] FamilyBusiness manageFamilyBusiness non-atomic charge/benefit. (FamilyBusinessActions.ts:100)
- [ ] ComposeModal sponsor deferred-updater double-increment. (ComposeModal.tsx:111)
- [ ] Hustle board/suppliers dead UI (never seeded). (CompanyDetailScreen.tsx:491)
- [ ] DM clues advertise rewards never granted + nonexistent mechanics. (DMSystem.tsx:123)
- [ ] Commitment system inert (levels never change; penalties not applied). (commitmentSystem.ts:102/169)
- [ ] Spark→Pulse milestone bridge never fires (marriage/divorce/baby). (sparkPulseBridge.ts:30)
- [ ] Free "chat"/romantic/adventure date tiers unreachable. (DatingActions.ts:123)
- [ ] Anniversary event never fires (checkAnniversary uncalled). (DatingActions.ts:1153)
- [ ] Favor ledger: Redeem side unreachable (only owed-by-player produced). (ContactsActions.ts:116)
- [ ] Chronic diseases (6) have no management loop despite "ongoing management" copy. (diseaseDefinitions.ts:179)
- [ ] Childhood events unreachable (no age 5-12 path). (childhoodEvents.ts:38)
- [ ] Life-stage event packs thin (teen 4 / senior 7) drowned in generic pool. (engine.ts:2562)
- [ ] hasInsurance=false hardcoded → medical events always full price. (personalCrises.ts:85)
- [ ] engagement personalCrises + automationEngine cash_percentage placeholder. (automationEngine.ts:52)

## 🟢 LOW / dead-code cleanup
- [ ] Dead modules (~680 lines, zero importers): utils/gameBalance.ts, utils/tutorialData.ts, utils/appStoreOptimization.ts.
- [ ] Dead: HobbyActions legacy module, systemInterconnections calculateActionImpact, relations.ts SocialState, creatorLevel perkTier unread, checkAchievements no-op, legacy 7-entry ACHIEVEMENTS array, triggerScandal, getActiveWeeklyChallengeId.
- [ ] prestigeAchievements legacy_wealth_10m unreachable (>1.1 vs cap); prestige_perfect_stats reputation; calculateLifetimeStats netWorth divergent.
- [ ] realEstate rent cap bypass (weeklyTick.ts:89); applyRentAndHousing NaN (:81); stock gains/dividends untaxed vs crypto.
- [ ] MainMenu Continue points at deleted slot; Ambitions Freeform not highlighted; housing maintenance alert band; loadGame filterNullValues drops unknown keys; repairGameState in-updater mutation.
- [ ] Content: NPC reply variety (3 lines), jealousy variety (4), pet content, elder activities (gate FIRE retiree), ambition variety (8, 3 overlap), statistics milestone rewards, karma career gating, cosmetics variety, bookmark dead tab, swipe-quota dead buttons, rewind datingMatches cleanup.

## Notes
- PR #62 (playtest fixes + first crash/streaming fixes) is MERGED to main. Follow-up audit fixes are on
  branch `claude/vitals-ui-notifications-redesign-e3262m` restarted from main (new PR when opened).
- Seeded-tick items (marked) change the 308 snapshots — regenerate deliberately and verify the diff is
  only the intended path.
- 2026-07-16: two fix agents were interrupted by the weekly API rate limit (resets Jul 17); remaining
  batches resume after reset.
