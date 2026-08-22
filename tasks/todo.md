# Plan — DeepLife+ subscription funnel: honest pricing, honest offers, measurable funnel (2026-08-22) — DONE

## Audit summary (what already exists)

The subscription system is NOT a stub. `lib/subscription/deepLifePlus.ts` is the plan/benefit
source of truth, `services/SubscriptionService.ts` owns entitlement (with the MON-1/MON-3 fixes
already in place), `components/SubscriptionModal.tsx` is a designed paywall with an annual
default, a value stack, trust row, Restore/Manage/Terms/Privacy and a compliant legal
disclosure. Benefits are truthful — all seven are really granted (ad-free, 250/day gems,
+25% income via `applyCareerSalaryAndPenalty`, Legacy Pass premium, cosmetics, welcome gems,
VIP support via `HelpModal.handleContactSupport`).

Things the brief asks for that are ALREADY satisfied and need no work:
- Paywall frequency / dismissal control (§29-30): every paywall entry point is user-initiated
  (crown, gem shop, daily gems, progression). The one auto-shown upsell (`PremiumPassPromo`)
  already has a blocking-moment guard, an 8-week cooldown, once-per-session and the shared
  `useInterruptionSlot` priority queue. Nothing to add.
- No fake discounts/countdowns/scarcity anywhere (§0). `lib/offers/pricing.ts` already encodes
  "never claim a discount you cannot prove".
- Restore, Manage, cancellation route, auto-renew disclosure (§25-27) all present.

## Defects found (this is the work)

P1. PRICES ARE HARDCODED USD. `DEEP_LIFE_PLUS_PLANS[].price` comes from the static
    `SUBSCRIPTION_CONFIGS` map ('$4.99' / '$49.99'). Every price on the paywall — plan cards,
    CTA, legal disclosure, lifetime row, `yearlyPerWeek()` "just $0.96/week",
    `yearlySavingsPercent()` "SAVE 17%" — renders that constant. A non-US player is shown a
    price and a currency they will not be charged, and the savings % is computed from USD
    figures so it can be simply false in a storefront with different price tiers. The gem shop
    already resolves live localized prices; the paywall is the one money surface that does not.
    (§42, §44, §45, §48, §62)

P2. NUMERIC STORE PRICE IS DESTROYED AT THE ADAPTER. `normalizeProduct` in
    `services/expoIapAdapter.ts` overwrites `price` with a display string, and nothing else
    carries the number. So `lib/offers/pricing.ts` (reads `priceAmount`) and GemShopModal's
    `storePriceInfo` (same) can NEVER fire — the offer discount badge and the currency-honest
    gems-per-unit line are both dead code today. Both were written correctly; the data just
    never arrives.

P3. THE TRIAL IS PROMISED ON UNKNOWN ELIGIBILITY. `trialEligible = introStatus !== 'ineligible'`,
    so 'unknown' shows a CTA reading "Start for $0.00 Today" and a banner reading "no charge".
    RC returns 'unknown' for ALL of Android, RC-disabled builds, and any failed call. A player
    who already used their trial taps a $0.00 promise and is charged immediately. There is also
    no check that the PRODUCT carries a free trial at all — `DEEP_LIFE_PLUS_FREE_TRIAL_DAYS = 7`
    is a hand-maintained constant that the store never validates. (§14, §49, §62)

P4. THE FUNNEL IS UNMEASURABLE PAST THE CTA. Only `paywall_open_tapped`, `paywall_viewed`,
    `paywall_cta_tapped` exist. No purchase result, plan selection, dismissal, restore,
    activation or first-premium-value event. §38 says find the biggest drop-off first — the
    CTA→purchase step, normally the biggest, is invisible. (§37, §38, §58)

P5. NO ACTIVATION MOMENT. On success the modal sets a one-line `message` string and leaves the
    player on the paywall. No welcome, no "here is what you unlocked", no route to a first
    premium win. (§32, §33)

## Tasks

- [x] T1  `services/expoIapAdapter.ts`: preserve the numeric price as `priceAmount` (additive;
          `price` stays a string so no existing reader changes). Unblocks P2's dead code + P1.
- [x] T2  NEW `lib/subscription/planPricing.ts` — pure, no service imports (lib layering rule):
          resolve a plan's display price from a loaded store product; per-week and savings%
          computed ONLY from same-currency numeric store prices; store-reported free-trial
          detection (iOS intro-offer fields + Android pricing phases).
- [x] T3  `services/RevenueCatService.ts`: `getSubscriptionStoreProducts()` so the paywall has a
          second price source in RC-driven builds where the expo-iap catalog may be empty.
- [x] T4  `components/SubscriptionModal.tsx`: wire live prices with explicit
          loading / unavailable / loaded states — never print a price we cannot stand behind.
- [x] T5  Trial decision matrix: store-confirmed offer × per-user eligibility. Only a confirmed
          -eligible user sees the "$0.00 today" promise.
