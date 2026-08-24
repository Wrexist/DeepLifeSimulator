# Price points — what changed, what to change in the consoles

Written 2026-08-24, after the paywall/pricing work merged to `main` (PR #160 and
the earlier "real prices" pass). Companion to `docs/IAP-SETUP.md` (iOS catalog),
`docs/GOOGLE_PLAY_RELEASE_PLAN.md` §8 (Play catalog), `docs/REVENUECAT-SETUP.md`
(trial + RC wiring) and `docs/IAP-PRICE-ROTATION.md` (temporary sales).

---

## 1. What actually changed in the app

No price VALUE changed in the repo. What changed is **where prices come from
and what claims the app is allowed to derive from them**:

1. **The paywall (`SubscriptionModal`) renders only store-reported prices.**
   The `$4.99` / `$49.99` / `$79.99` strings in `utils/iapConfig.ts` and
   `SUBSCRIPTION_CONFIGS` are now fallback LABELS, shown only where no store
   exists (Expo Go, web preview) and always with the buy button disabled. On a
   real device, if a SKU is missing/not live in the console, the paywall shows
   a placeholder and **refuses to offer the purchase** instead of quoting a
   config price. A console mistake is now visible as a dead paywall, not a
   wrong number.
2. **"SAVE n%" on the yearly plan is computed, not declared.** It appears only
   when monthly and yearly both return numeric same-currency store prices and
   yearly < 12 × monthly. At $4.99/mo vs $49.99/yr that renders "SAVE 16%".
   Change either price in the console and the badge follows automatically.
3. **Trial copy is store-driven.** "Start 7-Day Free Trial" is promised only
   when the store confirms the product carries a **free-trial introductory
   offer** AND this player is eligible. If the intro offer is not configured
   in the console, the app now (correctly) says nothing about a trial.
   `DEEP_LIFE_PLUS_FREE_TRIAL_DAYS` in `lib/subscription/deepLifePlus.ts` is
   only the advertised fallback length and the kill switch (0 = hide all
   trial copy).
4. **The weekly-offer SAVE badge and the gem shop's gems-per-unit line went
   live** (the adapter now preserves the numeric price). They also read only
   real store prices.

**Consequence:** changing a price point is a **console operation**. The repo
has exactly three reference spots that must be kept in sync afterwards, and one
test that enforces half of it:

| Repo spot | Why it exists | Enforced? |
|---|---|---|
| `utils/iapConfig.ts` `price` strings | fallback labels + regular-price reference | `lib/offers/__tests__/catalogue.test.ts` fails if it disagrees with the offers catalogue |
| `lib/offers/catalogue.ts` `regularPriceUSD` | the baseline SAVE% is proven against | same test |
| `SUBSCRIPTION_CONFIGS` (+ docs tables) | paywall fallback labels, docs | by eye |

If a store price is changed and these are left stale, nothing lies to the
player (store price always wins on device) — but a weekly offer can silently
gain or lose its SAVE badge, which is why the test exists.

---

## 2. The complete console catalog (what must exist, with the current price points)

### App Store Connect — one-time products (26)

Consumable: `deeplife_gems_100` $0.99 · `deeplife_gems_500` $4.99 ·
`deeplife_gems_1000` $9.99 · `deeplife_gems_5000` $19.99 ·
`deeplife_gems_15000` $49.99 · `deeplife_gems_50000` $99.99 ·
`deeplife_gems_starter` $9.99 · `deeplife_gems_premium` $24.99 ·
`deeplife_gems_ultimate` $49.99 · `deeplife_gems_mega` $99.99 ·
`deeplife_youth_pill_single` $4.99 · `deeplife_youth_pill_pack` $19.99 ·
`deeplife_money_boost` $7.99 · `deeplife_skill_boost` $12.99 ·
`deeplife_work_boost` $1.99

Non-consumable: `deeplife_remove_ads` $2.99 · `deeplife_lifetime_premium`
$79.99 · `deeplife_mindset_perk` $1.99 (iOS-only id — Apple reserves the
deleted `deeplife_mindset`) · `deeplife_fast_learner` $1.99 ·
`deeplife_good_credit` $1.99 · `deeplife_unlock_all_perks` $6.99 ·
`deeplife_premium_credit_card` $4.99 · `deeplife_financial_planning` $2.99 ·
`deeplife_business_banking` $3.99 · `deeplife_private_banking` $9.99 ·
`revival_pack` $2.99 (no `deeplife_` prefix — exact string)

