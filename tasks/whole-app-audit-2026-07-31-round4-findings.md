# Whole-app audit — Round 4 (2026-07-31)

Five parallel Opus passes, including one **adversarial pass whose only brief was
to break the Round 3 fixes**. That pass found four real defects in my own work,
each with a probe. Every one of them had a Round 3 test that passed — because
the fixture avoided the input that breaks. That is the single most useful result
of this round and the reason the pass existed.

Anchors are as-reported and should be re-read before acting (CLAUDE.md §8).

---

## 1. Regressions in my own Round 3 fixes (adversarial pass)

All four fixed, each with a regression test proved RED against the pre-fix tree.

| ID | Sev | Summary |
|---|---|---|
| R4-REG-1 | high | FIXED — `netWorth()` double-counted cash and savings. R3-M4 added a raw sum of every `banking.accounts` balance on top of `stats.money + bankSavings`; the mirror accounts (`checking-default`, `savings-default`) are overwritten with those exact legacy fields on step 1 of every tick. Roughly doubled the figure that gates prestige, the $10M achievement, ambitions, the leaderboard, the passive-income cap, bail and ad rewards. Now `nonMirrorDeposits`. The R3 test missed it because its fixtures used ids like `chk`/`hysa` and left both mirrors at 0 |
| R4-REG-2 | high | FIXED — the same mirror double-count in `prestigeExecution`'s scenario projection, where the evaluator computes `money + bankSavings` itself. The five net-worth scenarios paid their one-time gems at roughly half the stated threshold |
| R4-REG-3 | high | FIXED — `withdrawFromGoal` was a money printer. It cleared `completedWeek` on withdrawal with a comment claiming that stopped the reward being farmed; `contributeToGoal` REJECTS while that flag is set, so clearing it re-armed the payout. Fund a $25,000 goal, withdraw it all back, fund it again — unbounded at the cap per cycle. `completedWeek` is now permanent |
| R4-REG-4 | med | FIXED — R3-M2's APR floor missed two of four call sites. `VehicleActions` and `EducationActions` both read `politicsAprReduction` and neither floored it, so a high-office player financed a car and a degree at the 2.5% minimum against a 5.5% CD. My completeness test hardcoded the two files the fix had touched; it now discovers call sites by search and asserts the rate behaviourally |
| R4-REG-5 | med | FIXED — `netWorth` still ignored credit-card debt, which R3-M4's own finding text called out and R3-M8 then made compound weekly |
| R4-REG-6 | low | FIXED — `nonMirrorDeposits` threw on a null account row, newly reachable now that `netWorth` calls it |

**The lesson, recorded for `tasks/lessons.md`:** a regression test that passes is
not evidence the bug is fixed. It is evidence the fixture does not contain the
bug. Every fix in this round therefore ships with a control assertion that fails
if the guard is too broad, and with the fixture built from the same shape the
weekly tick actually produces.

---

## 2. Monetization

| ID | Sev | Summary | Status |
|---|---|---|---|
| R4-MON-2 | high | Revive (`REVIVE_GEM_COST` 15,000 — a $49.99 pack) re-checked affordability against `prev` but not `showDeathPopup`, so a double tap charged twice for one revive | FIXED |
| R4-MON-3 | high | `recoverFromScandal` (500 gems, or $5,000 on the lawsuit branch charged OUTSIDE the updater) and `boostProfile` (50 gems) each charged twice for one purchase in a single React batch. The R8 pass closed the "second grant is free" half; this is the other half — with gems for two, the second tap buys nothing | FIXED |
| R4-MON-4 | critical | The Legacy Pass premium track was revoked on cold start for paying players. `SubscriptionReconciler` computed `plusActive` ABOVE the `loadPurchases()` await it added for MON-1, and `reconcileLegacyPassSeason` had no `entitlementCheckAuthoritative` guard. `premiumOwned` gates `getClaimableTiers(pass, 'premium')`, which `getUnclaimedEarnedRewards` uses — so a season boundary crossed inside that window drops every unclaimed premium reward and resets the pass. Permanent | FIXED |
| R4-MON-5 | high | The $99.99 Mega Pack, described as "Everything Unlocked", granted neither the four perks (sold separately at $6.99) nor any of the four banking entitlements ($4.99/$2.99/$3.99/$9.99) — those were written only from a `switch (productId)`, and this product's id is `GEMS_MEGA`. ~$28 of separately-sold entitlements missing | FIXED |
| R4-MON-5b | high | The MON-5 fix put permanent entitlements on a product that is (rightly) a CONSUMABLE, and both restore loops skip consumables wholesale to avoid re-crediting currency. So the newly-promised $28 of unlocks could never be RESTORED, while the same entitlements bought a la carte restored fine — reinstall, tap Restore Purchases, get nothing. Skipping the whole product was the wrong granularity; the product is mixed, so the restore is now mixed too (`hasPermanentEntitlements` + an `entitlementsOnly` apply threaded through the in-memory updater AND the disk path) | FIXED |
| R4-MON-6 | high | The ad orb's no-fill courtesy reward was capped by a MODULE-LEVEL boolean whose own comment said the cap exists because "a whale could farm the capped reward on every respawn with NO ad ever shown (~$10M/hr)". A module variable resets on app restart, so the farm was force-quit-and-relaunch. Now `settings.lastNoFillGrantWeek`, one grant per GAME week. **STATE_VERSION 27 → 28** | FIXED |
| R4-MON-1 | — | Re-derived as the ordering half of MON-4 | FOLDED IN |

