# BBQ Bug Report — Compiled & Verified (2026-08-11)

Source: BBQ (TS), 08:23. Every item below was traced to source before being
written down. Each entry states **what BBQ saw**, **what the code actually
does** (file:line), **the root cause**, and a **fix sketch**. Nothing here is
graded from a summary — where a claim turned out to be partly wrong, that is
said plainly.

Legend: **CONFIRMED** = reproduced in source · **CONFIRMED +** = real and worse
than reported · **PARTIAL** = true under a condition BBQ did not hit ·
**AS DESIGNED** = intentional, but the report exposes a gap around it.

> **Amended 2026-08-11 (same day).** Two entries below were over-graded on the
> first pass and are corrected in place — see **B-2** and **D-2**. Both errors
> were mine, both were caught by re-reading the source before writing the fix,
> and both are the failure mode CLAUDE.md §8 warns about: trusting a finding
> without re-reading. The corrections are marked ⚠ where they appear.
>
> A third item is added: **M-1**, a measurement defect in the C-9 ratchet found
> while fixing D-4.

---

## Summary table

| # | Area | Finding | Status | Sev |
|---|---|---|---|---|
| B-1 | Banking | `bankSavings` (the gold piggy) has no player deposit path at all | CONFIRMED + | **P0** |
| B-2 | Banking | ⚠ *corrected* — self-opened accounts are invisible to three DISPLAY surfaces; the canonical `netWorth()` already counts them | CONFIRMED | P1 |
| D-1 | Dark Web | Buyer rep gains +1/purchase against an 80–95% scam wall; pro=10, elite=35 | CONFIRMED | P1 |
| D-2 | Dark Web | ⚠ *corrected* — the vendor sit-out is INTENTIONAL and tested; the real gap is that the scam odds are never shown | AS DESIGNED | P1 |
| M-1 | Meta | The C-9 ratchet under-counts: its regex cannot see a success return through a ternary | CONFIRMED | P2 |
| D-3 | Dark Web | Listings have a 4-week life and refill only on expiry → static board in 4-week blocks | CONFIRMED | P1 |
| D-4 | Dark Web | 5 of 7 listing categories deliver literally nothing; UI still says "is yours" | CONFIRMED + | **P0** |
| D-5 | Dark Web | `darkWebItems`, `cleanBtc`, `dirtyBtc` are excluded from `calculateNetWorth` | CONFIRMED | P1 |
| C-1 | Crime | The crime-tool store has no UI; `buyDarkWebItem` has zero call sites | CONFIRMED + | **P0** |
| C-2 | Crime | 18 of 19 illegal jobs gated on those items → only "Find Lost Items" is playable | CONFIRMED | **P0** |
| H-1 | Hustle | "Cash" → "Payroll" was intentional; the dead `Company.money` field behind it is now deleted | AS DESIGNED | P3 |
| H-2 | Hustle | An acquisition changes ~+2.5% weekly income for a seven-figure price | CONFIRMED | P1 |
| H-3 | Hustle | "Synergy +X%" in AcquireModal overstates the real effect by 4× | CONFIRMED | P1 |
| X-1 | Contradiction | "Own 20 companies" is mathematically unreachable (hard cap 15); pre-prestige cap is 5 | CONFIRMED | P1 |
| X-2 | Contradiction | Network contacts (vendor/lobbyist/business/employee) are read-only | CONFIRMED | P2 |
| X-3 | Contradiction | Nothing in the codebase ever creates a `'friend'` relationship | CONFIRMED + | P1 |
| X-4 | Contradiction | Spark: anti-bigamy means only the first match can ever become a contact | CONFIRMED | P2 |
| X-5 | Contradiction | Non-partner relationships have zero consequence at any score | CONFIRMED | P1 |

---

# B — Banking

## B-1 · The gold piggy has no deposit path. `bankSavings` is write-only by the tick. — **P0**

> "The default savings account that links to the gold piggy still does not work."

**Confirmed, and the previous fix addressed a different half of the problem.**

The amber/gold chip in the HUD renders `totalSavings`
(`components/TopStatsBar.tsx:634`):

```ts
const totalSavings = bankSavings + calculateStockValue();
```

So the piggy is `gameState.bankSavings` plus stock value. `BankBreakdownModal`
reads the same field (`components/BankBreakdownModal.tsx:17,23`) and labels it
"Savings Account".

`bankSavings` starts at `0` (`contexts/game/initialState.ts:23`). Grepping every
write to it across `contexts/`, `lib/`, `utils/` yields exactly three
non-test producers:

| Writer | What it does |
|---|---|
| `GameActionsContext.tsx:2627, 2769` | writes `newBankSavings` from `computeSavingsInterest` — **interest only** |
| `DatingActions.ts:1155` | divorce asset split — reduces it |
| `lib/legacy/inheritance.ts` | reads it for the estate; does not seed a new life |

There is **no action anywhere that moves cash into `bankSavings`.** Interest on
a balance of `0` is `0` (`applySavingsInterest.ts` floors at `Math.max(0, …)`),
so for a new life the gold piggy is mathematically pinned at
`0 + stock value` forever.

