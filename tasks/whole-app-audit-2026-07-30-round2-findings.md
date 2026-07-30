# Whole-app audit — Round 2 findings (2026-07-30)

Five parallel domain passes. Every finding was verified by the agent reading the
source at the stated anchor. Status column is maintained as work lands.

## Status legend
`FIXED` landed on this branch · `OPEN` verified, not yet fixed · `WONTFIX` with reason

| ID | Sev | Status | Summary | Anchor |
|---|---|---|---|---|
| R1-01 | high | FIXED | Stock dividends paid TWICE — weekly in passiveIncome + quarterly in lib/stocks. 200% of advertised yield | `lib/economy/passiveIncome.ts` / `lib/stocks/dividends.ts` |
| MON-2 | high | FIXED | "Restart Game" wiped every paid entitlement; 3rd `initialGameState` builder missing the carry | `components/settings/DangerZone.tsx:32` |
| SAVE-1 | high | FIXED | Permanent-perk write swallowed storage failure; redeem code FINALIZED and burned anyway | `services/IAPService.ts:286` · `utils/redeemCodes.ts:546` |
| ECON-1 | high | FIXED | Daily login gems gated on device-clock day-string, no monotonicity guard — unlimited farm | `app/(tabs)/home.tsx:251-283` |
| MON-1 | high | FIXED | SubscriptionReconciler revokes paid Remove Ads using a check that is empty on cold start | `components/SubscriptionReconciler.tsx:44-50` |
| UX-1 | high | FIXED | Pulse follower boost: full rewarded ad plays, grants nothing, says nothing | `components/mobile/Pulse/modals/RewardedAdModal.tsx:101-115` |
| PERF-1 | high | FIXED | Every saveGame builds a full backup (stringify+CRC32+HMAC) BEFORE the 60s rate limiter discards it | `utils/saveBackup.ts:509-512` |
| PERF-2 | high | OPEN | PostCard (~60 FlatList rows) subscribes to whole GameState, unmemoized, saves on every tap | `components/mobile/Pulse/components/PostCard.tsx:55,59` |
| ECON-2 | med | OPEN | startResearch: no in-updater re-check — bypasses lab concurrency cap, doubles breakthrough roll | `contexts/game/actions/RDActions.ts:116-152` |
| ECON-3 | med | OPEN | lobby/campaign/hireLobbyist clamp debit to 0 instead of rejecting; free lobbyist + influence | `contexts/game/actions/PoliticalActions.ts:621,750,821` |
| ECON-4 | med | OPEN | deliverBrandDealPost counts a delivery without checking the post was already used | `contexts/game/actions/PulseActions.ts:710-715` |
| MON-3 | med | OPEN | Subscription expiry never enforced on the non-RevenueCat path; Restore re-grants premium forever | `services/SubscriptionService.ts:112-141` |
| SAVE-2 | med | OPEN | phantomSaveCleanup imports AsyncStorage at module top level; MainMenu pulls it in eagerly | `utils/phantomSaveCleanup.ts:16` |
| SAVE-3 | med | OPEN | IAP dedupe ledger write unchecked, then purchase reported fulfilled | `services/IAPService.ts:530-537` |
| PERF-3 | med | OPEN | Pure-JS HMAC allocates 3 full copies of the save as boxed number[]; ~96MB at the 4MB ceiling | `utils/saveValidation.ts:146,177,269` |
| PERF-4 | med | OPEN | Full JSON deep-clone inside the setGameState updater once per game-year; audit-perf cannot see it | `lib/timeMachine/checkpointSystem.ts:99` |
| PERF-5 | med | OPEN | Two orphaned modules covered by tests named for screens that use different code | `utils/realEstateWeekly.ts` · `utils/bankMarketAPR.ts` |
| UX-2 | med | OPEN | "Unlock All Perks" shows Owned/unbuyable for players without Mindset (omitted from the check) | `components/GemShopModal.tsx:632` |
| SAVE-4 | low | OPEN | performSave/forceSave report success though `lastSlot`/`lastSaveTime` writes are unchecked | `utils/saveQueue.ts:272,438` |
| SAVE-5 | low | OPEN | saveGame called in the same sync segment as setGameState persists the PRE-update snapshot | `components/LifeMomentModal.tsx:92,114` +4 |
| ECON-5 | low | OPEN | buildRDLab clamps debit, rebuilds lab from a stale snapshot (data loss, not gain) | `contexts/game/actions/RDActions.ts:43-56` |
| ECON-6 | low | OPEN | MoneyActionsContext buy/sell/swapCrypto are unguarded printers — DevTools-only reachability | `contexts/game/MoneyActionsContext.tsx:320-462` |
| PERF-6 | low | OPEN | forceSave missing the pre-serialize yield that performSave has; runs on the IAP grant path | `utils/saveQueue.ts:371-376` |
| PERF-7 | low | OPEN | Tab-tree root and AdRewardOrb take full-state subscriptions | `app/(tabs)/_layout.tsx:111` |
| UX-3 | low | OPEN | Hard Rule #7: decorative red left accent stripe on the company scandal banner | `components/mobile/Hustle/screens/CompanyDetailScreen.tsx:308,1213` |