---

## 3. Cross-cutting exploits and inert systems

| ID | Sev | Summary | Status |
|---|---|---|---|
| R4-X3 | critical | Politics transport effects are PERCENTS; `transportationMods` read them as fractions (`Math.min(1, 25) * 100` = 100%). ANY enacted transport policy — one $100,000 bill at career level 2 — made every travel destination FREE forever, turning a paid system into an unlimited happiness/intelligence/reputation farm. Four pre-existing tests encoded the fraction reading and are corrected | FIXED |
| R4-X5 | high | `refuelVehicle`, `repairVehicle` and `getDriversLicense` each gate on the stale outer snapshot and debit with `Math.max(0, money - cost)`. A double tap charged twice for nothing; on a thin wallet the floor zeroed the player's cash rather than declining | FIXED |
| R4-X8 | high | `acceptAcquisition` re-checked affordability and folded in reputation, but never re-checked that the offer was still pending. A double tap charged the asking price twice (seven figures), added another +3 reputation and synergy bump, and double-counted `totalAcquisitionsCompleted` | FIXED |
| R4-X1 | high | The Mindset system narrated effects it never applied. `getMindsetFeedback` returned the message and discarded the deltas; its only caller is the only place in the app that touches Mindsets at all. The game said "Frugal: You saved a bit extra (+120)" and credited nothing | FIXED |
| R4-X4 | high | Luxury insurance was strictly dominated by ~100×. `RESTORE_COST_PER_POINT_PCT` was documented as a fraction and divided by 100 again at all three call sites, pricing restoration and the deductible at 1/100th of intent. Never insuring was optimal by two orders of magnitude — the exact inverse of the module's stated design | FIXED |
| R4-X7 | med | Eight policy effects declared, priced and rendered on the card the player reads before spending $100,000–$300,000, with nothing behind them. `economy.inflationRate` WIRED (inflation is a real weekly system, and the aggregator had no `economy` slice at all). The other seven listed in `INERT_POLICY_KEYS` and no longer rendered — they describe systems that do not exist | FIXED |
| R4-X2 | med | Five automation prestige bonuses have no state writer | OPEN |
| R4-X6 | med | An enhanced event promises five follow-ups that do not exist | OPEN |

---

## 4. Still open

### Needs a product decision, not an audit fix

The seven `INERT_POLICY_KEYS` are hidden rather than wired because the systems
they describe are absent, not broken:

- `realEstate.priceModifier`, `realEstate.propertyTaxRate` — there is no
  property-tax system, and property prices are static.
- `crypto.priceStability`, `crypto.regulationLevel` — nothing reads either.
- `technology.rdBonus`, `technology.patentBonus`, `technology.innovationGrants`
  — `lib/rd/patents.ts` has **zero production callers**. The whole R&D/patent
  system is unreachable from the app.
- `economy.priceIndex` — no policy in the catalogue even sets it.

The keys stay on the schema and in the catalogue deliberately: deleting them
would be a data change with no gameplay effect that also erases the record of
what these policies were meant to do. When one of those systems lands, add its
row back to `PoliticalApp`.

`lib/crypto/marketModel.ts` is in the same position — `stepPrice`, `nextRegime`
and `sampleRegimeDuration` have no production callers either. Worth a separate
look at whether the crypto price walk the app actually runs is the one that was
designed.

### Carried forward, unchanged

**R4-X2** — five automation prestige bonuses with no state writer.
**R4-X6** — an enhanced event that promises five follow-ups with no
implementation.
**PERF-A1** — `app/_layout.tsx` root full-state subscription. Same class as the
open PERF-7 remainder; needs device measurement, not more static analysis.
**TICK-A2/A3/A4** — a stale challenge-evaluation snapshot, five unguarded `.map`
loops in the tick, and the weekly recap computed before eight cash movements.
**F1 and F2 are FIXED.** The death screen's "Prestige Points Earned" preview
used its own formula — `(netWorth/10000) + (weeksLived/5) +
(achievements*20) + (prestigeLevel*100)` — sharing not one term with
`calculatePrestigePoints`, the function that awards them. It invented two terms,
paid double per achievement and paid for every achievement rather than only the
newly credited ones (defeating the H-5 anti-farm rule), and omitted the
generation, age, career, property, company and child bonuses, the 1.1^level
multiplier and the +25% child-path bonus. A mid-life player with two prior
prestiges was previewed 950 points against 658 awarded — a 44% overstatement,
quoted at the exact moment they decide whether to prestige, while
`PrestigeModal` was already calling the real function. Both surfaces now quote
one number.