### App Store Connect — subscriptions (one group, "DeepLife+")

- `deeplife_premium_monthly` — $4.99 / month
- `deeplife_premium_yearly` — $49.99 / year
- **Each** needs an Introductory Offer: **Free Trial, 7 days**, all
  territories, no end date — this is what the paywall's trial copy keys off.

### Google Play — in-app products (26) and subscriptions

Same ids and prices as iOS with ONE difference: Play uses **`deeplife_mindset`**
(not `_perk`). Subscriptions follow Play's subscription → base plan → offer
model: `deeplife_premium_monthly` (base plan `monthly`, $4.99) and
`deeplife_premium_yearly` (base plan `yearly`, $49.99), each with a 7-day
free-trial offer, everything set **Active**.

### Known open items (per the docs' live-status notes)

- iOS catalog was reported complete 2026-07-17; the **7-day intro offers were
  not part of that report — verify them**, they are now load-bearing.
- iOS launch blocker: deploy `server/iap-verify` + set
  `EXPO_PUBLIC_IAP_VERIFY_URL` / `EXPO_PUBLIC_IAP_VERIFY_TOKEN` (IAP-SETUP
  Part 4). Not a browser task.
- Play catalog: not yet reported created — full §8 pass needed.
- Optional: dedicated `gems_50000.png` store art.

### If you adopt a different price point (e.g. yearly at $29.99)

The 2026-06-19 strategy doc floated **$4.99/mo + $29.99/yr** as a price test;
what shipped in the consoles was $49.99/yr. Both are legitimate — $29.99/yr
reads "SAVE 49%" and converts harder, $49.99/yr earns more per subscriber.
Changing it is: App Store Connect → subscription → Subscription Prices → plan
change (choose **preserve price for existing subscribers**), the same in Play
on the base plan, then sync `SUBSCRIPTION_CONFIGS` + the docs tables in one
commit. Nothing else in the app needs touching — the paywall, the per-week
line and the SAVE badge all recompute from the store.

---

## 3. Copy-paste prompt for Claude in Chrome

Paste the block below into Claude in Chrome while signed in to App Store
Connect (and again for Play Console). It is written audit-first: it changes
nothing until it has shown you the gap list.

```text
You are helping me reconcile the in-app-purchase catalog for my mobile game
"DeepLife Simulator" (bundle id com.deeplife.simulator) against what the app's
code expects. Work in two phases: AUDIT first, then FIX only what I approve.

SAFETY RULES (hard):
- Never delete or deprecate any product, subscription, offer, or localization.
- Never submit anything for review without asking me first.
- For any price change on a LIVE subscription, always choose the option that
  preserves the current price for existing subscribers; never the option that
  requires existing subscribers to consent to an increase.
- If a page looks different from these instructions, stop and tell me what
  you see instead of guessing.

PHASE 1 — AUDIT (read-only):
In App Store Connect (https://appstoreconnect.apple.com): open My Apps →
DeepLife Simulator → Monetization. List every In-App Purchase and every
Subscription with: product id, type, price (US storefront), state (e.g.
Ready to Submit / Approved / Missing Metadata), and whether it is Cleared
for Sale. For each subscription also open Subscription Prices → View all
Subscription Pricing → Introductory Offers and record whether a FREE TRIAL
introductory offer exists, its length, and its territories.

Compare against this expected catalog and report every mismatch (missing
product, wrong id, wrong type, wrong price, not cleared for sale, missing
review screenshot/localization, missing intro offer):

CONSUMABLE (price USD):
deeplife_gems_100 0.99 | deeplife_gems_500 4.99 | deeplife_gems_1000 9.99 |
deeplife_gems_5000 19.99 | deeplife_gems_15000 49.99 |
deeplife_gems_50000 99.99 | deeplife_gems_starter 9.99 |
deeplife_gems_premium 24.99 | deeplife_gems_ultimate 49.99 |
deeplife_gems_mega 99.99 | deeplife_youth_pill_single 4.99 |
deeplife_youth_pill_pack 19.99 | deeplife_money_boost 7.99 |
deeplife_skill_boost 12.99 | deeplife_work_boost 1.99

NON-CONSUMABLE (price USD):
deeplife_remove_ads 2.99 | deeplife_lifetime_premium 79.99 |
deeplife_mindset_perk 1.99 | deeplife_fast_learner 1.99 |
deeplife_good_credit 1.99 | deeplife_unlock_all_perks 6.99 |
deeplife_premium_credit_card 4.99 | deeplife_financial_planning 2.99 |
deeplife_business_banking 3.99 | deeplife_private_banking 9.99 |
revival_pack 2.99   (NOTE: exactly "revival_pack", no deeplife_ prefix)

SUBSCRIPTIONS (one group named "DeepLife+"):
deeplife_premium_monthly 4.99/month | deeplife_premium_yearly 49.99/year
Each must carry an Introductory Offer: Free Trial, 7 days, all territories,
no end date.

Present the mismatches as a numbered checklist and STOP.

PHASE 2 — FIX (only items I approve from your checklist):
- Create any missing product with the exact id, type, and price above; add
  one English (U.S.) localization (display name = the human name I give you,
  description = one sentence of what it grants), attach the review screenshot
  I provide (the same in-game store screenshot may be reused), and mark it
  Cleared for Sale.
- Add the missing 7-day free-trial Introductory Offers on both subscriptions
  (Subscription Prices → Introductory Offers → + → Free Trial → 1 week →
  all territories → no end date).
- Fix wrong prices via the price schedule; for subscriptions, preserve the
  price for existing subscribers.
- After each fix, re-open the page and confirm the saved state matches, then
  report it done with the value you verified.

When everything is fixed, give me a final table of the full catalog as it now
stands in the console.
```

