# Whole-app audit — Round 3 (2026-07-31)

Five parallel domain passes: dark web/crime, dating/family, markets & money,
startup/onboarding/saves, progression/careers. **37 findings reported, 15 fixed
so far.** Every finding below carries a file:line anchor from the pass that
raised it; anchors are as-reported and should be re-read before acting, per
CLAUDE.md §8.

Two passes independently caught an error in my own Round 2 GL-4 fix. Both were
right. That is recorded as R3-FIXED-1 below and is the reason the "verify before
you trust, including your own work" rule stays in force.

## Fixed in this round

| ID | Sev | Summary |
|---|---|---|
| R3-FIXED-1 | high | Scenario `achievement` win conditions evaluated against the DEPRECATED `gameState.achievements` array, whose `.completed` has no writer (`evaluateAchievements` is a no-op stub). Every such condition was false whichever id it named. Projection now uses the live system; progress rule deduplicated into one shared function |
| R3-FIXED-2 | med | `isScenarioCompleted`'s type omitted `bankSavings`, so bank balances counted as $0 toward five scenarios' net-worth targets |
| R3-FIXED-3 | low | `GameState['perks']` declared 6 keys while ~20 onboarding perk ids are written to every save; 4 test assertions on them asserted nothing |
| R3-M2 | critical | FIXED — `loanInterestReduction` percent-as-decimal floored every loan at 2.5% from the first elected office. Converted, plus a 6% politics floor so the no-arbitrage contract holds |
| R3-M1 | critical | FIXED — dividend policy accumulated into persistent per-stock yield every week, ratcheting every payer to a permanent 10%. Now a read-time modifier; inflated saves self-heal on load |
| R3-M3 | high | FIXED — annual political salary read as weekly at four duplicated call sites, inflating DTI borrowing capacity 52x. One shared `weeklyCareerSalary` |
| R3-M4 | high | FIXED — `netWorth()` omitted all crypto and all `banking.accounts`; converting cash to BTC dropped reported net worth by the full amount |
| R3-M5 | high | FIXED — savings-goal money was destroyed. Added `withdrawFromGoal` + action + UI on both bank screens, and counted goal balances in net worth |
| R3-P1 | high | FIXED — "Immortality" (50,000 pts) read only `goldUpgrades`; the death roll now also consults `prestige.unlockedBonuses` |
| R3-P2 | high | FIXED — "+25 pts per maxed career" compared a 0-indexed level against `levels.length`, so it was unreachable. Also closed the free-maxed case for a career with no `levels` |
| R3-P3 | high | FIXED — "Social Master" + "Reputation Builder" (23,500 pts) now stack into `applyRelationshipGain`, the single funnel for positive relationship changes |
| R3-F1 | high | FIXED — `fileDivorce` re-checks spouse and cooldown against `prev`; a double-tap no longer charges the settlement twice |
| R3-F2 | high | FIXED — `planWedding` re-checks THIS partner (the bigamy guard deliberately excluded them), so the deposit is charged once |
| R3-C3 | high | FIXED — a flagged dark-web vendor now rebuilds reputation while sitting out and returns above a threshold, instead of the market dying permanently |
| R3-S1 | high | FIXED — the previous life autosaved into `currentSlot` while the player was in the onboarding stack, resurrecting a deleted save and silently reverting backup restores. Ambient `saveGame` is now suspended on every exit from gameplay and resumed on every entry; explicit `forceSave` is deliberately not gated |

## Money — as originally reported (M1-M5 now FIXED, see above)