**Why the previous fix didn't close it.** `savings-default` is one of the
`MIRRORED_ACCOUNT_IDS` (`lib/banking/operations.ts:44-47`) — a 1:1 weekly
reflection of `bankSavings` rewritten by `mirrorAccountsFromLegacy`
(`lib/banking/weeklyTick.ts:145-165`). Because a manual move on a mirror
desyncs from the legacy field, the action layer treats mirrors as read-only and
`AccountRow` hides every control for them (`components/banking/AccountRow.tsx:85-88`,
copy: *"deposits, withdrawals and closing are handled automatically"*). The last
fix made `openNewAccount` stop counting the mirror against the one-per-type cap
(`BankingActions.ts:168-190`) so a player could open a **second, real** savings
account. That works. But money deposited there lands in `banking.accounts[]` —
**not** in `bankSavings` — so the gold piggy still never moves. BBQ is looking at
the correct symptom of an unfixed cause.

**Fix sketch (pick one, don't do both):**
- **(a) Retire the mirror.** Make the piggy read
  `bankSavings + nonMirrorDeposits(banking.accounts)` and let
  `depositCashToAccount` target `savings-default` by routing it through
  `bankSavings` instead of the account balance. Smallest change; keeps the legacy
  field authoritative.
- **(b) Finish Phase D.** Delete `bankSavings`, make `banking.accounts` the sole
  truth, migrate the legacy balance into `savings-default` on load. Correct, but
  it touches the save format, `calculateNetWorth`, prestige, inheritance,
  achievements and four modals — a real project, not a patch.

Recommend **(a)** for the next build.

## B-2 ⚠ *corrected* · Self-opened accounts are invisible to three DISPLAY surfaces — **P1**

**What the first pass claimed, and why it was wrong.** I wrote that
`calculateNetWorth` ignores `banking.accounts` while the prestige evaluator
counts them, and called it a live two-answers-to-one-question split gating
achievements. That is not what the code does.

The canonical figure is `netWorth()` in `lib/progress/achievements.ts`, and it
**already** counts `nonMirrorDeposits` (line 239), crypto, credit-card debt and
savings goals. `lib/statistics/statisticsTracker.calculateNetWorth` is a
one-line delegation to it, and `ShareLifeCard` calls the same function — a
5-way duplication consolidated by an earlier audit. Prestige agrees with all of
them. The `preTick.ts` copy I cited is imported at `GameActionsContext.tsx:98`
and **never called**; it survives only because
`__tests__/refactor/subsystemEquivalence.test.ts` snapshots it.

**What is actually true.** Three *display* surfaces still exclude
`banking.accounts`, so a funded high-yield account looks like it swallowed the
money even though every gate and achievement values it correctly:

- `components/TopStatsBar.tsx:634` — the gold chip (`bankSavings + stocks`).
- `components/BankBreakdownModal.tsx:23` — the modal that chip opens.
- `components/NetWorthBreakdownModal.tsx:34` — which omits crypto **and**
  accounts while carrying a comment stating *"the itemisation must add up to the
  CANONICAL headline (UX-3)"*. It names the invariant it breaks.

Narrower than first written, but still a real disagreement between the number a
player sees and the number the game uses — and the third case is self-refuting
in its own comment.

**Fixed** in the same change as B-1: all three now add `nonMirrorDeposits`, the
Bank Breakdown itemises each self-opened account, and the Net Worth modal gained
its missing crypto term. The dead `preTick` copy is left in place (the
equivalence snapshot pins it) with a comment saying plainly that it is not
canonical and must not be wired to anything.

---

# D — Dark Web

## D-1 · Buyer rep climbs +1 per purchase against an 80–95% scam wall — **P1**

> "buyer rep is too slow to gain"

**Confirmed.** `updatePlayerReputation` (`lib/darkweb/marketplace.ts:110-120`)
grants **+1** for a common purchase, +2 pro, +3 elite — and **nothing on a scam**.
Gates are `common 0 / pro 10 / elite 35` (`TIER_MIN_REP`, marketplace.ts:150-154).
Players start at `playerReputation: 0` (`initialState.ts:1167`).

At rep 0 only common listings are purchasable, so the *only* rep source is +1 at a
time — **10 successful commons to unlock pro, 35 to unlock elite.** The four seed
vendors and their `vendorScamProbability` (marketplace.ts:70-74):

| Vendor | Rep | Scam chance | Rep-per-attempt (expected) |
|---|---|---|---|
| `b4n3_drop` | 15 | **95%** (capped) | 0.05 |
| `shadow.eth` | 35 | **82%** | 0.18 |
| `zerocool` | 65 | 18% | 0.82 |
| `veil_market` | 80 | 4.7% | 0.95 |

A new player is cash-poor and the cheap listings are the low-rep ones
(`priceMultiplierForReputation`: 0.6× at rep 0 vs 1.6× at rep 100) — so the game
prices the 95%-scam vendor as the affordable option. Expected attempts to reach
pro if you buy cheap: **~200**. Nothing in the UI communicates that the cheap
listing is the trap.

**Fix sketch:** award partial rep on a scam (you still completed a trade — say
+0.5 rounded up every other scam), and/or scale the gain with tier price rather
than tier band. Surface the scam probability as a vendor trust badge — the number
already exists and is never shown.

## D-2 ⚠ *corrected* · The vendor burn-out is INTENTIONAL. The missing piece is the warning. — **P1**

**What the first pass got wrong.** I graded the flagged-vendor sit-out a P0 bug
and proposed letting flagged vendors keep posting. It is a deliberate,
documented, tested mechanic. `__tests__/economy/darkWebVendorRecovery.test.ts`
asserts it directly — the describe block is literally *"the seeded market really
can burn out (guards everything below)"*, with `posts nothing the week it is
flagged` → `expect(listings.length).toBe(0)` and `stays out for a meaningful
number of weeks, not one` → `expect(weeksOut).toBeGreaterThan(4)`. Removing it
would have deleted a designed feature and three of its tests.

**What is actually wrong.** BBQ's experience is real; the cause is one layer up.
`vendorScamProbability` is computed and never shown at the decision point. The
buy dialog read *"Vendor rep 15/100"* — and rep is a sigmoid, not a line, so 15
means a **95%** chance of losing the entire payment. A bare "15/100" reads as
"poor but worth a punt", and because low-rep vendors also price cheapest
(`priceMultiplierForReputation`), the game steered a cash-poor new player
straight at its worst odds, then burned the vendor they had just been steered
into. That compounding produced both "rep is too slow to gain" and "listings do
not shuffle" from one root.

**Fixed** by telegraphing, not by changing the mechanic: the confirm dialog now
states the scam percentage and what a scam costs, and every listing row shows
`scam_risk` — previously hidden below 20%, which made a low risk
indistinguishable from an unmeasured one. The burn-out and its tests are
untouched.

The mechanical detail below stands as the record of why the burn bites so hard,
and is worth reading alongside D-1 when the rep curve is tuned.

> "Most listings are locked behind rep requirements and do not shuffle as week
> past with other options."

**Confirmed, and the mechanism is worse than "slow rotation."**

`updateVendorAfterPurchase` (marketplace.ts:88-104) sets `flaggedScam: true` and
`reputation -= 8` when you get scammed. Then in `refreshMarketplace`
(`lib/darkweb/operations.ts:160-166`):

```ts
for (const vendor of vendors) {
  if (vendor.flaggedScam) continue;   // ← posts NOTHING while flagged
  …
}
```

A flagged vendor recovers at `FLAGGED_VENDOR_WEEKLY_REPUTATION_RECOVERY = 1`
per week and only un-flags at `FLAGGED_VENDOR_RETURN_REPUTATION = 50`
(operations.ts:112-158). So:

| Vendor scammed you | Rep after | Weeks silent |
|---|---|---|
| `b4n3_drop` (15) | 7 | **43** |
| `shadow.eth` (35) | 27 | **23** |
| `zerocool` (65) | 57 | 0 (already ≥ 50) |
| `veil_market` (80) | 72 | 0 |

Combine with D-1: a new player buys from the two cheap vendors, has an 82–95%
chance of being scammed, and thereby **removes half the marketplace for 20–43
game weeks**. The board goes quiet exactly when the player has the least to do.
This, not the rep gates, is what BBQ experienced as "doesn't shuffle."

**Fix sketch:** let a flagged vendor keep posting at reduced volume (1 listing
instead of 3) with a visible "⚠ flagged" badge — the player learns the signal
instead of losing the storefront. Or raise recovery to ~4/wk so the worst case
is ~11 weeks.

## D-3 · Listings live 4 weeks and only refill on expiry → the board is static in 4-week blocks — **P1**

`generateListingsForVendor` hard-codes `lifetimeWeeks: 4` (marketplace.ts:191),
`pruneExpiredListings` drops on `currentWeek - postedWeek >= 4`
(marketplace.ts:207-209), and `refreshMarketplace` only tops a vendor back up to
3 (`if (owned.length >= 3) continue`, operations.ts:162-163).

At week 0 all 12 slots (4 vendors × 3) fill at once. Nothing expires until week 4,
when **all 12 expire together and 12 new ones appear.** The board is therefore
frozen for 4 weeks, then wholly replaced — precisely "if they do [shuffle] it
doesn't [happen] as often."

The rolls themselves are fine: `makeWeeklyRoll(weeksLived)` seeds
`hashStringToSeed(weeksLived, key)` (`utils/seededRoll.ts:21-27`), so the same
vendor key produces a different result each week. The staleness is purely the
lockstep expiry.

**Fix sketch:** stagger `lifetimeWeeks` per listing (`2 + floor(roll*4)`) so slots
free up continuously, or roll one slot per vendor per week regardless of expiry.

## D-4 · Five of seven categories deliver nothing, and the UI claims otherwise — **P0**

> "Everything bought from Vendor has no purpose and is a piece of candy."

**Confirmed.** `contexts/game/actions/CrimeActions.ts:128-142`:

```ts
const DELIVERS_GEAR: MarketCategory[] = ['gear', 'hackingTools'];
if (result.result.outcome === 'success' && DELIVERS_GEAR.includes(listing.category)) { … }
```

`stolenAccounts`, `cardedItems`, `fakeIds`, `services`, `data` — **5 of the 7
categories** — grant nothing but `+1 buyer rep` and `+2 heat`. And `xpReward` is
`undefined` for common tier (marketplace.ts:194), so a common purchase in one of
those five categories yields **only rep and heat, for real BTC.**

The message is wrong regardless (CrimeActions.ts:154-158):

```ts
message: `Delivered. ${snapListing.title} is yours.`
```

The player is told a "New Identity Kit" is theirs. There is no inventory it went
into and no system reads it. That is the exact source of BBQ's "piece of candy."

Even the two categories that *do* deliver deliver the **wrong thing**: the gear
grant takes `items.findIndex(it => !it.owned)` — the next unowned entry in
**catalogue order**, not the item on the listing. Buying "Night Vision" hands you
a "Special USB" because `usb` is first in the array (`initialState.ts:802-810`).

**Fix sketch:** map each listing title to a real payload — the five non-gear
categories should credit something the game already models (dirty BTC for
`data`/`stolenAccounts`, a `fakeIds` unlock that reduces criminal-record
penalties, `services` as a one-shot heat scrub). Until then, change the copy to
match reality rather than promise an item.

## D-5 · Dark-web assets are excluded from net worth — **P1**

> "Doesn't add to net worth or attribute any value to items owned."

**Confirmed.** `calculateNetWorth` (`preTick.ts:135-142`) counts `gameState.items`
(which carry a `price`) but not:

- `gameState.darkWebItems` — they carry `costBtc`, no `price`, and appear in no
  valuation path.
- `darkWeb.cleanBtc` / `darkWeb.dirtyBtc` — these are separate pools from
  `cryptos[btc].owned`, and only `cryptos` is summed. Laundered proceeds are
  worth $0 to net worth, achievements and the prestige threshold.

The BTC one is the sharper bug: a player can run laundering to a large `cleanBtc`
balance and their net worth will not move.

---

# C — Crime Jobs

## C-1 · The crime-tool store does not exist in the UI — **P0**

> "Crime tools were removed. There's no option to buy Stealth Gloves, USB, lock
> pick etc."

**Confirmed, precisely.** The purchase function is alive and correct —
`buyDarkWebItem` (`contexts/game/ItemActionsContext.tsx:91-120`), exposed on the
ItemActions context at line 817. It has **zero call sites in `components/` or
`app/`.** Grep:

```
grep -rn "buyDarkWebItem" --include=*.tsx components/ app/   →   (no output)
```

So the 20-item catalogue in `initialState.ts:802-960` — Special USB, VPN, Proxy
Chain, Exploit Kit, Encryption Suite, Lockpick Set, Slim Jim, Power Tool Kit,
Security Bypass Kit, Stealth Gloves, Crowbar, Malware Kit, Spray Paint, Baseball
Bat, Drug Supply, Night Vision, Silencer, Wireless Hack, Thermal Vision, EMP
Device — is unreachable. Their `riskReduction` / `rewardBonus` fields are read by
`ItemActionsContext.tsx:189-190`, so the items work; there is simply no door.

The `DELIVERS_GEAR` path in `CrimeActions.ts` (D-4) was added as a workaround, but
it awards **catalogue order**, so reaching `gloves` — the item three of the
earliest illegal jobs need — requires **10 successful gear/hackingTools
purchases**, and those two categories are only ~2 of 7 possible rolls per listing.

**Fix sketch:** restore a "Gear" tab in the Onion app that calls `buyDarkWebItem`
directly. The action, the catalogue, the BTC debit and the effect consumers all
already exist — this is a screen, not a system.

## C-2 · 18 of 19 illegal jobs are permanently locked; only "Find Lost Items" is playable — **P0**

> "Making only job available Find Lost Items."

**Confirmed exactly as reported.** Of 31 street jobs in `initialState.ts`, 19 are
`illegal: true`. Their gates:

| Job | Needs (dark-web items) | Crim. Lv |
|---|---|---|
| **Find Lost Items** | **— none —** | — |
| Street Hustle | gloves | — |
| Network Testing | usb | — |
| Street Vending | drug_supply | — |
| Steal Phones | gloves | 1 |
| Steal Laptops | gloves | 1 |
| Vehicle Acquisition | lockpick, slim_jim | 1 |
| Vehicle Relocation | lockpick, slim_jim | 2 |
| Property Acquisition | lockpick, crowbar | 2 |
| Steal Jewelry | lockpick, crowbar | 2 |
| Security Testing | malware_kit, vpn | 2 |
| Hack ATM | wireless_hack | 2 |
| Identity Theft | vpn | 3 |
| Smuggling | night_vision | 3 |
| Steal Safe | thermal_vision | 3 |
| Disable Security | emp_device | 3 |
| High-Stakes Scheme | drill_kit, explosives | 3 |
| Cyber Espionage | malware_kit, vpn, encryption | 4 |
| Elite Contract | silencer, night_vision | 5 |

Every required id exists in the catalogue (no typos — verified), so the data is
sound. The gate is enforced in both the reducer
(`JobActions.ts:219-231`) and the UI (`app/(tabs)/work.tsx:449-473`, which renders
`Need Stealth Gloves` and disables the card). With C-1 unfixed, that message names
an item the player cannot buy.

Knock-on: `criminalXp` and `criminalLevel` can only advance through the one
unlocked job plus jail activities, so the criminal-level requirements above are
also effectively unreachable. The repo's own stress test already works around this
by filtering to jobs with no requirements.

**C-1 and C-2 are one bug.** Restoring the store fixes both.

---

# H — Hustle

## H-1 · "Cash" → "Payroll" — AS DESIGNED — P3

> "Cash was renamed Payroll and given a value for expenses of key hires."

BBQ's read is accurate and the change is deliberate. `CompanyTile.tsx:61-64` and
`CompanyDetailScreen.tsx:392-398` carry the rationale: the old "Cash" metric read
`company.money`, **a field nothing ever writes** — so it displayed `$0` for every
company forever. It was replaced with named-hire payroll, which is real money:
`hustleTick.ts:264-277` deducts `totalSalary` through the cash-delta path.

Residual gap: `money?: number` still exists on the `Company` interface
(`contexts/game/types.ts`) with no producer. Delete it so the next reader doesn't
wire another dead metric.

## H-2 · An acquisition buys ~+2.5% weekly income for a seven-figure price — **P1**

> "Acquisition of another company did not make any changes to the company."

**Confirmed — the effect is real but an order of magnitude smaller than the price.**

`acceptAcquisition` (`HustleActions.ts:744-756`) does exactly three things:
charges `askingPrice`, adds `+3` player reputation, and:

```ts
marketSharePercent: Math.min(85, o.marketSharePercent + offer.synergyBonusPercent / 4)
```

That is the *entire* mechanical payload. No new company entity, no employees, no
change to `weeklyIncome`, `baseWeeklyIncome`, brand or name.

Trace the market-share point through to money. `companyIncomeFactors`
(`hustleLogic.ts:700-724`) computes `share = marketSharePercent / 200`:

- Synergy 20% → `+5` share points → `share` factor `+0.025` → **+2.5% weekly income.**
- Price: `askingPrice = targetAnnualRevenue × (4–10)`, where target revenue is
  `weeklyIncome × 52 × (0.5–1.8)` (hustleLogic.ts:615-618). For a $10k/wk company
  that is roughly **$1M–$9M** for +2.5%.

The bump does *persist* — `recomputeMarketShare` (hustleLogic.ts:546-553) is
cumulative — so this is a balance failure, not a state bug. And the multiplier is
clamped to `COMPANY_FACTOR_MAX = 1.6`, so a mature company that is already at the
cap gets **literally zero** for the purchase, with no warning. `CompanyDetailScreen.tsx:379-383`
does render `(capped)` in the breakdown line, but only after the fact.

**Fix sketch:** an acquisition should move `baseWeeklyIncome` — that is what
buying a revenue-generating business means, and it is the number both cards
render. Fold in a fraction of `estimatedAnnualRevenue / 52`. Then reject the
purchase up front when the multiplier is already clamped.

## H-3 · "Synergy +X%" overstates the effect by 4× — **P1**

> "Synergy another hidden element that needs elaboration?"

`AcquireModal.tsx:99-102` renders the raw field:

```tsx
<Text style={styles.metricLabel}>Synergy</Text>
<Text style={…}>+{offer.synergyBonusPercent}%</Text>
```

`synergyBonusPercent` is `8–30` (hustleLogic.ts:615). The player sees "+24%". The
code applies `/4` (H-2), so 6 share points land, which is `+3%` income. The label
carries no unit and no target — "+24%" of *what* is never stated. A 4× overstatement
on a seven-figure purchase is the single most likely reason this reads as
"did not make any changes."

**Fix sketch:** label the real delta — `+6% market share → ≈ +3% weekly income` —
computed from the same `companyIncomeFactors` the payout uses, so display and
payment cannot drift.

---

# X — Contradictions

## X-1 · "Own 20 companies" cannot be achieved. Pre-prestige max is 5. — **P1**

> "The max amount of companies currently available is 5… There are achievements
> that state you could own 10 or even 20."

**Confirmed, and BBQ's number is right for his state.**

The hard ceiling is `MAX_PER_COMPANY_TYPE = 3` (`lib/business/subsidiaries.ts:46`)
across 5 types (factory, ai, restaurant, realestate, bank) = **15 companies,
absolute maximum.**

But subsidiaries are additionally gated behind prestige
(`CompanyActions.ts:88-95`):

```ts
if (ownedOfType > 0 && !isPrestigeFeatureUnlocked(gameState, 'feature:conglomerate')) { … }
```

`feature:conglomerate` is tier 1 — *"Prestige once to start building a
conglomerate"* (`lib/progress/featureUnlocks.ts:274-279`). So **before the first
prestige the cap is exactly 5, one of each type** — which is what BBQ measured.

Against that, `src/features/onboarding/achievementsData.ts`:

| Achievement | Goal | Reachable? |
|---|---|---|
| Entrepreneur (`company_owner`) | 1 | yes |
| Business Mogul (`company_mogul`) | 5 | yes, pre-prestige |
| Corporate Magnate (`company_magnate`) | 10 | only post-prestige |
| **Company Emperor** (`company_emperor`) | **20** | **never — cap is 15** |

`company_emperor` promises 300 gold for something the code forbids.

Note also the legacy `contexts/game/company.ts:41` still returns *"You already own
this company type"* on a hard one-per-type check. It is not the path
`CreateCompanyScreen` uses, but it is a second `createCompany` that disagrees with
the canonical one and should be deleted.

**Fix sketch:** retarget `company_emperor` to 15 (and rename), or raise
`MAX_PER_COMPANY_TYPE` to 4 (→ 20). Say the prestige gate on the Create screen
before the player counts to five and concludes the game is broken.

## X-2 · Network contacts are read-only — **P2**

> "Contacts are vendors which you can't associate with (business, political)."

**Confirmed.** `aggregateContacts` (`lib/contacts/aggregator.ts`) correctly pulls
vendors, lobbyists, political alliances, travel business contacts and company
employees into one list. But `renderNetworkDetail`
(`components/mobile/ContactsApp.tsx:816-878`) renders only: a hero, an Overview
block (strength / category / managed-in / weekly cost / last contact), a Tags
block, and a **"Back to network"** button. No action of any kind.

The Attention triage card makes the split explicit
(`ContactsApp.tsx:963-990`): personal contacts get *"Call to reconnect · +3 bond"*;
everything else gets *"View profile"*.

`lib/contacts/favors.ts` was clearly built for this — it defines `influence`,
`discount`, `safety` and `intro` favor kinds explicitly for political and vendor
contacts — but `ContactsApp` only ever creates `money` favors, from personal
contacts. The ledger for network contacts is unused scaffolding.

## X-3 · Nothing in the game can create a friend — **P1**

> "Cannot make any friends. Mom Dad children and spouse are all that's available."

**Confirmed, and it is absolute.** `'friend'` is a declared relationship type
(`contexts/game/types.ts:777`) and is consumed in at least six places —
`aggregator.ts:78`, `ContactsApp.tsx:204/1474/1489`, `npcDepth.ts:118/454`,
`SocialActionsContext.tsx:106`, `prestigeExecution.ts:788`.

There is **exactly one producer of any relationship in the entire codebase** —
`SparkActions.ts:643`, which appends `type: 'partner'`. A repo-wide search for
`type: 'friend'` in non-test source returns **nothing.**

So `relationships` can only ever contain the two seeded parents
(`initialState.ts:1039`), children from births, and one Spark partner. The empty
state in ContactsApp reads *"Date, **befriend**, or build family ties to populate
this list"* — advertising a verb that does not exist.

`npcDepth.ts` builds an entire relationship-need system for friends
(`meet_friends: { types: ['partner','spouse','friend'] }`, npcDepth.ts:454) that
can never fire.

**Fix sketch:** the cheapest honest path is to let the Spark "Hang Out" flow, or a
coworker/classmate hook off `currentJob` / `educations`, append a
`type: 'friend'` relationship. Every downstream consumer is already written and
waiting.

## X-4 · Spark: only the first match can ever become a contact — **P2**

> "You can match with as many people as you want on Spark but only the first one
> is a contact."

**Confirmed — this is the anti-bigamy rule doing its job in a system with no
other outlet.** `promoteMatchToRelationship` (`SparkActions.ts:607-612` and again
inside the updater at 620-621) refuses when a romantic partner already exists:

```ts
const existingPartner = findRomanticPartner(gameState.relationships);
if (existingPartner) return { success: false, message: `You are already with ${existingPartner.name}.` };
```

That guard is correct and should stay. The gap is that **promoting to `partner` is
the only promotion Spark has.** Matches accumulate in `sparkApp.matches` with
nowhere to go.

This is X-3 from the other side: with a "promote to friend" path, extra matches
would have somewhere to land and the anti-bigamy rule would stop reading as a bug.

## X-5 · Non-partner relationships have no failure state at any score — **P1**

> "There's no penalty for letting relations go to 1 or bad. They can be at risk
> all they want. Nothing happens."

**Confirmed, and it is structural.** `applyRelationshipHealth`
(`contexts/game/actions/weekly/applyRelationshipHealth.ts`) has three branches:

1. **Branch 1** (lines 67-119) — `partner | spouse` with `score < 30`: after 2
   weeks, rolls breakup (`-25` happiness, relationship deleted) or disappointment
   (`-5` score, `-10` happiness). Real teeth.
2. **Branch 2** (121-130) — `partner | spouse` with `score >= 30`: reset the
   counter.
3. **Branch 3** (133-140) — **everything else**:

```ts
// Branch 3: every other relationship type — just clamp.
return {
  rel: { ...rel, relationshipScore: clampRelationshipScore(rel.relationshipScore) },
  happinessPenalty: 0,
};
```

A parent, child or friend at score `1` gets a clamp and nothing else. No happiness
penalty, no estrangement, no event, no removal — permanently, at any score.

The UI actively advertises a consequence that does not exist. ContactsApp shows an
**"At risk"** counter (`ContactsApp.tsx:1034, 1155`) and a whole Attention triage
tab driven by `contactsNeedingAttention`. BBQ read the label, let them sit at
risk, and correctly concluded nothing was behind it.

**Fix sketch:** give Branch 3 a graded consequence — a small recurring happiness
drag below ~25 for family, and an `estranged` flag at ~10 that removes them from
interactions until repaired. That makes the existing "At risk" counter mean
something without inventing new UI.

---

# R — Found reviewing the fix itself (post-merge)

Both of these were introduced or exposed by the P0 change and are fixed in the
follow-up commit. Recording them because "the fix had a defect" is the part
that usually goes unwritten.

## R-1 · The savings withdrawal could destroy money at the ceiling — **P1**

My first cut of `withdrawCashFromAccount` debited `bankSavings` by the requested
amount and then credited cash via `applyMoneyDelta`, with a comment claiming the
credit would be *refused* if it breached `MONEY_CEILING`.

It is not refused. `applyMoneyDelta` **clamps**:

```ts
const newMoney = Math.min(MONEY_CEILING, Math.max(0, currentMoney + amount));
```

So above the ceiling the savings debit is full and the cash credit is partial —
silently deleting the difference. That is precisely the money-conservation
failure the read-only-mirror rule was written to prevent, reintroduced by the
change that relaxed it. `MONEY_CEILING` is `MAX_SAFE_INTEGER`, so it is only
reachable in an extreme late game, but the invariant should not hold *below a
threshold* — it should hold.

Fixed by deriving the debit from what actually landed
(`credit.stats.money - currentMoney`) rather than from what was asked for, and
bailing if nothing moved. Pinned by *"does not destroy savings when the cash
credit is clamped at the ceiling"*.

**Checked and clear:** the new deposit path does NOT open loan arbitrage. Every
borrow floor is 6% (`PRIVATE_BANKING_APR_CAP`, `POLITICS_LOAN_APR_FLOOR`)
against a `SAVINGS_APR_HARD_CAP` of 5.5%, and both `computeSavingsInterest` and
`effectiveDepositAPR` clamp to that cap — so borrow-low/save-high stays a loss.
`LOAN_APR_FLOOR = 0.025` looks like it breaks this but only floors the
rate-environment delta, never a quoted rate.

## R-2 · `buyDarkWebItem` gated outside its own updater — **P1**

The classic gate-then-grant shape (CLAUDE.md §4.4): the already-owned and
insufficient-BTC checks read `stateRef.current`, and the grant happened inside
`setGameState`. Two taps in one React batch both pass the outer check, and the
second charges BTC for an item already owned.

It had never been reachable — the function had no caller, which is the C-1
defect. Adding the Gear tab made it live, so the guard had to become real:
ownership and balance are now re-checked against `prev` inside the updater,
alongside the `showDeathPopup` guard every sibling action already had.

Worth stating plainly: **wiring up dead code promotes its latent bugs to live
ones.** A dormant writer's guards have never been exercised, so they should be
re-read before it gains a caller, not after.

---

# M — Meta (found while fixing, not reported)

## M-1 · The C-9 ratchet under-counts: its regex cannot see through a ternary — **P2**

`__tests__/refactor/updaterResultRatchet.test.ts` pins the number of functions
that reject inside a `setGameState` updater and then return unconditional
success. Its final filter is:

```js
if (!/\n\s*return \{\s*\n?\s*success: true/.test(body.slice(-900))) continue;
```

That only matches a success return written as a **statement**. A function whose
tail is a ternary —

```ts
return cond ? { success: true, … } : { success: true, … };
```

— is invisible to it. `buyMarketListing` is exactly that shape and has always
belonged to the class (benignly: every inner `return prev` mirrors an outer
guard). Rewriting its tail as `if (…) return …; return …;` while fixing D-4 made
it appear, taking the count 62 → 63 against a ratchet that must never rise.

The tail was left as a ternary so the D-4 copy fix would not smuggle in ratchet
work. But the ratchet's real count is **at least 63**, and the true number is
unknown until the detector also recognises ternary and arrow-body returns.
Worth fixing when the backlog is next worked — with the count corrected upward
in the same commit, since a ratchet that under-measures is the same failure as
one that cannot pass.

**Two control assertions in that file were also broken, and are fixed here.**
Both named `openAccount` — the imported pure op from `lib/banking/operations` —
where the action is `openNewAccount`:

- `expect(current).not.toContain('BankingActions.ts::openAccount')` could never
  fail. The detector keys on exported action names, so that string was not a
  possible member of the list. It asserted nothing.
- The shape check did `src.indexOf('openAccount')`, which matched the **import**
  at offset ~763, then read a fixed 6,000-character window. The real
  `openNewAccount` declaration sits at ~8,300 — it was only passing because the
  intervening code happened to be short enough to drag it inside the window.
  Adding ~1.7k of unrelated code above it pushed the declaration out and the
  control failed, reporting a regression in a function nobody had touched.

Both now anchor to `export const <name>` and assert the declaration exists, so a
rename fails loudly instead of silently slicing an empty string.

---

# Recommended order of work

**✅ SHIPPED 2026-08-11** (branch `claude/bbq-bug-report-dcsfyf`) — no
`STATE_VERSION` bump; every change writes fields that already existed:

1. **C-1 / C-2** — the gear store is back, as a **Gear tab in the Onion app**
   (BTC currency, so the dark web is its correct home). `buyDarkWebItem` finally
   has a caller; all 19 illegal jobs are reachable through their stated
   requirements. The dead `'crime'` mapping in `market.tsx` — a fossil pointing
   at a screen that sells dollars, not BTC — is deleted.
2. **B-1 / B-2** — `savings-default` is a real deposit target, routed through
   `bankSavings` so the weekly re-mirror has nothing to overwrite.
   `checking-default` stays read-only and its exploit guards are re-asserted.
   The three display surfaces now include `nonMirrorDeposits`.
3. **D-4** — delivery resolves through `LISTING_TITLE_TO_ITEM_ID`, so buying
   "Night Vision" grants night vision instead of whatever sat first in the
   catalogue. An already-owned tool is refused **before** BTC moves, and the
   five non-delivering categories no longer claim an item.
4. **D-2** — telegraphed rather than changed: scam odds now appear in the confirm
   dialog and on every listing row.

Also: the Help modal described three Onion tabs and now describes four, and
**M-1** fixes two control assertions that were measuring nothing.

Coverage added — `__tests__/banking/legacySavingsDeposit.test.ts`,
`__tests__/economy/darkWebDelivery.test.ts`,
`__tests__/economy/crimeToolsReachable.test.ts`. All three **fail on the
pre-fix code** (verified by stashing the fix and re-running), so they detect the
bugs rather than merely documenting the repair. Full suite: 526 suites / 6,633
tests green; test-tree type errors holding at 0.

**✅ ALSO SHIPPED 2026-08-11** — batch 2, again with **no `STATE_VERSION` bump**:

5. **X-3 / X-4** — `promoteMatchToFriend` is the second producer of
   relationships the game has ever had. A Spark match can now become a friend
   instead of only a partner, which is what made every match after the first a
   dead end: the anti-bigamy guard was right, there was simply nowhere else for
   a match to go. It stays untouched. The friend's TYPE lives on the
   relationship, so `SparkMatch.promoted` remains a plain boolean and the save
   format is unchanged. Six previously-dead consumers of `'friend'` come alive
   with it, including `npcDepth`'s `meet_friends` want.
6. **X-5** — branch 3 of `applyRelationshipHealth` has consequences. Family and
   friends below `NEGLECT_THRESHOLD` (25) cost happiness weekly; a friend
   neglected for 4+ sustained weeks can fade out of the save entirely. Family is
   deliberately never removed — deleting a parent would break inheritance, the
   family tree and every `parent`-typed consumer, so estrangement is a standing
   cost instead. The threshold sits below the UI's "at risk" cutoff (strength
   < 50) so the Attention tab warns before anything bites. Reuses the existing
   optional `weeksAtLowRelationship`, so again no new field.

Coverage: `__tests__/social/friendsAndNeglect.test.ts` (18 cases). Full suite
527 suites / 6,657 tests green; coverage ratchet OK; C-9 ratchet back to exactly
its 62 baseline (see below).

**✅ ALSO SHIPPED 2026-08-11** — batch 3, still **no `STATE_VERSION` bump**:

7. **X-1** — `company_emperor` retargeted from an impossible 20 to **15**, the
   real ceiling (5 types × `MAX_PER_COMPANY_TYPE`). Retargeted rather than
   raising the cap: 3-per-type is a documented balance decision in
   `lib/business/subsidiaries.ts`, and moving it to satisfy an achievement is
   the tail wagging the dog. `companyGoalsAreReachable.test.ts` now pins the
   relationship between the two numbers, which nothing connected before — an
   achievement table and a gameplay cap in different files with no assertion
   between them is exactly how a 300-gold promise stayed impossible.
8. **H-1** — `Company.money` deleted. Deleting it surfaced four test fixtures
   that had been setting it, which is the point: a field nothing reads still
   gets written by people who assume it matters.
9. **H-2 / H-3** — an acquisition now adds the target's weekly revenue to
   `baseWeeklyIncome`, recomputed through the same headcount multiplier the
   upgrade and hiring paths use, so the three cannot disagree about what a
   company earns. The synergy share bump is kept — it is now the smaller half of
   a real payload instead of the whole of a token one. This also fixes the case
   that returned **literally nothing**: a company already at
   `COMPANY_FACTOR_MAX` could not gain from a share bump at all. The modal
   headline is now the added weekly income (derived from the same term the
   action applies) with synergy shown as the share points it really moves,
   replacing a "+24%" that overstated its effect 4×.

   ⚠ **Left for balance review, deliberately:** `askingPrice` is 4–10× the
   target's annual revenue, so simple payback is 208–520 game weeks. That is a
   realistic multiple and a slow one. Changing it is an economy decision, not a
   correctness fix, so it is untouched and flagged rather than quietly tuned.
   Note also `PER_SOURCE_CAPS.companies` caps total company income at $200k/wk,
   so past that ceiling an acquisition buys market share and valuation, not cash.

**Then (not done) — recommended order:**
10. **D-1 / D-3** — rep curve and listing rotation. Pure balance.
11. **M-1** — teach the C-9 detector to see through a ternary, and correct the
    ratchet upward in the same commit.
12. **D-5 (downgraded to P2)** — dark-web pools in net worth. `cleanBtc` has an
    exit path via `withdrawCleanBtc`, so it is a transient staging pool rather
    than a permanent hole, and there is a defensible argument that dirty money
    should not score at all.
13. **X-2** — network contacts are read-only. This is feature work, not a bug:
    `lib/contacts/favors.ts` already defines `influence` / `discount` / `safety`
    / `intro` favor kinds for exactly these contacts, and nothing produces them.

**Cross-cutting note.** Six of these — B-1, D-4, C-2, H-3, X-2, X-5 — share one
shape: **the UI states an outcome the code does not produce.** "Deposits handled
automatically", "Delivered, is yours", "Need Stealth Gloves", "Synergy +24%",
"At risk", "Date, befriend". A player cannot distinguish a missing feature from a
broken one, so every one of them arrives as a bug report. Worth a standing check:
when a system is stubbed, the copy in front of it has to say so.