- [x] T6  `lib/analytics/events.ts` + paywall: complete the funnel (plan selected, dismissed,
          purchase started/succeeded/failed/cancelled, restore x3, premium_activated,
          first_premium_value, intro_offer_shown).
- [x] T7  Premium activation moment: post-purchase welcome state listing what was unlocked and
          pointing at the first premium win.
- [x] T8  Tests: pure pricing/trial logic + paywall render smoke + adapter numeric preservation.
- [x] T9  Verify: npm run type-check, type-check:tests, lint:errors, targeted suites. Show output.

## Deliberately NOT doing

- Inventing new premium features/tiers (§3, §10, §34, §35). The brief says only implement perks
  that genuinely improve the game; new premium content is a product decision for the owner and
  would balloon this diff. Recommendations go in the final write-up instead.
- A/B experiment infrastructure (§39-41). No experiment framework exists; building one is its
  own project. The roadmap goes in the write-up.
- Changing prices, trial length or plan structure — owner's call, and they are configured in
  App Store Connect, not here.

## What shipped

**T1 · `services/expoIapAdapter.ts`** — `normalizeProduct` now keeps the numeric price as
`priceAmount` alongside the display string. This was a latent defect beyond the paywall: the
featured-offer discount badge (`lib/offers/pricing.ts`) and the gem shop's currency-honest
gems-per-unit line both read `priceAmount`, so both were unreachable code on every live
storefront. Two regression tests pin it.

**T2 · NEW `lib/subscription/planPricing.ts`** (+ 37 tests) — pure resolution of display price,
per-week framing, savings percentage and store-reported trial length. Derived claims return
empty/0/null whenever their inputs cannot support them: cross-currency savings are refused, the
per-week line is silent without a numeric amount, and the trial length comes from the product's
own introductory offer. Per-week rounds UP and savings FLOOR, so neither can under-state a price
or over-state a discount. Formatting is reused from the store's own string (no `Intl`, no
currency table), so symbol, symbol position and separators stay correct in every storefront.

**T3 · `services/RevenueCatService.getSubscriptionStoreProducts()`** — a second price source, so
an RC-driven build with expo-iap off still has real prices. Without it the new "never print an
unproven price" rule would have blanked the paywall in the one configuration that can charge.

**T4/T5 · `components/SubscriptionModal.tsx`** — live localized prices everywhere (cards, CTA,
lifetime row, legal disclosure, accessibility labels), all reading ONE resolved value so the
button and the disclosure can never quote different figures. Four explicit CTA states
(loading / store-disabled / unavailable→retry / buy); a purchase is only offered when a real
store price is in hand. The config USD price now appears solely where no store exists at all
(Expo Go, web preview) with the CTA disabled — mirroring how `GemShopModal` already degrades.
Trial copy splits into promise / conditional / none, and the "100% RISK-FREE" seal rides only on
a confirmed promise.

**T6 · Funnel** — 9 new events plus a `purchase_cancelled` / `purchase_failed` split in
`IAPService` (a `cancelled` flag added to `PurchaseResult`, set on both the RevenueCat and native
paths). The funnel now runs unbroken from surface tap to first premium use.

**T7 · Activation moment** — a post-purchase welcome state listing what was unlocked, with the
CTA turning into the way out. `first_premium_value` is recorded once per install
(`utils/premiumValueTracking.ts`, AsyncStorage-latched so it is not a save-format change) when a
member collects the 250-gem member drop.

**Red team** — the purchase and restore handlers now latch on a REF rather than the `busy` state:
`setBusy(true)` does not update `busy` until re-render, so two taps in one batch could both have
opened a store sheet (the gate-then-act shape from CLAUDE.md §4.4).

**Removed** — `yearlyPerWeek()` / `yearlySavingsPercent()` and their USD parsing helpers in
`deepLifePlus.ts`. Deleted rather than deprecated: a helper that silently answers in the wrong
currency is exactly what gets reached for again. A comment records where they went and why.

## Verification
- `npm run type-check` ✓ · `npm run type-check:tests` ✓ · `npm run lint:errors` ✓
- Targeted: `lib/subscription` (37 new) · `__tests__/monetization` · `__tests__/services` ·
  `lib/analytics` · `lib/offers` → 37 suites / 338 tests ✓
- `__tests__/render` + `__tests__/startup` → 55 suites / 488 tests ✓
- Full suite ✓ (see the final report)

## Left to the owner (deliberately not done)
- New premium features / tiers / a content calendar — product decisions, and the brief's own rule
  is to add only perks that genuinely improve the game.
- A/B experiment infrastructure — none exists; building it is its own project.
- Price, trial length and plan structure changes — configured in App Store Connect, not here.
- Win-back promotional offers — needs App Store Connect offer configuration plus a signing
  endpoint before any app-side work is meaningful.
