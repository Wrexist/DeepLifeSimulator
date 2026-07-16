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

## 🔴 CRITICAL — remaining
- [ ] Save-slot data loss: `currentSlot` never updated (setCurrentSlot has 0 callers) → all saves write slot 1, overwriting it when playing slot 2/3. (GameStateContext.tsx:41, GameActionsContext loadGame/new-game)
- [ ] Multi-week event chains always take the failure branch: eventLog stores `choice.text` but chains read `e.choiceId` (never written) → invested business chain always loses the stake, etc. (engine.ts:2797; write site GameActionsContext.tsx:2563; type types.ts:2297)
- [ ] Marketing-campaign money printer: `lift = spend*(ROI-1)` risk-free; ROI>2 kinds net guaranteed profit, stackable. (lib/business/hustleTick.ts:127) [seeded tick → snapshot regen]
- [ ] Hustle employee-hire printer + named-hire salary never deducted. (HustleActions.ts:127/300, hustleLogic.ts:79) [salary path seeded]
- [ ] Ambition payoff (gems+prestige pts) re-grantable every prestige. (prestigeExecution.ts:330 + ambitions)
- [ ] Progress-achievement gems re-mintable every prestige (guard only at display layer). (GameActionsContext claimProgressAchievement:2752, useAchievements.ts:24)

## 🟠 HIGH — remaining
- [ ] Auto-repair free durability: whole fleet restored to 100% funded by a dust amount of coin. (applyMiningWarehouse.ts:99) [seeded tick]
- [ ] Free education financing: student-loan balance drops weekly but cash never charged. (applyEducationProgression.ts:110 + GameActionsContext:791)
- [ ] Daily-reward re-claimable after kill: saveGame persists stale pre-grant state. (home.tsx:268; same class work.tsx:184)
- [ ] Patents never expire → perpetual weekly income. (patents.ts:75 updatePatents uncalled; passiveIncome.ts:365) [seeded tick]
- [ ] Bank net-worth double-counts cash (totalBank includes checking-default mirror). (AdvancedBankApp.tsx:194)
- [ ] FIRE + retirement math ~52× off (weekly salary treated as annual /52). (fireTracker.ts:29, retirementCalculator.ts:42)
- [ ] Spark Boost 50-gem no-op for free players (boostMultiplier 1.0, boost unread). (sparkLogic.ts:52, sparkTick)
- [ ] Spark swipe deck ignores seekingGender. (SwipeScreen.tsx:90)
- [ ] Spark profile bio/photos uneditable (updateMyProfile no UI). (SparkApp.tsx:327)
- [ ] Pulse composer energy gate 5 vs real cost 15 → silent no-op. (FeedScreen.tsx:113)
- [ ] Pulse rewarded-ad boost unreachable after 1 notification. (NotificationsScreen.tsx:157)
- [ ] Weekly-challenge rotation only ever shows 3 of 12. (weeklyChallenges.ts:529)
- [ ] Determinism in seeded tick (save-scummable + Hermes/V8 drift): engine.ts:3352 & applyIncome.ts:105 (Math.sin), GameActionsContext:735 (rent Math.random), socialMedia.ts:787, educationSystem.ts:321, pulseTick.ts:228, sparkTick.ts:134, hustleTick.ts:47, randomProfiles.ts:269, npcDepth.ts:164. [needs seeded rolls + deliberate snapshot regen]
- [ ] Real estate rent lever ignored (custom rent never realized). (operations.ts:287)
- [ ] Enhanced mining / Lobbyists+Alliances / Family Business / Credit-card charging — fully built, no UI entry point (wire or remove). (MiningActions:311, PoliticalApp:636, FamilyBusinessActions:59, AdvancedBankApp:677)

## 🟡 MEDIUM — remaining (broken-UI "spend does nothing" / correctness)
- [ ] ComposeModal hardcoded energy cost 5 for all types. (ComposeModal.tsx:75)
- [ ] BrandDeals no saveGame → lost on reload. (BrandDealsScreen.tsx:30)
- [ ] CreateCompany affordability uses uninflated cost. (CreateCompanyScreen.tsx:116) + no prestige/edu gate pre-confirm (:70)
- [ ] Policy effects applied once but framed "weekly" (UBI/tax_cut). (PoliticalActions.ts:526)
- [ ] Vehicle repair chip shows gross cost, insurance discounts to $0. (VehicleApp.tsx:474)
- [ ] Travel stat preview shows phantom int/stress chips. (TravelApp.tsx:203)
- [ ] Gear quality is 4-step but UI shows smooth bar → in-band upgrades change earnings by 0. (quality.ts:85)
- [ ] Record CTA lit at 5/5 weekly cap. (GamingApp.tsx:552)
- [ ] Bitcoin mining Buy stays enabled past $100k/wk cap. (BitcoinMiningApp.tsx:666); non-BTC coins ~$0/wk (MiningActions:213)
- [ ] Limit/stop stock orders skip the 2% fee market orders pay. (stocks/weeklyTick.ts:182)
- [ ] 6 asset buy/sell paths still write stats.money directly (no applyMoneyDelta) — partially addressed by sale fixes; remaining buys. (Stock/Crypto/RealEstate/Vehicle Actions)
- [ ] Lifestyle-cost sink shown in UI, never deducted. (lifestyle.ts:46)
- [ ] autoSave NaN → money/bankSavings NaN. (autoSave.ts:97); autoRenew/autoPay report success but charge nothing (autoRenew.ts:131, autoPay.ts:110)
- [ ] FamilyBusiness manageFamilyBusiness non-atomic charge/benefit. (FamilyBusinessActions.ts:100)
- [ ] ComposeModal sponsor deferred-updater double-increment. (ComposeModal.tsx:111)
- [ ] Spark premium annual plan unreachable (hardcoded weekly). (SparkPremiumUpsellModal.tsx:56)
- [ ] Spark match celebration no partner photo. (SparkApp.tsx:224)
- [ ] Hire refresh returns same 3 candidates in a week. (HireEmployeeModal.tsx:68)
- [ ] IPO success shows no raise feedback. (IPOModal.tsx:51)
- [ ] RealEstate detail page stays "For sale" after buy. (RealEstateApp.tsx:360)
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
