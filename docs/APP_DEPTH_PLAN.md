# Program Plan — DeepLife Simulator Depth Audit Synthesis

**Scope:** 15 app audits synthesized. **PoliticalApp input was truncated** (inventory cut off mid-sentence at `runPoliticsWeeklyTick`; no `broken[]`/`proposals[]` arrays present) — it is flagged throughout and cannot be curated. Banking is one shared slice (BankApp = phone, AdvancedBankApp = computer); YouVideo + Streamly share the `gamingStreaming` slice. Build shared systems once, surface in both.

---

## 1. TOP FIX-FIRST LIST (ranked by player impact)

Effort = cost to repair. Tiers: **S** = trust-breaking (paid/deceptive), **A** = permanent visible lie on a primary surface, **B** = whole loop/system dead.

**Tier S — deceptive value (fix first; players feel cheated):**
1. **Pulse — Verified Pro "Advanced analytics" delivers nothing** (`analyticsUnlocked` read nowhere). A **real-money IAP perk** returning zero. *Fix: ship Insights screen (M) or drop the bullet (S).*
2. **Spark — Ultra "See who liked you" is invisible.** `likedYou` accrues weekly, no UI reads it. Premium headline perk sold, never delivered. *Effort M.*
3. **PetApp — vaccination is cosmetic.** $200 vet service + "Vaccinated" shield; the live tick never reads `pet.vaccinated`. *Effort S–M.*
4. **VehicleApp — financed purchase grants no reputation.** Every dealer card badges "+X rep"; the live `purchaseVehicleWithAutoLoan` path applies none. *Effort S.*
5. **Banking — credit-card loop is dead & tiers are broken.** Charging unreachable → rewards never accrue → never redeemable; annual fee never charged → gold/platinum strictly better. *Honesty fix S; full loop L (Wave B).*
6. **Banking — savings-goal "Contribute" is a free no-op** while the modal says "Cash on hand." Cosmetic bars presented as a cash spend. *Effort S.*

**Tier A — permanent visible lie on a primary surface:**
7. **Banking — "Interest earned" & "Interest paid" permanently $0** (no writer for `totalInterestEarned`; real loan path `applyLoanAutopay` never records interest). Shown on both bank apps' hero/statement **and feeds `crossSystemSummary`.** *Effort S — cheapest high-visibility win; do in week 1.*
8. **ContactsApp — Attention tab permanently empty + every recency dot "No recent contact."** `weeksSinceContact` is always `undefined`; "At risk" pinned at 0. *Effort S (stamp `lastInteractionWeek`).*
9. **StocksApp — economy/sector momentum never moves the tradeable price.** Tilt/drift apply only to a local copy; board, Movers, and the EconomyEventBanner are meaningless — the app's core fantasy is a no-op. *Effort M.*
10. **Spark — jealousy permanent-block bug.** Tick only spawns when `!activeJealousy` and `resolveJealousy` has no UI, so the first unresolved event blocks **all** future jealousy. *Effort S.*
11. **Streamly — channel is always "OFFLINE" + avg viewers 0.** `isLive`/`averageViewers` never written; hero lies every render. *Effort S.*
12. **YouVideo & Streamly — "Lv N" badge frozen forever.** XP accrues, `level` never recomputes; a progression that never moves. *Effort M (shared).*
13. **Hustle — founding a company does nothing.** `createCompany` never seeds a Hustle overlay, the tick skips overlay-less companies (`if(!prevOverlay) continue`), and "Founded"/"Sold" milestones read 0 forever. *Effort S–M.*