| ID | Sev | Summary | Anchor |
|---|---|---|---|
| R3-M1 | critical | Political "dividend bonus" policies ADD to each stock's persistent `dividendYield` **every week**, ratcheting every payer to the 10% cap permanently — survives save/reload and policy repeal. Card advertises "+0.5% bonus"; delivers +0.5 points per week, cumulatively | `lib/economy/stockMarket.ts:202-205` |
| R3-M2 | critical | `loanInterestReduction` is a percent (0-100) consumed as a decimal APR. The smallest perk value (2, a Council Member) clamps to 0.2 = 20 APR points and floors EVERY loan at 2.5%. Sibling fields on the same object correctly divide by 100 | `lib/politics/perks.ts:13` · `contexts/game/actions/LoanActions.ts:45-58` |
| R3-M3 | high | Political salaries are ANNUAL but fed to the loan DTI gate as WEEKLY at four duplicated call sites — inflating borrowing capacity 52×. The repo documents the annual/weekly split in two other places | `AdvancedBankApp.tsx:220-234` · `BankApp.tsx:166-175` · `RealEstateApp.tsx:305-315` · `VehicleApp.tsx:168-177` |
| R3-M4 | high | Canonical `netWorth()` omits ALL crypto, ALL `banking.accounts` balances and all savings-goal balances, and ignores credit-card debt. Converting $1M cash to BTC DROPS reported net worth by $1M. Gates prestige, the passive-income soft cap, bail cost, ad rewards | `lib/progress/achievements.ts:38-201` |
| R3-M5 | high | Money contributed to a savings goal is destroyed: no withdraw path, no delete path, counted in no net-worth calculation. The weekly `autoContribute` sweep does it silently | `lib/banking/operations.ts:665-739` · `applySavingsGoals.ts:104-112` |
| R3-M6 | med | The $500k savings soft cap is applied PER ACCOUNT while CDs are explicitly exempt from the one-per-type rule — split deposits bypass the anti-exploit curve entirely | `lib/banking/operations.ts:250-255` |
| R3-M7 | med | Stock capital-gains tax is charged only on limit/stop fills. The default market-sell path is untaxed, so a $1M gain keeps or loses $250k purely by which button was used. Crypto has no such hole | `lib/stocks/weeklyTick.ts:259-288` vs `StockActions.ts:147-169` |
| R3-M8 | med | Credit-card APR is inert — card balances never accrue interest. A maxed $25k card at a stated 17% costs $0 forever | `lib/banking/operations.ts:342-381` |
| R3-M9 | low-med | `economyEvents.modifiers.stockVolatility` and `jobAvailability` are shown in the weekly event modal and read by nothing | `lib/events/economyEvents.ts:115-143` |
| R3-M10 | low | `MoneyActionsContext`'s crypto trio gate-then-grant with `Math.max(0, …)` flooring. NOT player-reachable — only dev-tools callers — but it sits on the public context surface with no warning | `contexts/game/MoneyActionsContext.tsx:303-465` |

## Crime / dark web — all OPEN

| ID | Sev | Summary | Anchor |
|---|---|---|---|
| R3-C1 | critical | 18 of 19 illegal street jobs are permanently unplayable. They gate on `darkWebRequirements` items whose ONLY writer is `buyDarkWebItem`, which has zero call sites. The whole illegal-crime ladder is greyed out forever; the repo's own stress test already works around it | `initialState.ts:184` · `JobActions.ts:197-217` · `ItemActionsContext.tsx:88-116` |
| R3-C2 | high | All 15 crime talent-tree nodes are inert. They cost cash + a permanently-limited skill point and promise up to "+50% stealth success rate"; the job math uses `level` only and never reads `.upgrades` | `SkillTalentTree.tsx:61-99` · `JobActions.ts:231` |
| R3-C3 | high | The dark-web marketplace permanently dies: `flaggedScam` is set-once and never cleared, vendors are never replenished, and two of the four seeded vendors scam at 0.82-0.95. Market tab ends up empty forever with no recovery path | `lib/darkweb/marketplace.ts:101-107` · `operations.ts:115-116` |
| R3-C4 | med | Jail activity "Legal Appeal" requires education id `law_degree`; the real id is `law_school`. Unrunnable by anyone, and leaks the raw internal id to the player | `initialState.ts:587` |
| R3-C5 | med | "Acquire New Identity" enables its button and writes its confirm dialog off the BASE cost, but charges base + debt settlement — so it silently does nothing and returns void, with no alert | `OnionApp.tsx:838,443-447` · `CrimeActions.ts:309-324` |
| R3-C6 | med | `unlockCrimeSkillUpgrade` never re-checks "already unlocked" inside the updater. A double tap appends the node twice and burns TWO skill points out of a lifetime budget of `skillLevel - 1`. Unrecoverable | `JobActionsContext.tsx:126-153` |
| R3-C7 | med | The dark-web economy banner advertises three mechanics (faster heat decay, higher raid risk, higher traffic) that do not exist — the tick receives no economy state at all | `EconomyEventBanner.tsx:55-61` |
| R3-C8 | low | `raid_risk` overstates actual jail-raid chance ~4× (prints P(any police event), not P(raid)) | `OnionApp.tsx:614` |
| R3-C9 | low | Surveillance event promises a decay stall that has no flag and no implementation | `lib/darkweb/weeklyTick.ts:165-173` |
| R3-C10 | low | Dark-web market purchases deliver no item — no purchased-items collection exists — while the confirmation says "Delivered. X is yours." | `lib/darkweb/operations.ts:138-203` |
| R3-C11 | low | `performJailActivity` reads its result out of the updater (see ARCH-1); intermittently pops an empty alert and drops the criminal XP grant | `JobActionsContext.tsx:312-314` |

## Progression — all OPEN