For **Google Play Console**, reuse the same prompt with these substitutions:
work at https://play.google.com/console → app `com.deeplife.simulator` →
Monetize → Products; use **`deeplife_mindset`** instead of
`deeplife_mindset_perk`; Play does not distinguish consumable/non-consumable at
creation (just create all 26 as in-app products, status **Active**);
subscriptions are `deeplife_premium_monthly` (base plan id `monthly`) and
`deeplife_premium_yearly` (base plan id `yearly`), each with an **offer**:
Free trial, 7 days, and base plan + offer set to **Active**. A subscription
with no active base plan returns nothing to the app.

---

## 4. Research: $0.99 paid start vs the free 7-day trial

Question: should DeepLife+ replace the free 7-day trial with a one-time ~$0.99
paid start (Apple "Pay Up Front" intro offer / Play single-payment offer)?

What the data says (2025–2026 industry sources):

- **Free trials maximize starts; payment friction maximizes intent.** Trials
  that require real payment commitment convert the users who do start at
  roughly 2–3× the rate of frictionless starts, but start volume drops
  sharply — commonly by half or more. Net revenue depends on which side of
  that trade your funnel is starved on.
- **7 days is already the right length band.** 7-day trials convert in the
  30–45% band vs 20–30% for 3-day; ~82–90% of trial starts happen on install
  day. (This is the same data the `DEEP_LIFE_PLUS_FREE_TRIAL_DAYS` comment
  already records.)
- **The $0.99 intro's real advantage is ad-network signal**: paid-UA apps use
  it to train campaigns on "users who paid something" rather than "users who
  tapped a free button". DeepLife is not running meaningful paid UA yet, so
  this advantage mostly does not apply today.
- **Games context:** subscription is a SECONDARY monetization here (gems,
  one-time IAPs and ads carry the store). Charging to sample the subscription
  narrows the top of a funnel that is not the main revenue path anyway.
- **Hard-paywalling the APP itself at $0.99** (the other reading) is clearly
  wrong for this product: paid installs collapse download volume, and this
  game's economy is built on F2P scale feeding ads + gem IAP.

**Recommendation: keep the free 7-day trial as the default.** Revisit a $0.99
pay-up-front first month as an A/B test once (a) the paywall funnel events
shipped in the redesign have a few weeks of data and (b) paid UA starts, where
the payer-signal benefit is real.

One code fact to know before ever flipping it: `storeFreeTrialDays()` in
`lib/subscription/planPricing.ts` deliberately returns 0 for any intro offer
that is not FREE (`paymentMode !== 'free-trial'`; on Android, no zero-price
phase). A $0.99 pay-up-front offer configured in the console would therefore
render today as "no trial" — the paywall shows only the regular price, and
StoreKit reveals the $0.99 first period at the native purchase sheet. Honest,
but it under-sells the offer; advertising "first week $0.99" in the paywall
would be a small, deliberate code change to make FIRST, not a console-only
switch.
