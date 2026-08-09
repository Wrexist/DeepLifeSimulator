# DeepLife — RevenueCat setup & migration guide

**Goal:** replace the self-hosted receipt-verification server (`server/iap-verify`)
with **RevenueCat**, so purchases, subscriptions, the 7-day free trial, receipt
verification, restores, and cross-platform entitlements are handled for you.

**Why this fixes IAP:** today the app fails **closed** — it refuses every
purchase unless a custom verify endpoint returns `{verified:true}`. That endpoint
has to be deployed, kept alive, and configured for sandbox. RevenueCat does the
verification server-side for you (no endpoint to run), so "Purchase could not be
verified by server" goes away and TestFlight/App-Review sandbox purchases work
out of the box.

> **Time:** ~2–4 hours of dashboard work, plus the code integration (Part 4),
> which is a developer task. Read the whole doc once before starting.

---

## The plan at a glance

1. **App Store Connect** — create every product + the 7-day intro offer, and agreements/banking. *(Part 1)*
2. **Google Play** — same, only if you ship Android. *(Part 2)*
3. **RevenueCat dashboard** — project, apps, products, **entitlements**, **offerings**, API keys. *(Part 3)*
4. **App code** — install `react-native-purchases`, configure it, and drive the game's `adsRemoved` / premium / gem grants from RevenueCat. *(Part 4)*
5. **Build config** — API keys as EAS env; retire the old verify-server secret. *(Part 5)*
6. **Test** — sandbox + StoreKit config. *(Part 6)*
7. **Go live** — final checklist. *(Part 7)*

---

## Part 0 — Prerequisites

- [ ] **Apple Developer Program** membership (paid), with **App Manager/Admin** access to App Store Connect for `com.deeplife.simulator` (App Store app id `6749675615`, Team `S3U8B8HH96`).
- [ ] **Paid Applications Agreement** signed in App Store Connect → *Business* → *Agreements*, and **banking + tax** filled in. **IAP will silently fail until this is "Active".** This is the #1 cause of "products won't load".
- [ ] A **RevenueCat account** (free up to ~$2.5k/mo tracked revenue): <https://app.revenuecat.com/signup>.
- [ ] (Android only) **Google Play Console** access + a **service account** with the Play Developer API enabled.
- [ ] The app's product IDs (already defined in `utils/iapConfig.ts` — see the [Product reference](#appendix-a--product-reference) at the bottom). **Use these exact IDs everywhere.**

---

## Part 1 — App Store Connect (iOS)

You create the products **in App Store Connect**; RevenueCat reads them. The IDs
must match `utils/iapConfig.ts` exactly (Appendix A).

### 1.1 In-app purchases (consumables + non-consumables)

App Store Connect → your app → **Monetization → In-App Purchases → +**.