| ID | Sev | Summary | Anchor |
|---|---|---|---|
| R3-P1 | high | "Immortality" (50,000 pts, the most expensive shop item) does nothing. The death roll reads only `goldUpgrades.immortality`, never `prestige.unlockedBonuses`. HelpModal explicitly tells the player the prestige bonus grants it | `applyBonuses.ts:332-334` · `GameActionsContext.tsx:1021-1023` |
| R3-P2 | high | "+25 prestige points per maxed career" is unreachable — off-by-one. `level` is 0-indexed and capped at `levels.length - 1`, so `level >= levels.length` is never true. `careersMaxed` is permanently 0 | `lib/prestige/prestigePoints.ts:67-71,135-138` |
| R3-P3 | high | "Social Master" (20,000) and "Reputation Builder" (3,500×2) are inert — `getRelationshipGainMultiplier` is only used to render its own percentage in the info modal | `applyBonuses.ts:286-299` |
| R3-P4 | med-high | "Eventful Life" (5,000×2) is computed into a discarded local variable | `applyQOLBonuses.ts:70-75` |
| R3-P5 | med-high | "Property Manager" (5,000) sells rent auto-collection that already happens unconditionally every week | `applyQOLBonuses.ts:44-46` |
| R3-P6 | med | `early_item_access` (4,000) and `early_real_estate` (6,000) resolve to comment-only `if` bodies; one helper is not even imported anywhere | `lib/prestige/applyUnlocks.ts:31-41` |
| R3-P7 | med | GPA "Hiring boost ×N on job offers" is rendered on the Education screen and never applied — the acceptance roll has no GPA term. GPA still works for scholarships | `lib/education/gpa.ts:79-83` · `JobActions.ts:750-770` |
| R3-P9 | med | Legacy Pass tier 25 (PAID track capstone) grants trait id `legacy_trait_s`, absent from `GENETIC_TRAITS`. Silently dropped by every reader, including the "heritable" inheritance path | `lib/legacyPass/legacyPass.ts:124` |
| R3-P11 | low-med | Two prestige achievements mint ~7,000 points for default behaviour: "Clean Slate" fires for anyone who never took a loan, "Educated Legacy" for anyone who finished only free high school. The intended first-prestige award is 1,000 | `prestigeAchievements.ts:308-318` |

## Save / startup — all OPEN

| ID | Sev | Summary | Anchor |
|---|---|---|---|
| R3-S1 | high | The previous life keeps autosaving into `currentSlot` while the player is in the onboarding stack — nothing clears `gameState`/`currentSlot` on leaving gameplay. Two traced consequences: (a) death → "Start New Game" resurrects the save it just deleted, then `resolveNewLifeSlot` refuses the slot because it now holds the character the player just buried; (b) a backup restore is silently reverted by the still-loaded pre-restore state | `GameActionsContext.tsx:3555-3577,3397-3445` · `DeathPopup.tsx:324-356` · `saveBackup.ts:894-903` |
| R3-S2 | med | "Restart Game" never reaches disk. The rebuilt state has no name and no scenario, so `isPristineUnstartedState` returns true and `saveGame` bails — the wipe is memory-only and Continue reloads the old life | `components/settings/DangerZone.tsx:48-60` |
| R3-S3 | med | A save from a NEWER build is reported as "No save data found… start a new game". `loadGame`'s outer catch has no `SaveFromFutureError` branch, so both consumers' handlers are unreachable | `GameActionsContext.tsx:4004-4007` |
| R3-S4 | low | A failed post-save load leaves the new character on disk; the retry then refuses the slot, blaming the character the player just created | `gameInitializer.ts:220,239-256` |

## Family / dating — all OPEN

| ID | Sev | Summary | Anchor |
|---|---|---|---|
| R3-F1 | high | `fileDivorce` gates entirely outside the updater — a same-batch double tap charges the whole settlement twice and mints TWO "Divorce Settlement Debt" loans (ids differ by index, so no dedupe). Confirm button has no in-flight guard | `DatingActions.ts:830-842` → `:1016-1118` |
| R3-F2 | high | `planWedding` re-checks other partners inside the updater but not THIS one, so the 25% deposit is charged twice for a single wedding (~$25k on the top venue) | `DatingActions.ts:583-585` → `:628-648` |
| R3-F4 | med | `lifetimeStatistics.totalRelationships` has no writer; the `??` chain never falls through because the field exists as 0. "Social Network — form 25 relationships" sits at 0/25 forever | `statisticsTracker.ts:215-220` |
| R3-F5 | med | Parenting "Bond" effects are inert: children are created at `relationshipScore: 100` (= NURTURE_MAX) so every positive bump clamps to nothing, and the one negative is overwritten by the weekly family rebuild spread | `parentingLogic.ts:186-190` · `GameActionsContext.tsx:2385-2387` |
| R3-F6 | med | The wedding-plan 1-year expiry is unreachable: the branch runs only when `scheduledWeek === nextWeeksLived`, making `weddingAge` always 0. The documented "deposit forfeited" anti-exploit never fires, and the postpone path re-schedules forever | `applyScheduledWedding.ts:106-118` |
| R3-F7 | low-med | Three of five gift tiers have no call site, and the default gift preference names an unbuyable gift — so for ~2/3 of Spark partners the personality gift system returns exactly 1.0 for both purchasable gifts | `DatingActions.ts:294-300` · `npcDepth.ts:40` |
| R3-F8 | low | `child.familyHappiness` has no writer (its would-be setter `updateChildWeekly` has zero callers), so every child contributes a constant 2 to the headline Family Happiness number | `FamilyTab.tsx:149` |
| R3-F9 | low | `haveChild` gates outside the updater. Behind an Alert confirm, so not a live exploit — reported as the pattern. Also contains a dead read of `c.birthWeek`, a field that exists nowhere | `SocialActionsContext.tsx:229-269` |