**Tier B — whole built systems unreachable:**
14. **EducationApp — class system dead.** `enrolledClasses` always `[]` → completion stat-bonuses no-op, exam difficulty defaulted, detail "Classes" never renders, 19 templates unused. *Effort M.*
15. **ContactsApp — Favors tab permanently "No open favors."** `recordFavor` has no producer; `tickFavors` unwired. *Effort M.*
16. **Pulse — scandal system fully unreachable.** Nothing spawns `activeScandal`; banner/recovery modal/progression/pile-on all dead. **Prereq bug:** `SCANDAL_TYPE_MAP` key mismatch (`fameEvents.ts:508`) resolves every type to `bad_take`. *Effort M.*
17. **BitcoinMining — durability is one-way decay with no in-app repair.** "Repair now·$X" is a readout with no button; only remedy is buying replacement rigs. *Effort M.*
18. **RealEstate — decoration/rooms/upgrades fully unreachable.** The only consumer (`RealEstateManager.tsx`) is unmounted; detail chips never populate. *Effort M.*
19. **TravelApp — trip stress-relief + intelligence benefits never applied.** Every destination's headline benefit is cosmetic; no `stress`/`intelligence` field exists in `GameStats`. *Effort M — needs a design decision (route stress→happiness/energy).*
20. **BitcoinMining — entire mining-depth system unreachable** (upgrades/pools/staking/energy/automation; 6 pools, 4 energy types, 8 upgrades of dead content). Biggest half-built system. *Effort L → Wave B.*