For each product in [Appendix A](#appendix-a--product-reference):

1. Pick the **correct type** — this is permanent and cannot be changed later:
   - **Consumable** → gems, boosts, youth pills, `revival_pack` (things you can buy repeatedly).
   - **Non-Consumable** → `deeplife_remove_ads`, `deeplife_lifetime_premium`, and the permanent perks (`deeplife_unlock_all_perks`, banking perks, etc.).
2. **Product ID** = the exact string from Appendix A (e.g. `deeplife_gems_50000`).
3. **Reference Name** = anything internal (e.g. "50,000 Gems").
4. **Price** = pick the tier matching `SUBSCRIPTION_CONFIGS`/`PRODUCT_CONFIGS` (e.g. $99.99 for `deeplife_gems_50000`).
5. Add a **localized display name + description** (required for review) and a **review screenshot** of the store screen.
6. Save. Status will be **"Ready to Submit"** — that's enough for RevenueCat + sandbox to see it.

### 1.2 Subscriptions (DeepLife+) + the 7-day free trial

Subscriptions live under **Monetization → Subscriptions**.

1. Create **one Subscription Group** (e.g. "DeepLife+ Membership"). Both plans go in it so users can switch monthly↔yearly.
2. Add two auto-renewable subscriptions:
   - `deeplife_premium_monthly` — $4.99 / 1 month.
   - `deeplife_premium_yearly` — $49.99 / 1 year.
3. **Add the free trial (the "7 days free" hook):** on **each** subscription →
   **Subscription Prices → View all Subscription Pricing → Introductory Offers → +**
   → **Free Trial → 7 days** → all/needed territories. Introductory offers are
   per-territory; add the ones you sell in.
   - The app already advertises this via `DEEP_LIFE_PLUS_FREE_TRIAL_DAYS = 7` in
     `lib/subscription/deepLifePlus.ts`. **If you don't create the offer here,
     set that constant to `0`** so the app doesn't promise a trial the store
     won't honor.
4. Localized display name + description + a review screenshot for each.

### 1.3 Sandbox test account

App Store Connect → **Users and Access → Sandbox → Testers → +**. Create one with
an email you control (not a real Apple ID). On the test iPhone: **Settings → App
Store → Sandbox Account** → sign in with it. TestFlight + `.storekit`-less builds
then purchase through sandbox (no real charge).

---

## Part 2 — Google Play (Android only — skip if iOS-only for now)

1. Play Console → **Monetize → Products → In-app products / Subscriptions** → create the same IDs from Appendix A.
2. **7-day free trial (must match Apple):** on each subscription → **base plan → Add offer → Free trial → 7 days**. If you do **not** add the Android offer, the app will still show "7 days free" to Android users with no trial behind it — so either add the offer **or** set `DEEP_LIFE_PLUS_FREE_TRIAL_DAYS = 0` in `lib/subscription/deepLifePlus.ts` (which hides the trial messaging on both platforms). Don't promise a trial the store won't honor.
3. Play Console → **Setup → API access** → link a Google Cloud project → create a **service account** with **View financial data** + **Manage orders** → download its **JSON key** (you'll paste it into RevenueCat).
4. Upload at least an **internal-testing** build so Play activates IAP.

---

## Part 3 — RevenueCat dashboard

### 3.1 Project + apps

1. RevenueCat → **Create Project** ("DeepLife").
2. **Project settings → Apps → + New → App Store**:
   - **App Bundle ID:** `com.deeplife.simulator`
   - **App Store Connect App-Specific Shared Secret:** App Store Connect → your app → *App Information* → *App-Specific Shared Secret* → **Generate** → paste it in. *(Required for RC to validate iOS receipts.)*
   - **In-App Purchase Key (recommended):** App Store Connect → *Users and Access → Integrations → In-App Purchase* → create a key → upload the `.p8` + Key ID + Issuer ID to RevenueCat. Enables StoreKit 2 + more reliable status.
3. (Android) **+ New → Play Store**: package `com.deeplife.simulator`, paste the **service-account JSON** from Part 2.

### 3.2 Import products

RevenueCat → **Products → + Import** (or add manually). Pull in **every** product
ID from Appendix A for each store. RevenueCat now knows your catalog.

### 3.3 Entitlements (the important part)

Entitlements are the *access levels* your code checks. Create **two**:

| Entitlement ID | Attach these products | Drives in the app |
|---|---|---|
| `premium` | `deeplife_premium_monthly`, `deeplife_premium_yearly`, `deeplife_lifetime_premium` | `subscriptionService.hasPremiumAccess()` → Legacy Pass Premium, cosmetics |
| `ads_removed` | `deeplife_remove_ads`, `deeplife_lifetime_premium`, `deeplife_premium_monthly`, `deeplife_premium_yearly` | `settings.adsRemoved` → no banners/interstitials, hides the reward orb |

> Consumables (gems, boosts, youth pills, revival) are **NOT** entitlements —
> RevenueCat doesn't track balances. You grant those in-app on a successful
> purchase (same as today). See Part 4.4.

### 3.4 Offerings (what the paywall shows)

RevenueCat → **Offerings → + New Offering** ("default"). Add **Packages**:

- **Annual** → `deeplife_premium_yearly`
- **Monthly** → `deeplife_premium_monthly`
- **Lifetime** (custom package) → `deeplife_lifetime_premium`

The app can render prices/trial straight from this offering (localized, always
current) instead of the hardcoded `$4.99/$49.99` fallbacks.

### 3.5 API keys

RevenueCat → **Project settings → API keys**. Copy the **public SDK keys**:
- **Apple** key → `appl_xxxxxxxx`
- **Google** key → `goog_xxxxxxxx`

These are *public* (safe to ship in the app), like the existing `EXPO_PUBLIC_*` values.

---

## Part 4 — App code integration

> **✅ Already wired in this repo (flag-gated, off by default).** When the
> `revenueCat` flag is on, purchases and restores automatically route through
> RevenueCat and entitlements sync into game state — no further code needed:
> - `services/RevenueCatService.ts` — complete guarded wrapper (lazy-loads the
>   SDK; inert until installed + enabled, so **current builds are unaffected**).
> - `services/IAPService.ts` — `purchaseProduct()` and `restorePurchases()` branch
>   to RevenueCat when enabled, reusing the SAME `applyBenefit()` grant + exactly-
>   once dedup; `isAdsRemoved()` reads RC's cached entitlement.
> - `services/SubscriptionService.ts` — `hasPremiumAccess()` reads RC's cached
>   `premium` entitlement.
> - `components/SubscriptionReconciler.tsx` — refreshes RC entitlements on
>   mount/foreground and reacts to live RC changes (renewals/expiry), applying
>   `settings.adsRemoved` / premium via the existing reconcile logic.
> - `lib/config/featureFlags.ts` — `revenueCat` flag (`EXPO_PUBLIC_USE_REVENUECAT`);
>   `.env.example` — the env vars.
>
> **So your remaining work is just:** 4.1 (install the SDK) + Part 5 (keys) +
> flip the flag, after the dashboard setup. **Test on a device (Part 6) before
> enabling in production** — this money path could not be run here.
>
> The paywall (`SubscriptionModal`) and Store (`GemShopModal`) need **no changes**
> — they already call `iapService.purchaseProduct` / `restorePurchases`, which now
> route through RevenueCat when enabled. (Optional polish, not required: read
> `revenueCatService.getCurrentOffering()` in the paywall to show store-localized
> prices + the trial.) Sections 4.3–4.6 below document what the wiring does.

### 4.1 Install the SDK

```bash
npx expo install react-native-purchases
```

`expo install` picks the version matching your Expo SDK. It's a native module
(**Expo Go won't run it** — use a dev/EAS build), and needs no config-plugin
entry. This is intentionally not in `package.json` yet so current builds stay
identical until you're ready.

### 4.2 Configure once at startup

Add a small init (e.g. in `app/entry.ts` or the existing IAP boot path), after
ATT/tracking is resolved:

```ts
// Everything below uses the scaffolded service — you don't touch the raw SDK.
import { revenueCatService } from '@/services/RevenueCatService';
```

The service self-configures on first use, so there's nothing to add to the boot
path.

### 4.3 Drive entitlements from RevenueCat

The single source of truth becomes RevenueCat's active entitlements. On app
resume / after purchase / after restore, apply them to game state using the
**existing** helpers:

```ts
import { revenueCatService } from '@/services/RevenueCatService';
import { applyDeepLifePlusBenefits } from '@/contexts/game/actions/SubscriptionActions';

async function syncEntitlements(setGameState) {
  const { adsRemoved, premium } = await revenueCatService.getEntitlements();
  setGameState((prev) => {
    let next = prev;
    if (premium) next = applyDeepLifePlusBenefits(next);       // sets adsRemoved + welcome gems
    else if (adsRemoved) next = { ...next, settings: { ...next.settings, adsRemoved: true } };
    return next;
  });
}

// Live updates (renewals, expiry, cross-device restore):
const unsub = revenueCatService.addEntitlementsListener(({ adsRemoved, premium }) => {
  // same apply-to-state as above
});
```

`adsRemoved` feeds `settings.adsRemoved` (which `areAdsRemoved()`, `BannerAd`,
`AdRewardOrb` already read); `premium` feeds `subscriptionService.hasPremiumAccess()`.

### 4.4 Route purchases through the service

- **`components/SubscriptionModal.tsx`** (`handleSubscribe`): when
  `revenueCatService.isEnabled()`, buy the selected package via
  `revenueCatService.purchasePackage(pkg)` (from `getCurrentOffering()`), then
  apply entitlements. Falls back to `subscriptionService.purchasePremium()` when
  RC is off.
- **`components/GemShopModal.tsx`** (`handlePurchase`): when enabled, call
  `revenueCatService.purchaseProduct(id)` and, on success, grant the reward with
  the **existing** `PRODUCT_CONFIGS` mapping (gem amounts / perk flags),
  deduped by `transactionId` (reuse the `PROCESSED_IAP_TRANSACTIONS` ledger).
  Only the *transport* changes — the reward logic stays.

### 4.5 Restore

Wire the existing "Restore" buttons (Store footer, Settings, `SubscriptionModal`)
to `revenueCatService.restore()` when enabled, then apply the returned
entitlements (4.3). Optionally read `getCurrentOffering()` in the paywall so the
displayed prices + "7-day free trial" come straight from the store (localized).

### 4.6 What to remove (once RC is verified on device)

- The fail-closed `EXPO_PUBLIC_IAP_VERIFY_URL` gate in `services/IAPService.ts`.
- `server/iap-verify/*` (keep in git history; no longer deployed/called).
- The `EXPO_PUBLIC_IAP_VERIFY_URL` / `_TOKEN` EAS secrets + the
  `scripts/preflight-check.js` §9 gate that requires them.

> The service is done; 4.3–4.5 are a handful of small, well-scoped edits at
> named call sites. Keep the flag **off** until you've run the Part 6 sandbox
> pass on a device. Ask and these edits can be implemented for you.

---

## Part 5 — Build configuration (EAS)

Add the RevenueCat **public** keys as EAS env (they ship in the binary, so
`EXPO_PUBLIC_` is fine):

```bash
eas secret:create --scope project --name EXPO_PUBLIC_RC_IOS_KEY     --value "appl_xxxxxxxxxxxx"
eas secret:create --scope project --name EXPO_PUBLIC_RC_ANDROID_KEY --value "goog_xxxxxxxxxxxx"
```

Remove the old verify-server secrets once Part 4.6 lands:

```bash
eas secret:delete --name EXPO_PUBLIC_IAP_VERIFY_URL
eas secret:delete --name EXPO_PUBLIC_IAP_VERIFY_TOKEN
```

Then cut a new build: `eas build --profile production --platform ios`.

---

## Part 6 — Testing

1. **StoreKit config (fast local loop, optional):** in Xcode add a `.storekit`
   file mirroring the product IDs to test purchases in the simulator without the
   store. RevenueCat supports StoreKit config testing.
2. **Sandbox (the real path):** install a **TestFlight** build, sign the Sandbox
   tester into *Settings → App Store*, and verify:
   - [ ] Store screen loads with **real localized prices** (not the `$x.xx` fallbacks) → catalog + agreements are correct.
   - [ ] Buy `deeplife_gems_100` → gems credited; RevenueCat dashboard → **Customer History** shows the transaction.
   - [ ] Buy `deeplife_remove_ads` → banners/interstitials stop, reward orb disappears, `ads_removed` entitlement active in RC.
   - [ ] Start the **DeepLife+ annual** flow → the **7-day free trial** is offered by the system sheet; after purchase `premium` + `ads_removed` are active.
   - [ ] **Restore Purchases** on a reinstall → non-consumables + subscription come back; consumable gem balances correctly do **not**.
   - [ ] Kill the app mid-purchase → relaunch → entitlement reconciles (RevenueCat handles this) and gems grant exactly once.
3. RevenueCat dashboard → **Sandbox** view shows your test events in real time — use it to confirm each purchase reached RC.

---

## Part 7 — Go-live checklist

- [ ] Paid Applications Agreement **Active**; banking + tax complete.
- [ ] All product IDs from Appendix A created in App Store Connect (+ Play if Android), status ≥ "Ready to Submit".
- [ ] 7-day free trial added to **both** subscriptions (or `DEEP_LIFE_PLUS_FREE_TRIAL_DAYS` set to `0`).
- [ ] RevenueCat apps configured with shared secret / IAP key (iOS) and service account (Android).
- [ ] `premium` + `ads_removed` entitlements attached to the right products.
- [ ] `default` offering with annual/monthly/lifetime packages.
- [ ] App configured with the RC public keys; verify-server gate removed.
- [ ] Full sandbox test pass (Part 6) green on a TestFlight build.
- [ ] Submit the IAPs/subscriptions **with** the app binary for review (first-time IAPs are reviewed alongside the app).

---

## Part 8 — Ad revenue → RevenueCat "Ads"

Puts AdMob earnings on the same dashboard as subscription revenue, so LTV counts
both. **There is no adapter package to install for React Native** — the tracker
ships inside `react-native-purchases` itself as `Purchases.adTracker`, and the
pinned `10.4.4` already has it (the `loadAndTrack` helpers in RevenueCat's docs
are the native iOS/Android/Flutter adapters; RN calls the tracker directly).

### 8.1 What the app already does

| Piece | Where |
|---|---|
| AdMob → RevenueCat payload mapping (micros, precision, impression ids) | `lib/ads/adRevenueTracking.ts` |
| Fail-soft `trackAd*` wrappers | `services/RevenueCatService.ts` |
| `PAID` listeners on interstitial + rewarded; loaded/displayed/failed events | `services/AdMobService.ts` |
| Banner revenue via the `onPaid` prop | `components/BannerAd.tsx` |

Three things worth knowing before debugging it:

- **RevenueCat is configured on demand from the ad path.** Every `adTracker`
  method calls `throwIfNotConfigured()` inside the SDK, and a player who watches
  rewarded ads but never opens the paywall would otherwise hit an unconfigured
  instance mid-impression. `RevenueCatService.track()` configures first.
- **Impression ids are minted by us.** AdMob has no such concept; RevenueCat
  requires one on every event and uses it to stitch loaded → displayed → paid
  into a single impression. Fullscreen formats mint one per ad *request*;
  banners mint one per paid event, because AdMob refreshes them in place with no
  observable request boundary.
- **Every path is swallowed.** These run inside the ad SDK's own callbacks during
  playback, where an unhandled rejection costs a reward or wedges the ad.

### 8.2 Dashboard steps (owner — not doable from the repo)

1. **AdMob → enable impression-level ad revenue.** AdMob → *Account → Settings →
   Account settings → Impression-level ad revenue* → **On**. It is **off by
   default and account-gated**. Until it is on, AdMob never emits the `PAID`
   event, so the code above is correct and the RevenueCat Ads page stays empty.
2. **RevenueCat → Ads.** The Ads section is in beta; enable it for the project.
   Card 3 ("Connect your account") is an optional AdMob OAuth link that pulls in
   ad-unit names — analytics work without it.
3. **Ship a build with both flags on.** Ad revenue only reports when *both*
   `EXPO_PUBLIC_ENABLE_ADMOB=true` and `EXPO_PUBLIC_USE_REVENUECAT=true`, and
   neither survives `BORING_BUILD_MODE` — i.e. production/preview builds only,
   never a `__DEV__` run.

### 8.3 Verifying

Ad events land under the customer in RevenueCat, so the fastest check is a
TestFlight build: watch a rewarded ad, then open **Customers → your app user ID**
and look for the ad events on the timeline. Revenue figures lag AdMob's own
reporting, and test ads report $0 — a zero-value impression still proves the
wiring, so confirm the *event* first and the *amount* later.

### 8.4 Ads → Rewards is NOT wired (needs an SDK bump)

The second nav item under Ads is server-side-verified rewarded ads, where
RevenueCat verifies the impression with AdMob SSV and grants the reward itself —
which would close the client-side reward-fraud hole in `showRewardedAd()`. It
needs `Purchases.generateRewardVerificationToken()` and
`Purchases.pollRewardVerification()`, **neither of which exists in the pinned
`react-native-purchases@10.4.4`**; they arrive later in 10.x. Shipping it means
bumping the SDK (a native rebuild) *and* configuring SSV in AdMob, so it is
deliberately left out of the revenue-tracking change.

---

## Appendix A — Product reference

Source of truth: `utils/iapConfig.ts`. Create each with the matching **type**.

### Auto-renewable subscriptions (Subscription group "DeepLife+")

| Product ID | Price | Trial |
|---|---|---|
| `deeplife_premium_monthly` | $4.99 / month | 7-day free |
| `deeplife_premium_yearly` | $49.99 / year | 7-day free |

### Non-consumables (permanent — restorable)
`deeplife_remove_ads` ($4.99) · `deeplife_lifetime_premium` ($79.99) ·
`deeplife_unlock_all_perks` · `deeplife_mindset_perk` · `deeplife_mindset` ·
`deeplife_fast_learner` · `deeplife_good_credit` · `deeplife_premium_credit_card` ·
`deeplife_financial_planning` · `deeplife_business_banking` · `deeplife_private_banking`

### Consumables (repeatable — NOT restorable, granted on purchase)
`deeplife_gems_100` · `deeplife_gems_500` · `deeplife_gems_1000` ·
`deeplife_gems_5000` · `deeplife_gems_15000` · `deeplife_gems_50000` ·
`deeplife_gems_starter` · `deeplife_gems_premium` · `deeplife_gems_ultimate` ·
`deeplife_gems_mega` · `deeplife_money_boost` · `deeplife_skill_boost` ·
`deeplife_work_boost` · `deeplife_youth_pill_single` · `deeplife_youth_pill_pack` ·
`revival_pack`

> Confirm each ID against `utils/iapConfig.ts` before creating it — a typo means
> the product silently won't load. Prices should match `PRODUCT_CONFIGS`.

---

## Appendix B — Entitlement → in-app effect

| RevenueCat entitlement | Granting products | Code effect |
|---|---|---|
| `ads_removed` | remove_ads, lifetime_premium, premium_monthly, premium_yearly | `settings.adsRemoved = true` → `BannerAd` hidden, interstitials off, `AdRewardOrb`/`WatchAdRewardButton` hidden, `areAdsRemoved()` true |
| `premium` | premium_monthly, premium_yearly, lifetime_premium | `subscriptionService.hasPremiumAccess()` true → Legacy Pass Premium track, exclusive cosmetics; DeepLife+ paywall shows "active" |
| *(none — consumable)* | gems_*, *_boost, youth_pill_*, revival_pack | Grant gems/effects in game state on successful purchase, deduped by transaction id (reuse `PROCESSED_IAP_TRANSACTIONS`) |

---

## Appendix C — Troubleshooting

| Symptom | Likely cause |
|---|---|
| Products don't load / prices blank | Paid Applications Agreement not Active; product IDs mismatched; product not "Ready to Submit"; wrong bundle id in RC |
| "Purchase could not be verified" (old error) | Old verify-server gate still in the build — remove per Part 4.6 |
| Trial not offered | Introductory offer not created on the subscription, or the tester's Apple ID already used a trial in this subscription group |
| Entitlement not active after buying | Product not attached to the entitlement in RevenueCat, or shared secret / IAP key missing on the RC iOS app |
| Works in sandbox, not production | Normal — production entitlements need the app + IAPs approved and live |

**RevenueCat docs:** <https://www.revenuecat.com/docs/> ·
**iOS setup:** <https://www.revenuecat.com/docs/getting-started/installation/ios> ·
**Entitlements:** <https://www.revenuecat.com/docs/getting-started/entitlements> ·
**Free trials/offers:** <https://www.revenuecat.com/docs/subscription-guidance/subscription-offers>