`PrestigeModal` was rendered in `DeathPopup` against a state nothing ever set
to true. It is now removed rather than wired to a button, and the reason is
written at the removal site: the modal calls `executePrestige` on confirm,
which rebuilds the save, and the death screen already owns that transition
through `startNewLifeFromLegacy`. Two live competing paths to end one life is
how the heir flow loses a save.

**F5–F8** — remaining UI-truth findings: a food-price inflated/raw mismatch,
Help text describing a hacks UI that does not exist, a Verified Pro "no ads"
perk, and an evict flow with no confirmation.

**F3 is FIXED** — `payBail` re-derived the cost and re-checked affordability
against `prevState` but never re-checked `jailWeeks`, so a second tap in the
same batch charged a player who was already out. `computeBailCost` has a $500
floor and scales to a $250,000 cap, so at zero weeks it still bills.

**F4 was checked and is already correct** — `purchasePassport` re-checks
ownership against `prev` and debits through `applyMoneyDelta`. Pinned with
tests rather than left to be re-found.

**ARCH-1**, **PERF-3** and the **PERF-7 remainder** stay open with the reasoning
recorded in the round 2 file.

---

## 5. Endemic-classes sweep (2026-08-01)

A cross-cutting pass over the modules rounds 1-4 had not visited. Money bugs
closed so far:

| ID | Sev | Summary | Status |
|---|---|---|---|
| C-3 | high | `buildRDLab` was the textbook gate-then-grant: affordability read from the stale snapshot, the updater re-checked NOTHING, and the debit floored with `Math.max(0, …)`. Its three siblings in the same file all carry the fix and cite it. `CompanyDetailScreen` renders all three lab tiers as live buttons at once with no latch, so one batch could be charged $1,200,000 and end with one lab. The updater now re-derives the cost from `prev`'s lab, rejects an already-built tier, and rejects rather than flooring | FIXED |
| C-7 | med | `buyPet` builds the id OUTSIDE the updater, so a re-invoked updater (StrictMode replays it) appends the SAME object twice — two roster rows sharing one id, after which one feed feeds both and weekly food is charged twice for a pet bought once. Rejects on a duplicate id | FIXED |
| C-6 | med | `payForVet` re-checked affordability but no precondition, so a tap on a pet the visit cannot help was still charged, up to $1,500 for Surgery | FIXED |

**Two of the three findings were mis-stated by the sweep, and my first tests
encoded the mis-statement.** C-7 was reported as "two taps add two pets for one
payment" and C-6 as "two taps charge twice". Two `buyPet` CALLS legitimately buy
two pets and charge for two; a second checkup on a 40-health pet genuinely heals
more. Both tests failed, and the failing side was mine, not the code's. The
fixes are scoped to what is actually wrong and the controls now assert the
behaviour I first mistook for the bug, so it cannot be "fixed" later.

Still open from the sweep: C-1 (Commitment system inert — needs a product
decision), C-2 (family-business brand/reputation, same), C-4 (Weekly Modifiers
card asserts a Sickness penalty no system applies), C-8/C-9/C-10 (the
read-out-of-updater idiom, ~15 action modules — messaging lies, money is safe),
C-11 to C-14.

### Player reports (1.4 bug-reports), fixed

- Savings unopenable and undepositable — the one-account-per-type rule counted
  the mirror accounts, and the failure was silent.
- Family Income shown at 28x what the player receives.
- Political promotion bypassed the office age gate from the Work tab, and left
  the two screens reporting different ranks.
- Diet-plan gains advertised at 7x what the tick applies.
- Death-screen prestige points overstated 44%.

**Modal close-button hit targets and the Life Skills confirm are FIXED.** An
accessibility pass measured every close control and found one shape: a
`scale()`d icon in a container with no minimum size and, where a `hitSlop`
existed, a RAW literal beside the scaled icon. That is why nothing reached 44pt
— `scale()` clamps at 1.3 on phones and no shipping iPhone reaches the clamp, so
`scale(20)` is 23 and `hitSlop={10}` gives 43, one point short on the widest
phone Apple sells. `utils/touchTargets.ts` now owns the minimum, and 25 controls
use it: the five the player named, the four destructive icon-only buttons, and
the 15 transaction sheets where BOTH escapes were unnamed (a full-screen
backdrop that focused and announced nothing, plus an unlabelled X, with no iOS
`onRequestClose` — a screen-reader user had no named way out of a sheet that
spends money).

Life Skills now confirms before spending, quoting the node's effect and cost —
the effect string always existed, it was just shown in the SUCCESS alert after
the unrecoverable spend. The same handler's C-10 read-out-of-updater is closed
with it.

Still open: HUD font size, and reputation not being viewable anywhere.