## Verification gates at time of writing

| Gate | Result |
|---|---|
| `npx jest` | 4,471 passed, 1 skipped, 0 failed |
| `npx tsc --noEmit -p tsconfig.typecheck.json` | 0 errors |
| Test-tree ratchet (`tsconfig.tests.json`) | **186 current / 186 baseline / delta 0 → PASS** (non-blocking; fails only on an increase) |
| `npx eslint --quiet` on changed files | 0 errors |
| `npm run audit:weekly` | 0 critical, 0 high; 1 pre-existing warning (`as GameState` in tests) |

## Checked and clean (do not re-tread)
Migration↔repair parity (audit-save V8 check passes, re-verified v20–v26 by hand) ·
rewarded-ad grant path in `lib/ads/rewardedAd.ts` · prestige/heir entitlement survival ·
`isNonIdempotentGrant` ledger gating · the paywall's +25% income claim · save-slot
delete + Restart confirmations · `as any` count in contexts/game and services (5, all
benign) · unbounded-growth check on eventLog/lifeMilestones/memories/priceHistory/
npcMemories/netWorthHistory (all capped) · ItemActions, LuxuryActions, VehicleActions,
StockActions, CryptoTradingActions, BankingActions, MiningActions, PetActions,
ContactsActions, DatingActions, TravelActions, EducationActions, SparkActions,
HustleActions IPO, CompanyActions, filePatent, enterCompetition, achievement gem mint,
LifeChapterCard, AmbitionCard, RedeemCodeModal, claimDailyGems, applySavingsInterest,
applyAutoReinvest, weekly-event resolver.

## Game-logic domain (same round, reported separately)

| ID | Sev | Status | Summary | Anchor |
|---|---|---|---|---|
| GL-1 | high | OPEN | 5 prestige "learning speed" bonuses inert — `getExperienceMultiplier` has zero call sites | `lib/prestige/applyBonuses.ts:220` |
| GL-2 | high | OPEN | Politics education perks read `effects.education`, a key that does not exist on the returned object | `contexts/game/actions/EducationActions.ts:53-55` |
| GL-3 | med | OPEN | Healthcare + education policy effects aggregated into `activePolicyEffects` and never read | `contexts/game/actions/PoliticalActions.ts:69-124` |
| GL-4 | med | OPEN | 2 scenarios unscoreable — prestige projection strips `level`; `family_man` achievement id does not exist | `lib/prestige/prestigeExecution.ts:134,136` |
| GL-5 | med | OPEN | "Debt Free" achievement unearnable — `progress.hasBeenInDebt` never written true | `src/features/onboarding/achievementsData.ts:1161` |
| GL-6 | med | OPEN | Life Skills "Investing" node inert — `stockReturnMult` has zero readers (and gates `wealth_master`) | `lib/skillTrees/lifeSkillEffects.ts:166,188` |
| GL-7 | med | OPEN | Auto-Rest, Skill Mastery, Achievement Hunter prestige bonuses all purchasable and inert | `lib/prestige/applyQOLBonuses.ts:34` · `applyBonuses.ts:250,319` |
