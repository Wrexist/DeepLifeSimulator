# Rotating weekly offers — how the price actually changes

The app ships a **weekly offer rotation** (`lib/offers/`). One offer is featured
each UTC week, the rotation is visible three weeks wide in the Offer Center, and
the schedule repeats every 12 weeks with no app release required.

The app does **not** set prices. This document is the other half of the feature:
what the account holder does in App Store Connect so that a featured offer is
actually cheaper, and why the app is built to work correctly whether or not
anyone ever does it.

---

## 1. The mechanism, and the one that does not apply

| Mechanism | Applies to | Usable here |
|---|---|---|
| **Scheduled temporary price change** (Price Schedule) | consumables, non-consumables, non-renewing subscriptions | **Yes — this is the one** |
| Promotional Offers (StoreKit) | auto-renewable subscriptions **only** | No |
| Introductory Offers | auto-renewable subscriptions only | No |
| Offer Codes | consumables, non-consumables, non-renewing subs | Not for a store-wide sale — they are per-customer redemption codes |

The gem packs, Youth Pills, perks and Remove Ads are **consumables and
non-consumables**. Apple's Promotional Offers API cannot discount them at any
price, so any implementation built on `Product.SubscriptionInfo.promotionalOffers`
would be dead code against this catalogue. The mechanism that does work is a
**temporary price change** on the product's Price Schedule: a start date, an end
date, up to one year, applied per country or region.

Verified against Apple's App Store Connect Help and StoreKit documentation,
2026-08. Re-check before relying on it — Apple has changed IAP offer surfaces
more than once.

---

## 2. Running a week's sale

Required role: Account Holder, Admin, or App Manager.

1. **Pick the week.** Offers rotate on **Monday 00:00 UTC**. Read the schedule
   out of `lib/offers/catalogue.ts` (order) and `lib/offers/schedule.ts` (the
   epoch is Monday 2024-01-01T00:00:00Z). The Offer Center's "next week" row
   shows the same answer at runtime.
2. In App Store Connect: **Apps → your app → Monetization → In-App Purchases**,
   open the SKU named by that week's `productId`.
3. Next to **Price Schedule**, click **+ → Temporary Price Change → Next**.
4. Set the **start date** to that Monday and the **end date** to the following
   Monday, so the discount window and the featured window are the same window.
5. Pick the reduced price and the countries or regions it applies to.
6. Save. Allow up to 24 hours for the change to appear for all users.

When the end date passes the price reverts on its own. No app change, no
release, nothing to switch off in code.

### While a temporary price change is running

Apple stops making automatic price adjustments (tax, FX) for the selected
regions for the duration. If the base region is included, that freeze applies
across all 175 storefronts.

---

## 3. What the app does with it

The app reads the **live StoreKit price** and nothing else. The badge is
derived, never declared:

```
SAVE n%  ⟺  live store price < regularPriceUSD, in the same currency (USD)
```

`lib/offers/pricing.ts` is the only place this is decided, and it is covered by
`lib/offers/__tests__/pricing.test.ts`.

Consequences worth understanding before changing anything:

- **No price change scheduled → no badge.** The offer still runs, still says
  "This week: Gem Boost", and still shows its real price. This is the ordinary
  case and it is correct. It is not a bug to be fixed by hard-coding a
  percentage.
- **Non-USD storefronts get no badge, ever.** `regularPriceUSD` is USD and the
  app has no exchange rate. A player in Germany sees their real localized price
  with no discount claim. Under-claiming a genuine sale abroad is the accepted
  cost of making a false claim structurally impossible.
- **A price *above* the recorded regular price reads as "no sale."** Apple
  adjusts prices for tax and FX, so `regularPriceUSD` can go stale. It never
  produces a negative discount or a strikethrough below the price being charged.
- **A SKU that did not load from the store is not purchasable.** No price, no
  buy button — the same stance `GemShopModal` already takes.

### If you change a product's regular price

Update `regularPriceUSD` in `lib/offers/catalogue.ts` **and** `price` in
`utils/iapConfig.ts` in the same change.
`lib/offers/__tests__/catalogue.test.ts` fails if the two disagree, because a
drift there either invents a permanent fake discount or hides a real one.

---

## 4. What this system will not do

These are design decisions, not gaps:

- **No per-user pricing.** The rotation is identical for every player in a given
  week. Personalisation (`lib/offers/personalization.ts`) reorders the secondary
  list; it never touches price.
- **No countdown that is not real.** The Offer Center's timer counts to the
  actual moment `currentOffer()` starts returning a different offer. It cannot
  reset early and cannot be extended.
- **No interruption.** Nothing pops up. The Offer Center opens from a row in the
  Gem Shop, and dismissing it does nothing but close it.
- **No fabricated "was" price.** A strikethrough is emitted only together with a
  proven discount; a test asserts the two are never separable.

---

## 5. Related

- `lib/shop/gemPromo.ts` — the **manual one-off** promo banner. Ships disabled,
  flipped on in code for a single named event, and can announce things the
  rotation cannot (a bonus-gem SKU, bespoke copy). It needs an app release per
  promo. The two systems are deliberately separate and both render.
- `utils/iapConfig.ts` — the SKU catalogue and its USD list prices.
- `docs/IAP-SETUP.md`, `docs/REVENUECAT-SETUP.md` — store configuration.