*(All other broken items roll into per-app Wave A polish via each audit's `flawlessChecklist`.)*

---

## 2. CURATED FEATURE SLATE (1–2 picks per app; best depth-per-effort within guardrails)

**Banking (shared core — build once, surface on phone + computer):**
- **BankApp:** (1) **Real savings goals — fund/cap/celebrate** (M) *(also repairs the free-fill no-op)*; (2) **Live rate environment** (M, shared). ⚠️ *Money-printing:* live rates create borrow-low/save-high arbitrage — clamp deposit boost < `SAVINGS_APR_HARD_CAP`, assert `max deposit APY < min loan APR`. Goals: pull FROM an account (don't mint a pool), cap reward ≤1% of target/$500. ⚠️ *Migration:* STATE_VERSION 22 (both).
- **AdvancedBankApp:** (1) **Budget targets + overspend alerts** (S, computer-only, **zero economy risk**); (2) **Account transfers** (M, expose the built-and-tested `transferBetweenOwnAccounts`). ⚠️ *Migration:* v22 (`budgetTargets`).
- *Wave B:* **Living credit card loop** (L).

**StocksApp:** (1) **Persist sector tilt + macro drift to the tradeable price** (M) — converts the #9 no-op into the intended mechanic; (2) **Wire up the watchlist** (S). ⚠️ *Money-printing:* keep existing small modifiers (+0.8%/−0.5%/wk) + per-week clamps + $1M ceiling + mean-reversion; **preserve seed determinism.** ✅ *No migration* (writes existing `savedMarketPrices`).

**BitcoinMiningApp:** (1) **Honest per-coin yield estimate** (S, shared estimator — fixes the misleading BTC-equivalent display); (2) **Repair loop: manual CTA + auto-repair toggle** (M — fixes the decay dead-end). ⚠️ *Money:* atomic affordability re-check on repair (double-tap double-spend). ✅ *No migration.* *Wave B:* **Surface the mining-depth system** (L).

**Spark:** (1) **Jealousy confrontation modal** (S — fixes the permanent-block bug *and* adds depth; top depth-per-effort); (2) **Likes-You inbox** (M — delivers the advertised Ultra perk). ✅ *Low economy.* ⚠️ *Migration:* optional v22 (`likedYou.dismissed`).

**ContactsApp:** (1) **Living contact recency + Attention triage** (S — stamps `lastInteractionWeek` on Call/HangOut/date/gift; lights the whole dead tab and the "This wk" chip); (2) **Ask-$ loans → real IOUs + wire `tickFavors`** (M — populates the dead Favors tab; repay is a **pure money sink**). ✅ *Low money, no required migration* (existing `favorLedger`). *Wave B:* **Weekly network favors** (L). Also move `handleSimple`'s inline mutation into a `ContactsActions` helper.

**Pulse:** (1) **Creator Studio: analytics + trophy case** (M — fixes the #1 Verified-Pro deception *and* surfaces the never-shown `lifetimeStats`); (2) **Bring scandals to life** (M — finishes the biggest built system). ⚠️ *Prereq bug:* fix `SCANDAL_TYPE_MAP` keys first. *Scandal balance:* gate to popular+ tier, post-resolution cooldown, reuse existing caps (0.5%/wk cascade). ⚠️ *Migration:* v22 additive (`followerHistory` cap 52; optional `scandalRiskScore`). *Wave B:* **NPC likes/reposts/replies** (L).

**PetApp:** (1) **Wire the real care engine (`decay.ts`/`tickAllPets`)** (M — fixes vaccination deception + breed traits + passive energy + sickness severity in one swap); (2) **Bonding that actually pays** (S). ⚠️ *Balance:* mortality shifts (2-wk vs 3-wk zero-health death) + snapshot churn — **reconcile the death threshold and review mortality vs baseline before landing.** Cap bonding deltas to [−5,+5] happiness / [0,+3] health. ⚠️ *Migration:* data-preserving `ownedToys`→`toys` collapse.

**EducationApp:** (1) **Pick your classes each semester** (M — populates `enrolledClasses`, lighting up 4 downstream dead systems at once); (2) **Form a study group** (S — cheapest full-system finish). ⚠️ *Guardrails:* cap classes 2–3, keep `statBonuses` small; **add a join cost/GPA gate to the study group** (near-free happiness otherwise). 🚫 **Avoid/defer Merit stipend** — money-printing unless hard-capped ≤$150/wk total *and* gated to active enrollment. *(Campus-events (M) is a strong Wave A/B alternate — needs v22 + pre-rolled RNG.)*

**Hustle:** (1) **Named-hire productivity payoff** (S — makes the whole hiring loop matter; reuse the `[0.75,1.6]` clamp); (2) **Scandal event engine** (M — activates ~4 dead files). **Mandatory fix:** seed a per-company overlay in `createCompany` + increment `totalCompaniesFounded`. ⚠️ *Balance:* scandal gate+cooldown+bounded drag (caps at 30%). 🚫 **Flag IPO teeth (M) as a money-hazard** (dividends can over-pay) — bound `payoutRate` and net against dilution, or defer. *Wave B:* **Board governance** (L).

**RealEstateApp:** (1) **Bring decoration/rooms/upgrades into the manage flow** (M — unlocks the orphaned 25-item catalog + the value/happiness math already wired to it); (2) **Real portfolio activity timeline** (S — feeds the starved Activity tab). ⚠️ *Money-printing:* keep upgrade bonuses modest + preserve the rent-ceiling clamp; **also delete the dead double-assignment of `housingRentalIncome`.** ⚠️ *Migration:* v22 additive (`realEstateActivity` slice, cap ~40). *(Commercial catalog (S) = cheap Wave A content bonus.)*

**GamingApp/YouVideo:** (1) **Creator Level & Perks** (M — unfreezes the shared "Lv N" badge); (2) **Channel Memberships** (M — **shared module** makes `Members`/`Sub earn` real in both creator apps). 🚫 **Money-printing (memberships):** cap `paidMembers` ≤5% of subscribers, absolute ceiling, reuse the $75k/wk per-source cap. ⚠️ *Migration:* v22 (`perkTier`, `lastMemberWeek`). *(Trending Topics (S) = cheap, safe bonus — lights the dead `trendBonus` hook, already clamped 0..0.5.)*

**GamingStreamingApp/Streamly:** (1) **Channel vitals: live avg viewers + LIVE state** (S — fixes always-OFFLINE + avg-0; negligible risk); (2) **Hype Train streak meter** (M — bounded engaging loop). ⚠️ *Guardrail:* cap streak-boosted hype ≤25% (base 2.5x, 5 streams/wk). ⚠️ *Migration:* v22 (`hypeStreak`). *(Level + Memberships are the shared builds counted under YouVideo.)*

**TravelApp:** (1) **Destination-flavored event pools** (M — finishes the dead `events[]` data; author the referenced ids); (2) **Passport milestones** (S — bounded one-off progression). **Fix:** apply the dropped stress benefit (design decision: route `stressDelta`→happiness/energy since no stress stat exists; style New York's `stress:+5` as a penalty). ⚠️ *Guardrails:* keep event deltas in the existing band; bounded milestones. *Wave B:* **Living businesses (ROI tiers/events/divest)** (L).

**VehicleApp:** (1) **Per-template vehicle specs** (S — fixes identical 120mph/25mpg/50gal for all; **no migration** — owned vehicles keep stored values); (2) **Wire the real accident system + total loss** (M — finishes the tested `accidents.ts`). **Fix:** grant `reputationBonus` on the financed-purchase path (deceptive-value #4). ⚠️ *Balance:* keep total-loss probability low (0.5% floor/cap already present); review mortality. *Wave B:* **Used-car market + trade-in** (L).

**PoliticalApp:** ⚠️ **Input truncated — cannot curate.** No `broken[]`/`proposals[]` were provided. *Recommend completing the audit before planning.* Provisional (grounded only in the visible inventory): the dirty-PAC / `lifetimeDirtyUSD` → "permanent scandal risk" note suggests a **scandal-trigger opportunity paralleling Pulse/Hustle**; PAC's 1.5x spend efficiency and the 80-policy catalog are **economy-sensitive** (guard any approval-buying / money-in-politics compounding).

**Consolidated hazard flags for the implementation agent:**
- **Money-printing (must cap, verify with a test):** Banking live rates (arbitrage invariant), Banking savings goals (pull-from-account), YouVideo/Streamly Memberships (≤5% subs + $75k cap), Education Merit stipend (defer/hard-cap), Hustle IPO dividends (defer/bound), Mining depth bonuses (Wave B; $100k cap), Contacts/Travel Wave-B favors/businesses (caps + expiry + symmetric downside), RealEstate/Vehicle refinance & used-market (charge closing costs, price off resale).
- **Save-migration (batch into a single STATE_VERSION 22, default-fill, read via `??`):** all additive optional fields above. **Only data-preserving migration required: Pet `ownedToys`→`toys`.** No-migration picks: Stocks tilt-to-price, Vehicle per-template specs, Contacts recency/IOUs, Spark jealousy.

---

## 3. CROSS-APP HOOKS (cheap, high-delight)

1. **Spark → Pulse milestone auto-posts** (S) — the ready-made `sparkPulseBridge` (100% unwired) auto-composes a Pulse post on engagement/wedding/divorce/baby/anniversary. `composePost` is bounded and prints no money; add a settings opt-out. *Highest delight-per-effort.*
2. **Life skills → Pulse virality** (S) — implement the declared-but-dead `lastViralBoostBySkill`: leveling writing/video/marketing gives a matching post a bounded boost, capped **1/skill/week** (the field's own contract). Life progress visibly powers Pulse.
3. **Pulse fame → creator reach** (S) — high Pulse followers/influence give a bounded reach boost to YouVideo uploads / Streamly streams; fold into the existing `trendBonus` channel, clamp the combined bonus ≤0.5.
4. **"Economy actually moves markets" theme** (M, coherent bundle) — Banking live rates (`economyState`→APR) + Stocks tilt-to-price + RealEstate macro shocks all make the **shared EconomyEventBanner** meaningful in three apps. Guardrail: one bounded modifier each, preserve existing clamps, no double-count.
5. **Banking interest writers → `crossSystemSummary` integrity** (S) — fixing "Interest earned/paid" also repairs the cross-app financial summary that reads them.
6. **Preserve the working exemplars:** Vehicle `speedBonus`→travel duration and Politics transport policy→travel fares (`transportationMods`) are the *already-wired* pattern to emulate — cite them when building the hooks above.

---

## 4. TWO-WAVE IMPLEMENTATION PLAN

### Prerequisite bug sweep (do before dependent features)
Fix `SCANDAL_TYPE_MAP` keys (Pulse, before scandals); Spark `generateNpcReply` POOL key mismatch; Hustle campaign "paused" path that **deletes** the campaign (`hustleTick.ts:109`) + `projectedROI` multiplier-vs-% rendering; banking interest writers (base for #7 and cross-summary); Pulse "Following" derive from `followGraph.length`; Stocks Detail "Previous close" read `lastWeekPrices`; Vehicle insurance "Weekly premium" amortization; Pet "Feed" button (acts as tab-switch); Education dead `{false && …}` `clearCampusEvent` guard.

### Shared builds (build once)
`applySavingsGoals` + rate-environment table (banking phone+computer); `applyContentMemberships` + `creatorLevel` helper (YouVideo+Streamly); the economy→markets bounded-modifier pattern (banking/stocks/realestate).

### WAVE A — fix-first + all S/M picks (per-app goal statements)

- **BankApp/AdvancedBankApp (Banking):** Make `totalInterestEarned`/`totalInterestPaid` accumulate on the real tick paths so both chips and `crossSystemSummary` stop reading $0. Make savings-goal Contribute debit a linked account (conserve assets, cap at target, bounded completion reward). Add computer-only **budget targets + overspend alerts** and expose the built **account-transfer** action. Ship the **live rate environment** (economyState→deposit/loan APR) with the arbitrage invariant test. Charge or hide the credit-card annual fee and unredeemable rewards. STATE_VERSION 22.
- **StocksApp:** Fold the weekly sector tilt + macro drift into the authoritative module price via `adjustStockPrice` (so it compounds and the board/Movers/banner respond), preserving seed determinism and existing clamps/$1M ceiling. Add a star **watchlist** toggle on rows + detail. Reset `dividendsThisYear` at week%52; add ≥3 Energy + ≥1 Healthcare listings.
- **BitcoinMiningApp:** Replace the static $/wk with the real **per-coin estimator** (multiplier×0.5^halving×price−electricity) via a shared `estimateWeeklyMining`. Add a **manual repair CTA + auto-repair toggle** with atomic affordability re-check. Correct the stale "halving deferred" comment.
- **Spark:** Build the **jealousy confrontation modal** (`activeJealousy`→`resolveJealousy`) — unblocks all future spawns. Build the **Likes-You inbox** gated by `premium.perks.seeWhoLikedYou` with like-back. Increment the 5 dating `lifetimeStats` from `DatingActions` + display them; map catalog personalities into `generateNpcReply`'s POOL.
- **ContactsApp:** Stamp `lastInteractionWeek` (+bump `weeklyInteractions`) in Call/HangOut/Ask/date/gift via a new `recordInteraction` helper — lights recency dots + the Attention tab. Record an owed-by-player **IOU** when `handleAskMoney` grants a loan, add **Repay**, and wire `tickFavors`. Retire dead `interactRelation`/`lastCall`.
- **Pulse:** Ship **Creator Studio (Insights)** reading `lifetimeStats` + a capped `followerHistory`, gated by `analyticsUnlocked` (delivers the paid perk). **Spawn scandals** in the tick (low chance, popular+ gate, cooldown) after fixing `SCANDAL_TYPE_MAP`; seed pile-on comments. Resolve `pendingBoosts`/`whyReason`/ambient-comment affordance per the checklist.
- **PetApp:** Swap `tickPetsForWeek`→`tickAllPets` (`decay.ts`) seeded from the same RNG, reconciling the death threshold and food/happiness side effects (vaccination, breed rates, passive energy, per-sickness drain all become honest). Apply `bondingSummary` deltas in the tick (capped). Collapse `ownedToys`→`toys` with a migration.
- **EducationApp:** Add a **class-picker** to `EnrollModal` (2–3 from `CLASS_TEMPLATES`) populating `enrolledClasses` — lights completion bonuses + exam difficulty + the detail section. Add a **study-group** toggle with a small join cost. Advance `semesterNumber` from progress. *(Do not ship Merit stipend in Wave A.)*
- **Hustle:** Seed a per-company overlay in `createCompany` + increment Founded (new companies join the tick). Wire **named-hire performance** into a bounded income lift (reuse the `[0.75,1.6]` clamp). **Roll organic scandals** (brand/size-gated, cooldown) and write real `totalRevenueLoss`/`finalReputationLoss`.
- **RealEstateApp:** Add an **Improve** section (install decor / add room / upgrade) writing the existing `interior/rooms/upgradeLevel` fields; route the upgrade rent bonus through realized rent and delete the double-assignment. Feed the **Activity tab** from the tick's tenancy/cycle events (capped `realEstateActivity` slice). Add commercial listings + a graceful empty Browse state.
- **YouVideo + Streamly:** Persist **`level` from `experience`** (shared `creatorLevel`) so the badge advances. Build the shared **`applyContentMemberships`** module (≤5% subs → paid members, capped revenue → money + `totalSubEarnings`). Streamly: write `averageViewers`/LIVE state; add the **hype streak** meter. YouVideo: feed `trendBonus` from a weekly **trending topic**.
- **TravelApp:** Merge **destination-specific events** into `rollTripEvents` (author the referenced ids). Apply the dropped **stress benefit** (→happiness/energy) and resolve the intelligence chip. Add **passport milestone** tiers (bounded one-offs).
- **VehicleApp:** Add optional **per-template `maxSpeed`/`fuelEfficiency`/`fuelCapacity`** (fallback to constants — no migration). **Wire `accidents.ts` + total-loss** into `applyVehiclesForWeek` (insurance reduces injury; low total-loss prob). Grant `reputationBonus` on the financed-purchase path; fix the insurance amortization label.
- **PoliticalApp:** ⚠️ **Blocked — re-run the audit** to produce `broken[]`/`proposals[]`, then slot into a Wave-A addendum.

### WAVE B — the L systems (goal statements)

- **Banking — Living credit card loop** (L): wire `spendOnCard`/`redeemRewards`, carried-balance interest + the real annual fee (`applyCardInterestAndFees`); rewards-vs-interest already mitigated (rewards only on repaid principal).
- **BitcoinMining — Surface the mining-depth system** (L): an "Optimize" panel exposing upgrades/pools/energy/automation/staking (all tick-honored today); bounded by the $100k/wk cap + pool-fee tradeoff.
- **ContactsApp — Weekly network favors** (L): high-strength network contacts offer owed-to-player favors (`applyContactFavors`, seeded weekly, per-week cap, expiry) with bounded per-kind redeem effects.
- **Pulse — NPC likes/reposts/replies** (L): `generateReactionsForWeek` fans bounded reactions across recent posts into the (already-built) notification groups + comment threads; reuse the 100-ring/50-thread caps, deterministic seeding.
- **Hustle — Board of directors governance** (L): populate `boardSeats` at IPO (proportional to float), drift satisfaction, add a bounded board-vote decision loop; scope strictly to IPO'd companies.
- **TravelApp — Living businesses** (L): ROI tiers + boom/bust/expansion events + divest (`applyTravelBusinesses`), bounded by the existing $50k/wk cap with symmetric downside.
- **VehicleApp — Used-car market + trade-in** (L): weekly-seeded discounted inventory + trade-in credit priced off `calculateVehicleSellPrice`, capped at real resale value.

**Wave-B gating rule:** each L system carries the heaviest economy exposure — land the Wave-A caps/migrations and the money-printing invariant tests first, then build these behind the same guardrails.