## Came back clean

Worth recording, so a later round does not re-spend the effort:

- **Week counter (§4.2)** — clean in all five domains. Every cooldown, maturity,
  anniversary, deadline and timestamp checked keys on `weeksLived`.
- **Startup crash risk (§4.6 / Hard Rule #4 / §5)** — clean. No static native
  import anywhere in app source; `React.lazy` only on directly-rendered modal
  leaves; `computer.tsx`/`mobile.tsx` eager; 17 routes, no conflicts.
- **Save format drift (§7)** — clean. STATE_VERSION 27 consistent across code
  and all three docs, versions 2-27 fully migration-covered, all 41 concrete
  defaults mirrored in `repairGameState`, every repair sets `repaired = true`,
  both `undefined`-default carve-outs correctly not backfilled.
- **Slot mis-targeting in the write path** — the four coerce-to-slot-1 guards are
  genuinely gone. One `|| 1` survives at `CloudSyncService.ts:74-81` but only
  names a remote record; no chain to a local overwrite was constructible.
- **Double pay / double count** — the three historically-duplicated streams
  (stock dividends, tenant rent, warehouse mining) are each single-sourced now.
- **NaN / Infinity in money** — well defended; no reachable path found.
- **Skill trees, ambitions, weekly challenges, achievements catalogue, ribbons,
  life chapters** — clean; all ids resolve and all 16 life-skill modifiers have
  a verified gameplay reader.
- **Hard Rule #5 (DatingActions signature trap)** — clean; both dependency calls
  are module form and both injection sites pass module-form functions.
- **Unguarded weekly subsystems** — clean in crime and family.
- **Gate-then-grant in the dark-web action layer** — clean; every action
  re-checks against `prev` and returns `prev` to reject.

## Triage note

R3-M1, R3-M2, R3-M3 and R3-C1 are the four worth doing first: two are runaway
economy breaks, one is a 52× borrowing-capacity error that compounds with the
second, and one makes an entire advertised subsystem unplayable. R3-M4 (netWorth
omitting crypto and bank accounts) is the highest-leverage single fix, because
it gates prestige, the passive-income cap, bail and ad rewards at once.


## R3-C1 — needs a product decision before it can be fixed

18 of 19 illegal street jobs gate on `darkWebRequirements` items whose only
writer is `buyDarkWebItem`, which has zero call sites. Verified: the `items`
fallback cannot cover it either (that catalogue is guitar/bike/smartphone/
computer/suit/bed/gym/passport), and the current Onion app's Market sells
procedurally generated `DarkWebMarketListing`s, not the legacy `darkWebItems`
catalogue. So the whole illegal-crime ladder is permanently greyed out, and
`criminalXp` can only come from the single unlocked job plus jail activities.

This is not a mechanical fix. Three shapes are possible and they are different
games:

1. **Wire the legacy catalogue into the Onion Market** as a fixed "Gear" tab
   alongside the generated listings. Closest to the original intent — the
   requirements and the catalogue already exist and match — but it adds a
   storefront and needs pricing/BTC-vs-cash decisions.
2. **Re-gate the street jobs** on something already obtainable (criminal level,
   heat, opsec) and retire `darkWebRequirements`. Smallest diff, but it deletes
   a designed progression gate.
3. **Have the generated marketplace grant the gear** — make a successful
   purchase of a matching listing set the corresponding `darkWebItems[].owned`.
   Ties the two systems together and gives R3-C10 (purchases deliver no item) a
   fix at the same time.

Option 3 is the one I would recommend: it closes two findings at once and needs
no new UI. But which gear a generated listing maps to is a content decision, so
it is left for the owner.
